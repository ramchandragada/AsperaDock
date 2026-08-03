# Aspera Hub website — asperahub.com

Static marketing site for **Aspera Hub** (free Linux workspace).
Sibling product to [TuxGenie](https://www.tuxgenie.com/).

## Local preview

```bash
cd website
python3 -m http.server 5173
# open http://127.0.0.1:5173
```

## Deploy on Vercel (recommended)

1. Import the GitHub repo `ramchandragada/AsperaDock` in [Vercel](https://vercel.com).
2. Set **Root Directory** to `website`.
3. Framework preset: **Other** (static). No build command needed.
4. Output: leave blank (serves `website/` as-is).
5. Add domain **asperahub.com** (and `www`) in Vercel → Domains.
6. At GoDaddy DNS for `asperahub.com`:
   - Apex (`@`): A record → `76.76.21.21` (Vercel), **or** use Vercel nameservers.
   - `www`: CNAME → `cname.vercel-dns.com`.

`vercel.json` in this folder enables clean URLs and basic security headers.

## Deploy on Railway

Railway works better for apps than pure static sites. Prefer Vercel/Cloudflare Pages/Netlify for this folder. If you insist on Railway:

1. New project → Deploy from GitHub → same repo.
2. Set root to `website` and use a static file server, e.g. start command:
   `npx --yes serve -s . -l $PORT`
3. Attach custom domain `asperahub.com` in Railway networking, then point GoDaddy DNS as Railway instructs.

## Download buttons

Buttons resolve the latest `.deb` from GitHub Releases via the public API:

`https://api.github.com/repos/ramchandragada/AsperaDock/releases/latest`

## Brand

| | |
|---|---|
| Product | **Aspera Hub** |
| Domain | **asperahub.com** |
| Package id | `asperadock` (stable for upgrades) |
| Repo | https://github.com/ramchandragada/AsperaDock |
| Company | Aspera Technologies Pte Ltd |
