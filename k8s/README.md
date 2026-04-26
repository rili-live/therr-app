# k8s manifests

Kubernetes manifests for the prod and test clusters. Apply with `kubectl apply -f <file>` against the appropriate cluster context.

```
k8s/
├── prod/    # Production GKE cluster
└── test/    # Test cluster
```

The deployment YAMLs are wired to images built by CI; applying them is
typically a one-time setup or a config change. The cert-manager and ingress
manifests are the parts most likely to need hands-on operation.

---

## TLS certificates (cert-manager + Let's Encrypt + Cloudflare)

### Architecture

| Object | File | Purpose |
|--------|------|---------|
| `ClusterIssuer letsencrypt-prod` | `prod/issuer.yaml` | Issues certs from Let's Encrypt using **DNS-01 via Cloudflare API** |
| `Certificate therr-network-tls` | `prod/certificate.yaml` | Cert covering the main hostnames (`therr.com`, `api.therr.com`, `dashboard.therr.com`, `habits.therr.com`, `websocket-service.therr.com`, plus `www.` variants where they resolve). Stored in `Secret therr-network-secret`. |
| `Certificate therr-network-rewrites-tls` | `prod/certificate-for-rewrites.yaml` | Cert for short-link hostnames (`go.therr.com`, `link.therr.com`). Stored in `Secret therr-network-rewrites-secret`. |
| `Ingress ingress-service` | `prod/ingress-service.yaml` | nginx-ingress rules for the main hostnames; references the TLS secret. |
| `Ingress ingress-rewrite-service` | `prod/ingress-rewrite-service.yaml` | nginx-ingress rules for the rewrite hostnames; references the rewrites TLS secret. |

A cert-manager `Certificate` is **all-or-nothing**: if Let's Encrypt fails to validate any single SAN, the entire cert fails to issue and the existing
secret stops renewing. Once it expires, every hostname on the cert breaks. Treat the SAN list as a tight invariant — every entry must either route to a
real backend in the matching ingress, or be intentionally provisioned for future use with DNS already in place.

### Why DNS-01 (Cloudflare) instead of HTTP-01

We previously used HTTP-01 (`solvers: - http01: ingress: class: nginx`). Reasons we moved off it:

- **Cloudflare proxy fragility.** When a hostname is orange-clouded, the HTTP-01 self-check fails until Cloudflare's edge has its own cert for the
  hostname (Universal SSL takes time on new subdomains). This blocked `habits.therr.com` issuance when it was first added.
- **Origin reachability requirement.** HTTP-01 requires port 80 reachable on the origin during issuance. Any LB or firewall change that breaks
  port-80 reachability also breaks renewals.
- **No wildcards.** HTTP-01 cannot validate `*.therr.com`. DNS-01 can, which leaves the door open for future consolidation.

DNS-01 sidesteps all of this — cert-manager writes a `_acme-challenge.<host>` TXT record via the Cloudflare API, Let's Encrypt reads it, done. Origin
reachability and proxy state are irrelevant.

### Cloudflare API token bootstrap

The DNS-01 solver authenticates to Cloudflare with an API token stored as a `Secret` in the **`cert-manager` namespace** (not `default`). Without
this Secret, `ClusterIssuer letsencrypt-prod` is permanently `Ready: False` and no renewals happen.

**Token scope** (Cloudflare dashboard → Profile → API Tokens → Create Token → Custom token):

- `Zone:Zone:Read` — All zones
- `Zone:DNS:Edit` — Include: specific zone → `therr.com`

No IP filter, no client cert. Name it descriptively (`cert-manager-dns01-prod`).

**Verify the token before installing:**
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  https://api.cloudflare.com/client/v4/user/tokens/verify
# Expect: {"result":{"status":"active",...},"success":true,...}
```

**Install:**
```bash
kubectl create secret generic cloudflare-api-token-secret \
  -n cert-manager \
  --from-literal=api-token=<TOKEN>
```

The Secret name (`cloudflare-api-token-secret`) and key (`api-token`) are
hardcoded in `prod/issuer.yaml` and must match exactly.

**Rotation cadence: every 90 days.** Rotate to:

```bash
# 1. Create a new token in Cloudflare (same scopes), keep the old one alive briefly.
# 2. Replace the Secret in-place:
kubectl create secret generic cloudflare-api-token-secret \
  -n cert-manager \
  --from-literal=api-token=<NEW_TOKEN> \
  --dry-run=client -o yaml | kubectl apply -f -
