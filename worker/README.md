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