# Cloudflare CDN Setup

This document covers the Cloudflare CDN integration for the Therr web properties.

## Architecture

```
Client -> Cloudflare Edge (CDN + DDoS) -> Nginx Ingress (GKE) -> Express SSR / API Gateway
```

Cloudflare acts as a reverse proxy for all subdomains, providing:
- Global edge caching for static assets and SSR HTML pages
- DDoS protection and bot management
- Automatic TLS termination at the edge
- Brotli/gzip compression (in addition to origin compression)

## Proxied Domains

| Domain | Backend | Notes |
|--------|---------|-------|
| `therr.com` | client-cluster-ip-service:7070 | Redirects to www |
| `www.therr.com` | client-cluster-ip-service:7070 | Main web app (SSR) |
| `dashboard.therr.com` | client-cluster-ip-service:7071 | Admin dashboard |
| `api.therr.com` | api-gateway-service:7770 | REST API |
| `websocket-service.therr.com` | websocket-service:7743 | WebSocket (Cloudflare WebSockets must be enabled) |
| `go.therr.com` | client-cluster-ip-service:7070 | Profile redirects |
| `link.therr.com` | client-cluster-ip-service:7070 | Link redirects |

## Cloudflare Dashboard Configuration

### DNS

1. Point your domain's nameservers to Cloudflare
2. Add A/AAAA records for each subdomain pointing to the GKE load balancer IP
3. Enable the orange cloud (proxy) icon for all subdomains listed above
4. For `websocket-service.therr.com`, ensure WebSockets are enabled in the Cloudflare dashboard

### SSL/TLS

- **SSL Mode**: `Full (Strict)` - Cloudflare validates the origin's Let's Encrypt certificate
- Keep the existing cert-manager / Let's Encrypt setup on the origin
- Enable **Always Use HTTPS**
- Enable **Automatic HTTPS Rewrites**
- Set **Minimum TLS Version** to `1.2`

### Caching

- **Browser Cache TTL**: Respect Existing Headers (our origin sets appropriate Cache-Control)
- **Caching Level**: Standard
- Enable **Always Online** (serves cached pages if origin is down)
- Enable **Tiered Cache** for better cache hit ratios

### Speed

- Enable **Brotli** compression
- Enable **Auto Minify** for JavaScript, CSS, and HTML
- Enable **Early Hints** (103 responses for faster page loads)
- Consider enabling **Rocket Loader** (defers JS loading) - test thoroughly as it can break some JS

### Page Rules / Cache Rules (Recommended)

Create these cache rules in order of priority:

1. **Static assets (aggressive cache)**:
   - Match: `www.therr.com/*.js`, `www.therr.com/*.css`, `www.therr.com/*.woff2`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Browser Cache TTL: Respect Existing Headers

2. **Sitemaps**:
   - Match: `www.therr.com/sitemap*.xml`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 hour

3. **API - no cache**:
   - Match: `api.therr.com/*`
   - Cache Level: Bypass
   - (API responses should not be cached at the edge)

4. **Dashboard - no cache**:
   - Match: `dashboard.therr.com/*`
   - Cache Level: Bypass

## Cache Strategy (Code-Level)

The codebase sets `Cache-Control` headers that Cloudflare respects:

| Content Type | Cache-Control Header | CDN Behavior |
|-------------|---------------------|--------------|
| JS/CSS (hashed) | `public, max-age=31536000, immutable` | Cached 1 year at edge |
| Other static assets | `public, max-age=86400` | Cached 24 hours at edge |
| Public SSR pages | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` | Cached 5 min at edge, 60s in browser |
| Sitemaps (XML) | `public, max-age=3600, s-maxage=3600` | Cached 1 hour at edge |
| Auth/private pages | `private, no-store` + `CDN-Cache-Control: no-store` | Never cached |
| Healthcheck | No cache headers | Not cached |

### CDN-Cache-Control Header

For private pages, we set `CDN-Cache-Control: no-store` in addition to `Cache-Control: private, no-store`. The `CDN-Cache-Control` header is a Cloudflare-specific header that overrides `Cache-Control` for CDN behavior only, without affecting browser caching.

### stale-while-revalidate

Public SSR pages use `stale-while-revalidate=600`, which tells Cloudflare to serve stale content for up to 10 minutes while fetching a fresh copy in the background. This dramatically improves perceived performance for cache-expired content.

## Real Client IP

The Nginx Ingress overrides for Cloudflare are in a **separate file** that should
only be applied after Cloudflare DNS proxy is live:

```yaml
# k8s/prod/values/nginx-ingress-cloudflare-overrides.yaml
controller:
  config:
    forwarded-for-header: "CF-Connecting-IP"
    compute-full-forwarded-for: "true"
    proxy-real-ip-cidr: "<Cloudflare IPv4 ranges>"
