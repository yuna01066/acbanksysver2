# Quote Wizard Worker

별도 분석 워커 스캐폴드입니다. Supabase Edge Function `quote-wizard`는 `QUOTE_WIZARD_WORKER_URL`이 설정되어 있으면 이 워커로 job/file metadata를 전달합니다.

## 역할

- Supabase Storage `quote-wizard-temp` 파일을 다운로드합니다.
- PDF/image/DXF/DWG/source 파일을 분류하고 가능한 로컬 파서를 실행합니다.
- 추출된 제작물, 파트/조각, 수량, 누락값, 위험 항목을 정규화합니다.
- 원장/수율 참고값과 견적 공식 snapshot을 반환합니다.

## 실행

```bash
cd workers/quote-wizard-worker
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run dev
```

선택 환경 변수:

- `QUOTE_WIZARD_WORKER_SECRET`: Edge Function에서 전달하는 Bearer token 검증.
- `ACBANK_DXF_PARSER`: `dwg-cad-analyzer/scripts/parse_dxf_ascii.py` 경로.
- `ACBANK_CAD_INSPECTOR`: `dwg-cad-analyzer/scripts/inspect_cad.py` 경로.
- `ACBANK_YIELD_CALCULATOR`: `acbank-drawing-quote-analyzer/scripts/acrylic_yield_calculator.py` 경로.
- `ACBANK_FORMULA_CALCULATOR`: `acbank-quote-formula-calculator/scripts/calculate_formula_v2.py` 경로.

현재 워커는 배포 환경 의존성이 없을 때도 `needs_review` 분석 snapshot을 반환하는 MVP입니다. PDF 렌더링, DWG 변환기, AI Gateway 파일 비전 분석은 이 워커에 단계적으로 확장합니다.
