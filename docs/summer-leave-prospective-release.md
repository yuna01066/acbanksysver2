# 여름휴가 신규 신청 기준 적용

- 작업 기준: 배포 연결 브랜치 `codex/leave-attendance-priority-fixes`, 커밋 `318dc057d5531f58087d8d97e4ef6cfab44a6cdb`.
- 추가 마이그레이션: `20261001090000_summer_leave_prospective_deduction.sql`.
- 기존 `summer` 유형과 휴가 ID·일수·상태·승인 이력·부여/차감 내역은 변경하지 않는다.
- 기존 신청의 새 필드는 `NULL`이며 기존 계산을 그대로 사용한다. 기존 대기 건을 나중에 승인하거나 미래 일정으로 사용해도 신규 기준으로 바뀌지 않는다.
- 마이그레이션 적용 후 INSERT되는 여름휴가만 `deducts_annual_leave=true`로 저장한다. 유급이고 승인 시 차감하며 취소 승인 시 복원한다. 관리자 수동 등록도 같으며, 과거 사용일로 새로 등록하더라도 신규 기준이다.
- 기준은 DB 등록 시점이다. 날짜나 클라이언트 입력으로 차감 여부를 우회하거나 기존 신청의 기준을 바꿀 수 없다.

## 반영 순서

1. 운영 반영 승인 후 대상 프로젝트·활성 브랜치·커밋을 대조하고 직원별 잔액과 기존 기록을 읽기 전용으로 대사한다.
2. 배포 중에는 신규 휴가 신청·수동 등록을 잠시 중단한다. 기존 신청을 차감 대상으로 일괄 갱신하거나 과거 마이그레이션을 재실행하지 않는다.
3. 추가 마이그레이션을 적용하고 프런트엔드를 함께 반영한다. 새 Edge Function은 없으며 기존 함수도 변경하지 않는다.
4. 기존 요청은 `NULL`인지, 직원별 기존 잔액과 수동 조정이 동일한지 확인한 뒤 등록을 재개한다. 이 시점부터 새 신청에 신규 기준이 적용된다.
5. 실제 직원 기록의 생성·승인·취소 테스트는 별도 승인 대상이다. 격리 DB 검증을 운영 쓰기 검증으로 대신 보고하지 않는다.

## 로컬 검증

```sh
node scripts/test-summer-leave-prospective.mjs
node scripts/test-leave-attendance-priority.mjs
ACBANK_TEST_PGLITE=/absolute/path/to/pglite/dist/index.js node scripts/test-summer-leave-prospective.mjs --db
```

`--db`는 메모리 안의 PostgreSQL만 사용하며 운영 URL이나 인증정보를 받지 않는다. 기존 소멸·월별 정산 공식과 다른 휴가 정책은 재설계하지 않는다.
