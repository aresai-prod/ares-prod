# ARES

ARES is a local-first production MVP for an AI-assisted SQL analytics web app. It combines a chat-driven UX, a backend that connects to SQL data sources, a knowledge layer, dashboards, and enterprise collaboration features.

This repo is structured as three apps:
- `client/`: ARES Console (React + Vite UI)
- `server/`: ARES API (Node + Express)
- `../ARES-website/`: ARES marketing site (Next.js + Tailwind)

## Quick Start (Local)

Prereqs:
- Node.js 20+
- npm 9+
- A local or hosted SQL database (Postgres or MySQL) if you want real query execution

1. Create your server env file
   - `cp server/.env.example server/.env`
   - Fill in at least `ARES_JWT_SECRET`
2. Ensure local storage exists (auto-created on first run)
   - `server/data/db.json` (use `server/data/db.sample.json` as a template if needed)
3. Install dependencies
   - `cd server && npm install`
   - `cd ../client && npm install`
   - `cd ../ARES-website && npm install` (optional, marketing site)
4. Start the backend
   - `cd server && npm run dev`
5. Start the frontend
   - `cd client && npm run dev`
6. Open the app
   - `http://localhost:5173`

> The backend runs at `http://localhost:8787` by default. Update `client/src/lib/api.ts` if you change it.

## What Works In This MVP

- Auth + sessions (signup/login)
- Google OAuth login (optional)
- Chat UX with SQL preview, results table, chart, AI analysis, and dashboard trends
- Profile settings for API key (OpenAI or Gemini only)
- Pods with license enforcement (Individual: 2 pods, Business: unlimited)
- Knowledge panel for:
  - Table dictionary
  - Column dictionary
  - Parameters
  - Metrics
  - Data sources (Local SQL + PostgreSQL + MySQL + Firebase)
  - Knowledge bank (per pod)
- Dashboards builder (metrics, joins, filters, chart types)
- Enterprise insights feed (Business only)
- Account menu (upgrade/settings/theme/logout)
- Concierge support chat (help & support only)
- Feedback capture for every AI response
- Frontend + backend analytics events
- Real SQL execution (Postgres/MySQL)
- Firebase connector (Firestore) with basic SQL-like parsing (SELECT/WHERE/ORDER/LIMIT only)
- Razorpay test billing endpoints + dev upgrade mode for local

## Security Notes

- Never commit real API keys. Use `server/.env` for server defaults.
- User-entered keys are stored locally in `server/data/db.json` for this MVP.
- For production, move credentials to a secret manager and encrypt stored keys.

## Where To Put Keys / Credentials

- `server/.env`
  - `ARES_JWT_SECRET`
  - `ADMIN_API_KEY` (for Postman admin APIs)
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `BILLING_ALLOW_DEV_UPGRADE` (optional, `true` for local upgrades without Razorpay)
  - `OPENAI_API_KEY` (optional fallback)
  - `OPENAI_MODEL`
  - `GEMINI_API_KEY` (optional fallback)
  - `GEMINI_MODEL`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
- In the UI (Profile modal)
  - OpenAI/Gemini API key per user
  - Active data source
- In the UI (Knowledge → Sources tab)
  - Local SQL `connectionString`
  - PostgreSQL `connectionString`
  - MySQL `connectionString`
  - Firebase `projectId` + `serviceAccountJson`
- In the UI (Account menu → Settings)
  - Theme toggle (light/dark)
  - Profile + LLM key updates

## Branding / Icon

Replace the file at:
- `client/src/assets/ares-icon.svg`

The UI imports that asset in the side nav, auth screen, and chat avatar.

## Google OAuth Setup (Local)

1. Create OAuth credentials in Google Cloud Console
2. Set the authorized redirect URI to:
   - `http://localhost:8787/api/auth/google/callback`
3. Fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `server/.env`

## Razorpay Test Flow (Postman)

- Create order:
  - `POST /api/billing/razorpay/order`
  - Body: `{ "plan": "INDIVIDUAL" }` or `{ "plan": "BUSINESS", "seats": 5 }`
- Verify payment:
  - `POST /api/billing/razorpay/verify`
  - Body: `{ "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "...", "plan": "INDIVIDUAL" }`

See `docs/postman-collection.json` for full examples.

## Billing (Local Dev)

For local testing, the console can upgrade plans without Razorpay:
- Set `BILLING_ALLOW_DEV_UPGRADE=true` in `server/.env` (or keep `NODE_ENV` unset).
- Use the “Upgrade to Individual / Enterprise” buttons in the License tab.
- The server will update the org + license immediately.

## Connectors UI

The Knowledge → Sources tab provides icon-based connectors with dynamic forms for:
- Local SQL (Postgres/MySQL)
- Hosted PostgreSQL
- Hosted MySQL
- Firebase (Firestore)

Each connector supports Test Connection + Save.

## Notes

- This is a production MVP for local usage and testing.
- The UI is light-first and uses liquid animated backgrounds.
