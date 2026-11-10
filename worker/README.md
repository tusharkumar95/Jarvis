# Jarvis AI Router (free-only)

This folder contains the secure backend for Ask Jarvis.

## What it does
It tries configured providers in this order:

1. Gemini
2. Groq
3. OpenRouter free router

There is deliberately **no paid fallback**.

## Secrets
Never put API keys in GitHub files. Add them as Cloudflare Worker secrets:

- GEMINI_API_KEY
- GROQ_API_KEY
- OPENROUTER_API_KEY

Optional model settings:
- GEMINI_MODEL (default: gemini-3.5-flash-lite)
- GROQ_MODEL (default: openai/gpt-oss-120b)

## Endpoints
- GET /health — shows which providers are configured (never returns keys)
- POST /chat — accepts {"messages":[{"role":"user","content":"Hello"}]}

## Frontend
After deployment, put the Worker URL into /config.js as JARVIS_API.

Deployment trigger: Jarvis Worker connected to Cloudflare Builds.


## Fuel Tip: Shell station prices (free tier)

Fuel Tip is available from the Jarvis home tools screen. It searches Canadian Shell stations using Cardog's station price snapshots, behind the secure Cloudflare Worker.

To enable reported prices:
1. Create a **Free** account at https://cardog.app/ (no payment card needed).
2. Create a Cardog API key.
3. Open Cloudflare → Workers & Pages → **jarvis-ai-router** → Settings → Variables and Secrets and add `CARDOG_API_KEY` as a **Secret**. Never add the key to GitHub, config.js, or frontend code.
4. Make sure the Jarvis Worker has deployed the updated `worker/app-builder.js` and `worker/fuel-tip.js`.
5. Open Jarvis → Fuel Tip → **Use my location** and approve the location request.

Cardog's Free plan provides **50 credits/month**; each station lookup uses one credit on a cache miss. Jarvis caches lookups approximately **18 hours** per rounded location and radius to help stay within this allowance. A new location or radius may use another credit. There is no paid fallback.

**Important:** This is not a direct live Shell pump feed. Cardog refreshes daily snapshots and regards reports as current for up to seven days. Jarvis displays each report's time, labels old reports, and always links to GasBuddy for a second opinion. The exact device location is not saved in Jarvis; the Worker rounds it before requesting data upstream. Favourites and search settings are stored on the device. Distances are straight-line and directions open Apple Maps.

No background alerts are enabled; new prices are checked only when Fuel Tip is opened and a lookup is requested.
