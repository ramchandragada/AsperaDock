# Aspera Hub website — asperahub.com

Marketing site for **Aspera Hub** at [asperahub.com](https://asperahub.com).

Visual style matches modern product marketing pages (layout, tokens, typography). This is a **separate product and domain** from any other Aspera apps.

Self-contained `index.html` (inline CSS/JS) plus Aspera Hub icon assets.

## Local preview

```bash
cd website
python3 -m http.server 5173
# open http://127.0.0.1:5173
```

## Deploy (GitHub Pages → asperahub.com)

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push to `master` (workflow: `.github/workflows/website.yml`)
3. In GoDaddy DNS for `asperahub.com` (remove parking / lander):
   - Apex A records → `185.199.108.153` `185.199.109.153` `185.199.110.153` `185.199.111.153`
   - `www` CNAME → `ramchandragada.github.io`
4. Pages → Custom domain: `asperahub.com` → Enforce HTTPS

`website/CNAME` is already set to `asperahub.com`.
