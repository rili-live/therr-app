# therr-client-web
<!-- Updated: 2026-03-26 -->

Public-facing web app with SSR, serving at port 7070.

## Locale URL Routing

The web app supports locale-prefixed URLs for multilingual SEO. English uses unprefixed URLs (preserving existing SEO), and non-English locales use a prefix:

| URL | Language |
|-----|----------|
| `/locations` | English (default) |
| `/es/locations` | Spanish |
| `/en/locations` | 301 redirect to `/locations` |

**How it works:**
- Express middleware in `server-client.tsx` detects and strips the `/es/` prefix before route matching
- React Router's `basename` prop handles client-side navigation with the correct prefix
- The URL prefix is the source of truth for page locale (not cookies or storage)
- The language switcher in `Header.tsx` navigates to the locale-specific URL (full page navigation)
- HBS templates render locale-specific `canonical`, `hreflang`, and `og:url` meta tags
- The sitemap includes both English and Spanish entries with cross-locale `hreflang` links

**Key files:**
- `src/server-client.tsx` - Locale middleware, SSR rendering, sitemap
- `src/index.tsx` - BrowserRouter `basename` for client-side routing
- `src/store.tsx` - Locale detection from URL for Redux state
- `src/components/Header.tsx` - Language switcher with URL navigation
- `src/views/*.hbs` - Meta tags with `canonicalPath`, `hreflangEn`, `hreflangEs`

**Translation dictionaries:**
- `src/locales/en-us/dictionary.json` - English strings
- `src/locales/es/dictionary.json` - Spanish strings

When adding new UI text, add the translation key to both dictionary files. See [Locale URL Routing docs](../docs/LOCALE_URL_ROUTING.md) for full details.
