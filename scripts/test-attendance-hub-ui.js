// Run with playwright-cli run-code --filename scripts/test-attendance-hub-ui.js.
// Requires scripts/preview-attendance-hub.mjs; only local fixture data is used.
async (page) => {
  const base = 'http://127.0.0.1:4179';
  const results = [];
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (!route.request().url().startsWith(base + '/')) {
      external.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  const check = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  const go = async query => {
    await page.goto(base + query);
    await page.getByRole('heading', { name: '근태·연차·휴가', exact: true }).waitFor();
  };
  const overflow = async label => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);

  await page.setViewportSize({ width: 1280, height: 900 });
  await go('/attendance?role=admin');
  await page.getByRole('button', { name: '출근하기', exact: true }).waitFor();
  check(await page.getByRole('button', { name: '내 관리', exact: true }).getAttribute('aria-pressed') === 'true', 'admin defaults to personal mode');
  check(await page.evaluate(() => window.__hubQueries.filter(q => ['attendance_records', 'leave_requests', 'attendance_correction_requests'].includes(q.table)).every(q => q.filters.some(f => f[0] === 'user_id' && f[2] === 'admin-1'))), 'personal queries explicitly scoped to self');

  await go('/attendance?role=employee&scope=all&tab=members&employee=admin-1');
  await page.getByRole('button', { name: '퇴근하기', exact: true }).waitFor();
  check(await page.getByRole('button', { name: '관리자 모드', exact: true }).count() === 0, 'employee cannot enter admin mode via URL');
  check(await page.evaluate(() => window.__hubQueries.every(q => q.filters.some(f => f[2] === 'staff-1'))), 'forged employee URL never queries other staff');

  await go('/attendance?role=moderator&scope=all&tab=settings');
  await page.getByRole('tab', { name: '운영 현황', exact: true }).waitFor();
  check(await page.getByRole('tab', { name: '설정', exact: true }).count() === 0, 'moderator cannot enter policy settings');
  check(await page.getByRole('button', { name: '출근하기', exact: true }).count() === 0, 'admin mode hides personal clock action');

  await go('/attendance?role=admin&scope=all&tab=members&employee=staff-1');
  await page.getByRole('button', { name: '사용 기록 1', exact: true }).waitFor();
  const member = page.getByRole('button', { name: /테스트 직원 제작.*현재 잔여/ });
  const balance = await member.innerText();
  await page.getByRole('button', { name: '이전 연도', exact: true }).click();
  await page.getByRole('button', { name: '사용 기록 0', exact: true }).waitFor();
  check(await member.innerText() === balance, 'history year does not change current balance');
  await page.getByRole('button', { name: '다음 연도', exact: true }).click();
  await page.getByRole('button', { name: '전체 신청 3', exact: true }).click();
  check(await page.getByText('테스트 취소 기록', { exact: true }).isVisible(), 'all requests includes cancelled history');
  await page.getByRole('button', { name: '사용 기록 1', exact: true }).click();
  check(await page.getByText('테스트 취소 기록', { exact: true }).count() === 0, 'used history excludes cancelled records');
  await page.screenshot({ path: 'output/playwright/members-desktop.png', fullPage: true });
  await page.reload();
  await page.getByRole('heading', { name: '테스트 직원', exact: true }).waitFor();
  check(page.url().includes('employee=staff-1'), 'selected employee survives reload');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '구성원 목록으로', exact: true }).waitFor();
  await page.getByRole('button', { name: '사용 기록 1', exact: true }).waitFor();
  check(!(await page.getByRole('complementary', { name: '구성원 목록' }).isVisible()), 'mobile shows one detail pane');
  await overflow('mobile member detail has no body overflow');
  await page.screenshot({ path: 'output/playwright/members-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '구성원 목록으로', exact: true }).click();
  await page.getByRole('button', { name: /기록 없는 직원 제작/ }).click();
  await page.getByRole('button', { name: '사용 기록 0', exact: true }).waitFor();
  check(await page.getByText('해당 연도의 승인·사용 반영 기록이 없습니다.', { exact: true }).isVisible(), 'empty member history is explicit');
  await page.goBack();
  check(!page.url().includes('employee='), 'browser back restores member list');

  await go('/attendance?role=admin&scope=all&tab=approvals');
  await page.getByRole('button', { name: '취소 승인', exact: true }).waitFor();
  await overflow('mobile approval inbox has no body overflow');
  await page.getByRole('button', { name: '취소 승인', exact: true }).evaluate(button => { button.click(); button.click(); });
  await page.getByRole('button', { name: '취소 승인', exact: true }).waitFor({ state: 'detached' });
  check(await page.evaluate(() => window.__hubWrites.filter(w => w.rpc === 'review_leave_cancellation').length) === 1, 'double click sends one cancellation RPC');
  await page.getByRole('tab', { name: '구성원', exact: true }).click();
  await page.getByRole('button', { name: /테스트 직원 제작/ }).click();
  await page.getByRole('button', { name: '사용 기록 0', exact: true }).waitFor();
  check(await page.getByText(/승인된 예정 휴가 0일이/).isVisible(), 'approval invalidates member balance and history');

  await go('/attendance?role=admin&scope=all&tab=approvals');
  await page.getByRole('button', { name: '반려', exact: true }).waitFor();
  await page.evaluate(() => { window.__hubFailRpc = 'review_leave_request'; });
  await page.getByRole('button', { name: '반려', exact: true }).click();
  await page.getByRole('textbox', { name: '처리 사유', exact: true }).fill('테스트 반려 사유 보존');
  await page.getByRole('dialog').getByRole('button', { name: '반려', exact: true }).click();
  await page.getByText(/반려 실패:/).waitFor();
  check(await page.getByRole('textbox', { name: '처리 사유', exact: true }).inputValue() === '테스트 반려 사유 보존', 'failed review preserves dialog input');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__hubFailRpc = null; });
  await page.getByRole('button', { name: '검토·이력', exact: true }).click();
  await page.getByRole('textbox', { name: '처리 사유 (3자 이상)', exact: true }).waitFor();
  check(page.url().includes('request=correction-1'), 'selected correction is stored in URL');
  await page.reload();
  await page.getByRole('textbox', { name: '처리 사유 (3자 이상)', exact: true }).fill('테스트 정정 승인 사유');
  await page.getByRole('button', { name: '승인·근태 반영', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  check(await page.getByText('처리할 정정 요청이 없습니다.', { exact: true }).isVisible(), 'correction review refreshes inbox');

  await go('/attendance?role=admin&scope=all&tab=approvals&kind=attendance&request=correction-1');
  await page.getByRole('textbox', { name: '처리 사유 (3자 이상)', exact: true }).fill('알림 정정 승인 테스트');
  await page.getByRole('button', { name: '승인·근태 반영', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByText('처리할 정정 요청이 없습니다.', { exact: true }).waitFor();
  check(await page.getByRole('dialog').count() === 0, 'deep-link review does not reopen after refresh');

  await go('/attendance?role=employee&scope=my&tab=leave');
  await page.getByRole('heading', { name: '현재 연차', exact: true }).waitFor();
  await overflow('mobile personal leave has no body overflow');
  await page.screenshot({ path: 'output/playwright/leave-mobile.png', fullPage: true });
  await go('/attendance?role=employee&scope=my&tab=leave&fail=leave_requests');
  await page.getByRole('alert').waitFor();
  check(await page.getByRole('heading', { name: '현재 연차', exact: true }).count() === 0, 'failed query never presents zero balance');
  await go('/leave-management?role=admin&tab=admin&request=leave-2');
  await page.getByRole('tab', { name: '승인함', exact: true }).waitFor();
  check(page.url().includes('/attendance?') && page.url().includes('request=leave-2'), 'legacy request URL redirects with context');
  await go('/attendance?role=admin&scope=all&tab=overview');
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await page.getByRole('button', { name: /1명 출근 테스트 직원 오전반차/ }).click();
  const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }));
  check(await page.getByRole('textbox', { name: '기록 날짜' }).inputValue() === today, 'calendar click preserves selected date in list');
  await overflow('mobile attendance list has no body overflow');
  await page.getByRole('tab', { name: '운영 현황', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('tab', { name: '승인함', exact: true, selected: true }).waitFor();
  check(await page.getByRole('tab', { name: '승인함', exact: true }).getAttribute('aria-selected') === 'true', 'keyboard switches hub tabs');
  await page.getByRole('tab', { name: '리포트', exact: true }).click();
  const report = page.getByRole('combobox', { name: '리포트 종류' });
  await report.waitFor();
  await page.getByRole('heading', { name: '월별 근태 리포트', exact: true }).waitFor();
  await report.selectOption('overtime');
  await page.getByRole('heading', { name: '초과근무 자동 감지', exact: true }).waitFor();
  await report.selectOption('dept-analysis');
  await page.getByRole('heading', { name: '부서별 근무 패턴 분석', exact: true }).waitFor();
  check(true, 'three existing report views are connected');
  await page.getByRole('tab', { name: '설정', exact: true }).click();
  await page.getByRole('heading', { name: '연차 정책', exact: true }).waitFor();
  check(await page.getByRole('link', { name: '회사 설정 열기' }).getAttribute('href') === '/company-settings', 'GPS setting stays behind existing protected screen');
  await overflow('mobile settings has no body overflow');
  check(external.length === 0, 'no external network traffic');
  check(errors.length === 0, 'no browser runtime errors: ' + errors.join('; '));
  return { checks: results.length, results };
}
