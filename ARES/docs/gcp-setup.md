# GCP Setup (Staging Guidance)

This is a pragmatic checklist for standing up ARES on GCP when you move beyond local staging.

## 1. Create Project

- Create a new GCP project in the Cloud Console
- Enable billing for the project

## 2. APIs to Enable

- Cloud Run
- Artifact Registry
- Secret Manager
- Cloud SQL (if using managed SQL)

## 3. Service Accounts

- Create a runtime service account for Cloud Run
- Grant:
  - Secret Manager Secret Accessor
  - Cloud SQL Client (if using Cloud SQL)

## 4. Secret Management

Store secrets in Secret Manager:
- `ARES_OPENAI_API_KEY`
- `ARES_GEMINI_API_KEY`
- `ARES_DB_URL`

## 5. Cloud SQL (Optional)

- Create a PostgreSQL instance
- Create a database and user
- Allow private IP or use Cloud SQL Auth Proxy

## 6. Build & Deploy (Suggested)

- Use a Dockerfile per service
- Build with Cloud Build or GitHub Actions
- Deploy server to Cloud Run
- Deploy client to Cloud Run or a static host (Cloud Storage + CDN)

## 7. Observability

- Enable Cloud Logging
- Add a log sink for analytics if needed

