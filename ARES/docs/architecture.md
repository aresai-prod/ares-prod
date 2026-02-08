# ARES MVP Architecture

## Frontend
- React + Vite (TypeScript)
- Chat-centered layout with side drawer panels
- Dashboard builder for non-engineers
- Knowledge bank for pod-level context

## Backend
- Node + Express (TypeScript)
- JSON-based local storage (`server/data/db.json`)
- Auth + sessions (JWT + session registry)
- API endpoints for:
  - Chat + SQL execution
  - Knowledge, data sources, dashboards, knowledge bank
  - Insights feed (Business)
  - Licensing + Razorpay test flow
  - Admin/whitelist utilities

## Data Architecture (MVP)
- `db.json` holds:
  - Organizations (license, pods)
  - Users (roles, pod access, profile)
  - Sessions

## Planned Production Direction
- Replace JSON storage with SQL + cache
- Implement RAG with vector store
- Use managed auth + SSO
- Deploy server to Cloud Run + managed DB

