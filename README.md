# Self Care Pharmacy — English storefront

Static site (selfcare-en.com). Auto-deploys to Cloudflare Pages on push to `main`.

- Site files: `public/`
- Catalog/categories/prices load live from Supabase at runtime (baked JSON is first-paint fallback).
- Deploy: GitHub Actions → Cloudflare Pages (`.github/workflows/deploy.yml`), project `selfcare-en-backup`.