```

The `proxy-real-ip-cidr` restricts trusted proxy IPs to Cloudflare's published ranges, preventing IP spoofing.

### Cutover Steps

When enabling Cloudflare, apply the Nginx overrides and update Express trust proxy:

1. **Apply Nginx Ingress overrides** (merge both value files):
   ```bash
   helm upgrade nginx-ingress ingress-nginx/ingress-nginx \
     --namespace ingress-nginx \
     -f k8s/prod/values/nginx-ingress-controller-config.yaml \
     -f k8s/prod/values/nginx-ingress-cloudflare-overrides.yaml
   ```

2. **Update Express trust proxy** in `therr-client-web/src/server-client.tsx`:
   Change `app.set('trust proxy', 1)` to `app.set('trust proxy', 2)` (Cloudflare + Nginx = 2 hops)

### Updating Cloudflare IP Ranges

Cloudflare's IP ranges can change. Check periodically:
- IPv4: https://www.cloudflare.com/ips-v4/
- IPv6: https://www.cloudflare.com/ips-v6/

Update `proxy-real-ip-cidr` in `nginx-ingress-cloudflare-overrides.yaml` and re-apply.

## Content Security Policy (CSP)

The Helmet CSP in `server-client.tsx` includes Cloudflare domains:
- `scriptSrc`: `https://static.cloudflareinsights.com` (Cloudflare Web Analytics)
- `connectSrc`: `https://static.cloudflareinsights.com` (beacon reporting)

If you enable additional Cloudflare features (e.g., Zaraz, Turnstile), update the CSP accordingly.

## Verification

After enabling Cloudflare proxy:

1. **Check CF-Cache-Status header** on public pages:
   ```bash
   curl -I https://www.therr.com/locations
   # Look for: CF-Cache-Status: HIT (or MISS on first request, then HIT)
   ```

2. **Check real IP forwarding** - server logs should show real client IPs, not Cloudflare IPs (173.245.x.x, 103.x.x.x, etc.)

3. **Check WebSocket connectivity** at `wss://websocket-service.therr.com`

4. **Run Google PageSpeed Insights** before and after to measure TTFB improvement

5. **Check cache headers** on different page types:
   ```bash
   # Public page - should have s-maxage=300
   curl -I https://www.therr.com/locations

   # Private page - should have private, no-store
   curl -I https://www.therr.com/user/profile
   ```

## Cache Purging

When you need to immediately update cached content:

1. **Purge everything**: Cloudflare Dashboard > Caching > Purge Everything
2. **Purge by URL**: Cloudflare Dashboard > Caching > Custom Purge > Enter URLs
3. **API purge** (for CI/CD integration):
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
     -H "Authorization: Bearer {api_token}" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'
   ```

Consider adding a cache purge step to the CI/CD pipeline after deploying new versions of the web client.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pages show stale content | Purge Cloudflare cache for affected URLs |
| WebSocket connections failing | Ensure WebSockets are enabled in Cloudflare dashboard for the zone |
| Rate limiting sees Cloudflare IPs | Verify `forwarded-for-header` and `proxy-real-ip-cidr` in Nginx config |
| CSP errors in browser console | Add the blocked domain to Helmet CSP in `server-client.tsx` |
| Origin cert errors (525/526) | Ensure Let's Encrypt cert is valid; SSL mode must be Full (Strict) |
| Too many redirects (ERR_TOO_MANY_REDIRECTS) | Set SSL mode to Full (Strict), ensure `ssl-redirect` annotation is consistent |
