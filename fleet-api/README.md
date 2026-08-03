# Aspera Hub fleet API (Vercel)

Serves Zoho CRM OAuth secrets to office Mint PCs running Aspera Hub. Secrets live only in **Vercel project env vars** — never in the Hub `.deb` or git.

## Deploy

1. Create a Vercel project with **Root Directory** = `fleet-api`.
2. Set Production environment variables (see `.env.example`):
   - `FLEET_BEARER_TOKEN` — long random string (same value IT enters on each Hub)
   - `ZOHO_CRM_CLIENT_ID`
   - `ZOHO_CRM_CLIENT_SECRET`
   - `ZOHO_CRM_REFRESH_TOKEN`
   - `ZOHO_CRM_DC` — usually `in` (India)
3. Deploy. Note the URL, e.g. `https://aspera-hub-fleet.vercel.app`.

Endpoint: `GET /api/zoho-credentials`  
Auth: `Authorization: Bearer <FLEET_BEARER_TOKEN>`

## Hub setup (each Mint / Cinnamon PC)

1. **Settings → Integrations**
2. Fleet API URL = Vercel URL (no trailing path required)
3. Fleet token = `FLEET_BEARER_TOKEN`
4. **Fetch from cloud** → **Test connection**

Staff never paste Zoho Client ID, Secret, or refresh token.

## Security

- Unauthenticated requests get `401`.
- Incomplete server env gets `503`.
- Rotate `FLEET_BEARER_TOKEN` in Vercel and update Hubs if a token leaks.
- Do not host this under the GitHub Pages marketing site.
