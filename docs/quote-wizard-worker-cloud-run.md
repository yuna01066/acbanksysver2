# Quote Wizard Worker Cloud Run Deployment

This worker provides the unrestricted PDF rendering, OCR, image analysis, DXF parsing, yield reference, and formula adapter path for the quote wizard.

Lovable Cloud remains the app and Edge Function host. Cloud Run only hosts the heavy worker because Lovable Edge Functions cannot install Poppler, Tesseract, Python CAD tooling, or run the Docker worker.

## Architecture

```text
Lovable app
  -> quote-wizard Edge Function
  -> QUOTE_WIZARD_WORKER_URL
  -> Cloud Run quote-wizard-worker
```

The Edge Function creates short-lived signed URLs for uploaded files. Cloud Run does not need a Supabase service role key.

## Required Secrets

Create these in Google Secret Manager:

```bash
printf '%s' '<lovable-api-key>' \
  | gcloud secrets create LOVABLE_API_KEY --data-file=- --project <project-id>

printf '%s' '<random-shared-secret>' \
  | gcloud secrets create QUOTE_WIZARD_WORKER_SECRET --data-file=- --project <project-id>
```

Use the same `QUOTE_WIZARD_WORKER_SECRET` in Lovable Cloud Secrets.

## Deploy

Install and authenticate the Google Cloud CLI, then run:

```bash
gcloud auth login
gcloud config set project <project-id>

REGION=asia-northeast3 \
SERVICE_NAME=acbank-quote-wizard-worker \
scripts/deploy-quote-wizard-worker-cloud-run.sh
```

If this machine does not have `gcloud`, use the GitHub Actions workflow instead:

1. Add repository secrets:
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY`
   - `LOVABLE_API_KEY`
   - `QUOTE_WIZARD_WORKER_SECRET`
2. Open GitHub Actions.
3. Run `Deploy Quote Wizard Worker to Cloud Run`.

The script builds `workers/quote-wizard-worker/Dockerfile`, pushes it to Artifact Registry, and deploys Cloud Run with:

- `min-instances=0` to keep idle cost low.
- `concurrency=1` to avoid multiple OCR/CAD jobs competing inside one container.
- `timeout=900` seconds for large PDFs.
- `allow-unauthenticated` because Lovable Edge Function authenticates with `QUOTE_WIZARD_WORKER_SECRET`.
- Secret Manager access granted to the Cloud Run runtime service account.

The deploy identity needs permission to enable APIs, create Artifact Registry repositories, build images, deploy Cloud Run, create/update Secret Manager versions, and grant secret accessor IAM. If you use a custom runtime service account, set `RUNTIME_SERVICE_ACCOUNT=<service-account-email>` when running the script.

## Verify

```bash
scripts/verify-quote-wizard-worker.sh https://<cloud-run-url>
```

Expected `/health` values:

```json
{
  "tools": {
    "pdftotext": true,
    "pdftoppm": true,
    "tesseract": true,
    "aiGateway": true
  }
}
```

## Connect Lovable

In Lovable Cloud Secrets set:

```text
QUOTE_WIZARD_WORKER_URL=https://<cloud-run-url>/analyze
QUOTE_WIZARD_WORKER_SECRET=<same-random-shared-secret>
```

Then republish or redeploy the Lovable `quote-wizard` Edge Function. A successful quote wizard run should show `worker: connected` instead of `worker: not_configured`.
