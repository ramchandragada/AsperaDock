# Aspera Hub website

Static marketing site for **Aspera Hub** (free Linux workspace).

## Local preview

```bash
cd website
python3 -m http.server 5173
# open http://127.0.0.1:5173
```

## Deploy

- Point **asperahub.com** (when purchased) at this `website/` folder (Cloudflare Pages, Netlify, or GitHub Pages).
- Download buttons resolve the latest `.deb` from GitHub Releases via the public API.

## Brand

Product name: **Aspera Hub**  
Debian package id (for upgrades): `asperadock`
