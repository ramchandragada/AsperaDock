# Aspera Hub website — asperahub.com

Marketing site for **Aspera Hub** at [asperahub.com](https://asperahub.com).

<<<<<<< HEAD
Visual style matches modern product marketing pages (layout, tokens, typography). This is a **separate product and domain** from any other Aspera apps.
=======
Visual style is intentionally close to the TuxGenie marketing pages (layout, tokens, typography) — but this is a **separate product and domain**. No TuxGenie branding on the live site.
>>>>>>> origin/master

Self-contained `index.html` (inline CSS/JS) plus Aspera Hub icon assets.

## Local preview

```bash
cd website
python3 -m http.server 5173
# open http://127.0.0.1:5173
```

<<<<<<< HEAD
## Deploy (GitHub Pages → asperahub.com)

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push to `master` (workflow: `.github/workflows/website.yml`)
3. In GoDaddy DNS for `asperahub.com` (remove parking / lander):
   - Apex A records → `185.199.108.153` `185.199.109.153` `185.199.110.153` `185.199.111.153`
   - `www` CNAME → `ramchandragada.github.io`
4. Pages → Custom domain: `asperahub.com` → Enforce HTTPS

`website/CNAME` is already set to `asperahub.com`.
=======
## Deploy (Vercel / GitHub Pages)

Root Directory: `website` · no build command · domain `asperahub.com`.
>>>>>>> origin/master