# 3. Force a renewal to confirm the new token works:
kubectl cert-manager renew therr-network-tls therr-network-rewrites-tls -n default
# 4. Watch:
kubectl get certificaterequest -A -w
# 5. Once Ready: True on both, revoke the old token in Cloudflare.
```

The canonical (out-of-cluster) backup of the active token belongs in the team password manager, alongside the `Cloudflare API token` entry in `docs/SECRETS_AND_LOCAL_BOOTSTRAP.md`.

### Common operations

**Check current cert state:**
```bash
kubectl describe certificate therr-network-tls -n default
kubectl describe certificate therr-network-rewrites-tls -n default
kubectl get certificaterequest -n default --sort-by=.metadata.creationTimestamp
kubectl get challenges -A
```

**Check the cert as the public sees it:**
```bash
openssl s_client -connect api.therr.com:443 -servername api.therr.com </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer
```

**Force renewal** (e.g., after rotating the Cloudflare token, or to test a SAN change without waiting for the `renewBefore` window):
```bash
kubectl cert-manager renew therr-network-tls therr-network-rewrites-tls -n default
```

If the `kubectl cert-manager` plugin is not installed, the equivalent is to delete the in-flight `CertificateRequest`:
```bash
kubectl get certificaterequest -n default
kubectl delete certificaterequest <stale-cr-name> -n default
```

Avoid deleting the `Secret` itself unless the cert is already expired. The Secret is what nginx-ingress serves; deleting it causes downtime until a new one is issued. Letting cert-manager swap it in place is zero-downtime.

### Adding or removing a hostname (SAN)

1. Confirm the hostname has a public DNS record (A/AAAA pointing to the
   load balancer, or CNAME to a hostname that does). If it doesn't resolve, do not add it — it will block the entire cert from issuing.
2. Add the hostname to **both**:
   - `dnsNames` in `prod/certificate.yaml` (or `prod/certificate-for-rewrites.yaml`)
   - `tls.hosts` and a corresponding `rules:` block in `prod/ingress-service.yaml` (or `prod/ingress-rewrite-service.yaml`)
3. Apply in this order:
   ```bash
   kubectl apply -f k8s/prod/certificate.yaml          # or certificate-for-rewrites.yaml
   # wait for Ready: True before continuing
   kubectl apply -f k8s/prod/ingress-service.yaml      # or ingress-rewrite-service.yaml
   ```
   The cert must be ready before the ingress references it; otherwise nginx serves the default cert for that hostname until the new one lands.
4. Verify externally with `openssl s_client` against the new hostname.

To remove a hostname, do steps 2 and 3 in the same order — cert first, then ingress. The freed Secret will be reissued without the SAN on the next renewal.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Certificate Ready: False`, `Order` events show `pending` indefinitely | Cloudflare API token missing, expired, or under-scoped | Rotate token; confirm scope includes `Zone:DNS:Edit` for the zone in question |
| `Order` events show `Forbidden` from Cloudflare API | Token revoked or zone not in token's scope | Rotate token with correct zone scope |
| `Certificate Ready: False` on a brand-new SAN, others fine | New SAN's parent zone not in the token's `Zone:DNS:Edit` allowlist (or not in `issuer.yaml`'s `dnsZones` selector) | Add the zone to both |
| Browser shows expired cert on one hostname | nginx-ingress cached the old `Secret`; cert-manager already rotated it | `kubectl rollout restart deployment ingress-nginx-controller -n ingress-nginx` |
| Mobile app login silently fails, gateway logs show no inbound traffic | TLS handshake failing; cert expired or missing for `api.therr.com` | Check certificate Ready state; force renewal |

For the underlying cause of the silent-mobile-failure mode, see also `TherrMobile/main/routes/Login/LoginForm.tsx` — the catch handler only surfaces a toast for `statusCode` 400/401/404/5xx, so any error without a status code (TLS failure, connection refused, DNS) is swallowed. That's a known UX gap to fix on the mobile side, but it does not change the infra response: a healthy cert is the prerequisite.

---

## Service deployments

Each `*-service-deployment.yaml` describes a microservice (`api-gateway`, `users`, `maps`, `messages`, `reactions`, `push-notifications`, `websocket`, plus
`client` for the web SSR app). Image tags are bumped by CI on merge to `main`. Manual edits to these files should be limited to resource limits, env vars, and replica counts — image tags are managed by the deploy pipeline.

PDBs (`*-pdb.yaml`) keep at least one replica of critical services available during voluntary disruptions.

## Redis

`redis-deployment.yaml` and `redis-ephemeral-deployment.yaml` are the two
Redis instances used by the API gateway (rate limiting, refresh-token tracking, API key cache) and other services. Ephemeral Redis is for short-TTL data that can be safely lost on restart.

## Open Telemetry

`open-telemetry-collector.yaml` runs the OTel collector that backend services
send traces and metrics to. See service deployment env vars (`OTEL_EXPORTER_OTLP_ENDPOINT`) for the wire-up.
