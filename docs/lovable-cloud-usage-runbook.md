# Lovable Cloud 사용량 제한 대응 런북

## 즉시 확인

1. Lovable 프로젝트에서 `Settings -> Cloud & AI balance`를 엽니다.
2. 잔액과 사용량 상위 항목을 확인합니다.
   - Storage
   - Network
   - Edge Function compute
   - Database
   - Live updates
   - AI
3. 잔액 부족이면 운영 중단 방지를 위해 top-up 또는 automatic top-up을 먼저 설정합니다.

## 앱 내부 확인

관리자 화면의 `데이터 스토리지 현황`에서 다음을 확인합니다.

- Lovable/Supabase Storage bucket별 파일 수와 용량
- `document_files.storage_provider` 분포
- GCS `acbank_sys2` 폴더별 파일 수와 용량
- Google Drive 동기화 pending/failed 상태

신규 견적 첨부와 견적 PDF는 GCS 저장을 기준으로 합니다. 기존 Supabase Storage 파일은 검증 전 삭제하지 않습니다.

## 마이그레이션 실행 순서

1. Dry-run으로 대상 파일 수와 용량을 확인합니다.

```json
{
  "dryRun": true,
  "buckets": [
    "tax-documents",
    "incident-attachments",
    "recipient-documents",
    "team-chat-attachments"
  ]
}
```

2. 결과의 `scanned`, `planned`, `totalBytes`, `errors`를 확인합니다.
3. 업무 영향이 낮은 bucket부터 실제 복사를 실행합니다.

```json
{
  "dryRun": false,
  "updateDatabase": true,
  "buckets": [
    "tax-documents",
    "incident-attachments",
    "recipient-documents",
    "team-chat-attachments"
  ]
}
```

4. 마이그레이션 후 GCS signed URL 다운로드를 5건 이상 검증합니다.
5. `document_files.storage_provider = 'gcs'` 전환 수량을 확인합니다.
6. Supabase Storage 원본 삭제는 별도 승인 후 진행합니다.

## AI 사용량 확인 대상

다음 함수는 `LOVABLE_API_KEY` 또는 Lovable AI Gateway를 사용합니다.

- `quote-wizard`
- `channel-talk-webhook`
- `generate-response-draft`
- `ocr-document`
- `extract-business-info`
- `simulate-tax`
- `calculate-salary`
- `quote-wizard-worker`

Cloud 경고 원인이 AI usage로 확인되면, 2차 작업에서 `AI_PROVIDER`, `OPENAI_API_KEY` 또는 Vertex AI 기반으로 provider 추상화를 진행합니다.
