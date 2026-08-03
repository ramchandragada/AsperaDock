# Aspera Hub website — asperahub.com

Marketing site for **Aspera Hub** at [asperahub.com](https://asperahub.com).

Visual style is intentionally close to the TuxGenie marketing pages (layout, tokens, typography) — but this is a **separate product and domain**. No TuxGenie branding on the live site.

Self-contained `index.html` (inline CSS/JS) plus Aspera Hub icon assets.

## Local preview

```bash
cd website
python3 -m http.server 5173
# open http://127.0.0.1:5173
```

## Deploy (Vercel / GitHub Pages)

Root Directory: `website` · no build command · domain `asperahub.com`.
