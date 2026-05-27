FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-kor \
  && (apt-get install -y --no-install-recommends libredwg-tools || true) \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY workers/quote-wizard-worker/package.json ./package.json
COPY workers/quote-wizard-worker/src ./src
COPY workers/quote-wizard-worker/scripts ./scripts

ENV NODE_ENV=production

CMD ["node", "src/index.mjs"]
