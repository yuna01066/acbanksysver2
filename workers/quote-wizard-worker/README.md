# Quote Wizard Worker

별도 분석 워커입니다. Lovable/Supabase Edge Function `quote-wizard`는 `QUOTE_WIZARD_WORKER_URL`이 설정되어 있으면 이 워커로 job/file metadata와 15분 만료 Signed URL을 전달합니다.

## 역할

- Edge Function이 생성한 Signed URL로 Supabase Storage `quote-wizard-temp` 파일을 다운로드합니다.
- PDF/image/DXF/DWG/source 파일을 분류하고 가능한 로컬 파서를 실행합니다.
- 추출된 제작물, 파트/조각, 수량, 누락값, 위험 항목을 정규화합니다.
- 원장/수율 참고값과 금액 산출 보류 snapshot을 반환합니다.

## 실행

```bash
cd workers/quote-wizard-worker
TESSERACT_LANG=kor+eng npm run dev
```

로컬에서 Edge Function을 거치지 않고 직접 Storage 파일을 내려받아 테스트해야 할 때만 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 fallback으로 사용할 수 있습니다. Render 운영 환경에는 service role key를 저장하지 않습니다.

환경 변수:

- `QUOTE_WIZARD_WORKER_SECRET`: Edge Function에서 전달하는 Bearer token 검증.
- `LOVABLE_API_KEY`: AI Gateway 비전/텍스트 분석용 키. 없으면 AI enrichment 없이 로컬 PDF/OCR/CAD 분석만 수행합니다.
- `TESSERACT_LANG`: 기본 `kor+eng`.
- `ACBANK_DXF_PARSER`: 기본 `workers/quote-wizard-worker/scripts/parse_dxf_ascii.py`.
- `ACBANK_CAD_INSPECTOR`: 기본 `workers/quote-wizard-worker/scripts/inspect_cad.py`.
- `ACBANK_YIELD_CALCULATOR`: 기본 `workers/quote-wizard-worker/scripts/acrylic_yield_calculator.py`.

권장 시스템 도구:

- Poppler: `pdftotext`, `pdftoppm`
- Tesseract OCR: `tesseract` with `kor`, `eng` language data
- Python 3: CAD/yield skill scripts 실행

## 분석 범위

- PDF: `pdftotext`가 있으면 레이아웃 텍스트를 우선 추출하고, 없으면 PDF 스트림 텍스트를 제한 추출합니다.
- PDF 렌더링: `pdftoppm`이 있으면 앞쪽 페이지를 PNG로 렌더링해 AI Gateway 비전 분석에 전달합니다.
- OCR: `tesseract`가 있으면 렌더링 이미지/첨부 이미지에서 `kor+eng` OCR을 시도합니다.
- 이미지: OCR과 AI Gateway 비전 분석 대상으로 전달합니다.
- DXF: `dwg-cad-analyzer` 스킬의 ASCII DXF 파서와 내장 LWPOLYLINE 파서를 사용합니다.
- DWG: 로컬 변환기가 없으면 CAD metadata/도구 가능 여부만 기록하고 PDF/DXF 미리보기를 요청합니다.
- 수율: 파트 치수와 두께가 있으면 Edge Function이 전달한 DB `panel_sizes` 후보를 우선 사용하고, 없으면 `acrylic_yield_calculator.py --logic-candidates`를 실행합니다.
- 금액: DB 원장 단가와 수율 결과가 있는 경우 `calculate_formula_v2.py`로 임시 금액 초안을 만듭니다. 재질/가공/치수 검수값이 남아 있으면 `needs_review` 상태로 유지하고, 임의 단가/공임은 만들지 않습니다.

## Render 배포

repo 루트의 `render.yaml`을 Render Blueprint로 연결합니다.

필수 Secret:

```text
QUOTE_WIZARD_WORKER_SECRET=<Lovable Edge Function과 동일한 값>
```

선택 Secret:

```text
LOVABLE_API_KEY=<Lovable AI Gateway key>
```

컨테이너에는 `node`, `python3`, `poppler-utils`, `tesseract-ocr`, `tesseract-ocr-kor`, `tesseract-ocr-eng`가 설치됩니다. `libredwg-tools`는 설치 가능하면 포함하지만, 없어도 DWG는 `미리보기 필요` 상태로 처리합니다.

배포 후 `/health`에서 아래 값이 켜졌는지 확인합니다.

```json
{
  "tools": {
    "pdftotext": true,
    "pdftoppm": true,
    "tesseract": true,
    "aiGateway": false
  }
}
```

`LOVABLE_API_KEY`를 설정하고 재배포하면 `aiGateway`가 `true`로 바뀝니다.

## Lovable 연결

Lovable Cloud의 `quote-wizard` Edge Function에 다음 Secret을 설정해야 워커가 사용됩니다.

```text
QUOTE_WIZARD_WORKER_URL=https://<public-worker-host>/analyze
QUOTE_WIZARD_WORKER_SECRET=<Render와 동일한 값>
```

중요: Lovable Cloud에서 실행되는 Edge Function은 로컬 `127.0.0.1` 워커에 접근할 수 없습니다. 운영에서는 Render/Railway/Fly/Cloud Run 같은 공개 HTTPS 엔드포인트로 이 워커를 배포한 뒤 URL을 설정해야 합니다.

## Cloud Run 배포

무료 사용량을 우선 활용하려면 Google Cloud Run 배포 경로를 사용할 수 있습니다. repo 루트 기준:

```bash
REGION=asia-northeast3 scripts/deploy-quote-wizard-worker-cloud-run.sh
```

자세한 절차는 `docs/quote-wizard-worker-cloud-run.md`를 참고하세요.
