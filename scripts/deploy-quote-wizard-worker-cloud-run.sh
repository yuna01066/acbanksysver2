#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REGION="${REGION:-asia-northeast3}"
SERVICE_NAME="${SERVICE_NAME:-acbank-quote-wizard-worker}"
REPOSITORY="${REPOSITORY:-acbank-workers}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
MEMORY="${MEMORY:-2Gi}"
CPU="${CPU:-1}"
TIMEOUT="${TIMEOUT:-900}"
CONCURRENCY="${CONCURRENCY:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-2}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
TESSERACT_LANG="${TESSERACT_LANG:-kor+eng}"
USE_SECRET_MANAGER="${USE_SECRET_MANAGER:-true}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required. Install Google Cloud SDK before running this script." >&2
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required. Run 'gcloud config set project <project-id>' or set PROJECT_ID." >&2
  exit 1
fi

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${IMAGE_TAG}"

echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "Image: ${IMAGE_URI}"

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  --project "$PROJECT_ID"

if ! gcloud artifacts repositories describe "$REPOSITORY" \
  --location "$REGION" \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker \
    --location "$REGION" \
    --description="ACBANK worker containers" \
    --project "$PROJECT_ID"
fi

if [[ "$USE_SECRET_MANAGER" == "true" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"

  required_secrets=(QUOTE_WIZARD_WORKER_SECRET)
  optional_secrets=()

  if gcloud secrets describe LOVABLE_API_KEY --project "$PROJECT_ID" >/dev/null 2>&1; then
    optional_secrets+=(LOVABLE_API_KEY)
  else
    echo "LOVABLE_API_KEY Secret Manager secret not found; deploying without AI Gateway."
  fi

  for secret_name in "${required_secrets[@]}"; do
    if ! gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1; then
      echo "Missing Secret Manager secret: ${secret_name}" >&2
      echo "Create it first, for example:" >&2
      echo "  printf '%s' '<value>' | gcloud secrets create ${secret_name} --data-file=- --project ${PROJECT_ID}" >&2
      exit 1
    fi
  done

  for secret_name in "${required_secrets[@]}" "${optional_secrets[@]}"; do
    gcloud secrets add-iam-policy-binding "$secret_name" \
      --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
      --role roles/secretmanager.secretAccessor \
      --project "$PROJECT_ID" >/dev/null
  done
fi

gcloud builds submit \
  --config cloudbuild.quote-wizard-worker.yaml \
  --substitutions "_IMAGE_URI=${IMAGE_URI}" \
  --project "$PROJECT_ID"

deploy_args=(
  run deploy "$SERVICE_NAME"
  --image "$IMAGE_URI"
  --region "$REGION"
  --platform managed
  --allow-unauthenticated
  --ingress all
  --memory "$MEMORY"
  --cpu "$CPU"
  --timeout "$TIMEOUT"
  --concurrency "$CONCURRENCY"
  --max-instances "$MAX_INSTANCES"
  --min-instances "$MIN_INSTANCES"
  --set-env-vars "HOST=0.0.0.0,NODE_ENV=production,TESSERACT_LANG=${TESSERACT_LANG}"
  --project "$PROJECT_ID"
)

if [[ "$USE_SECRET_MANAGER" == "true" ]]; then
  deploy_args+=(--service-account "$RUNTIME_SERVICE_ACCOUNT")
  secret_bindings=("QUOTE_WIZARD_WORKER_SECRET=QUOTE_WIZARD_WORKER_SECRET:latest")
  if gcloud secrets describe LOVABLE_API_KEY --project "$PROJECT_ID" >/dev/null 2>&1; then
    secret_bindings+=("LOVABLE_API_KEY=LOVABLE_API_KEY:latest")
  fi
  IFS=,
  deploy_args+=(--set-secrets "${secret_bindings[*]}")
  unset IFS
else
  if [[ -z "${QUOTE_WIZARD_WORKER_SECRET:-}" ]]; then
    echo "QUOTE_WIZARD_WORKER_SECRET env var is required when USE_SECRET_MANAGER=false." >&2
    exit 1
  fi
  env_vars=("QUOTE_WIZARD_WORKER_SECRET=${QUOTE_WIZARD_WORKER_SECRET}")
  if [[ -n "${LOVABLE_API_KEY:-}" ]]; then
    env_vars+=("LOVABLE_API_KEY=${LOVABLE_API_KEY}")
  else
    echo "LOVABLE_API_KEY env var is not set; deploying without AI Gateway."
  fi
  IFS=,
  deploy_args+=(--set-env-vars "${env_vars[*]}")
  unset IFS
fi

gcloud "${deploy_args[@]}"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format='value(status.url)')"

echo
echo "Worker deployed: ${SERVICE_URL}"
echo "Health check: ${SERVICE_URL}/health"
echo "Lovable secret QUOTE_WIZARD_WORKER_URL=${SERVICE_URL}/analyze"
