import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { eachDayOfInterval, endOfMonth, format, isWeekend } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type AttendanceRow = Pick<Database['public']['Tables']['attendance_records']['Row'],
  'user_id' | 'date' | 'check_in' | 'check_out' | 'work_hours' | 'status'>;
type LeaveRow = Pick<Database['public']['Tables']['leave_requests']['Row'],
  'user_id' | 'start_date' | 'end_date' | 'leave_type' | 'status'>;

export interface MonthlyAttendancePrintInput {
  year: number;
  month: number;
  employees: { id: string; name: string | null; department: string; workDays: number; totalHours: number; lateDays: number }[];
  records: AttendanceRow[];
  leaveRequests: LeaveRow[];
  businessDateSet: Set<string>;
  generatedAt?: Date;
}

const statusLabels: Record<string, string> = {
  checked_in: '근무중', checked_out: '퇴근', late: '지각', absent: '결근',
  half_day: '반차', holiday: '휴일', present: '출근',
};
const koreanDate = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const isIncomplete = (row: AttendanceRow) => (!row.check_in || !row.check_out)
  && (!!row.check_in || !!row.check_out || !['absent', 'holiday', 'half_day'].includes(row.status));

function timeLabel(value: string | null, recordDate: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '시간 확인 필요';
  const day = koreanDate(date);
  return `${day === recordDate ? '' : day.slice(5).replace('-', '/') + ' '}${clock.format(date)}`;
}

const printCss = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #171717; background: white; font-family: "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", sans-serif; font-size: 10pt; line-height: 1.35; }
  h1 { margin: 0 0 8px; font-size: 21pt; } h2 { margin: 0 0 8px; font-size: 16pt; overflow-wrap: anywhere; }
  p { margin: 5px 0; } .meta, .note { color: #525252; font-size: 9pt; }
  .metrics { padding: 9px 0; margin: 10px 0; border-top: 1px solid #aaa; border-bottom: 1px solid #aaa; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-variant-numeric: tabular-nums; }
  th, td { padding: 5px 4px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  th { background: #f1f1f1; font-weight: 600; } thead { display: table-header-group; } tr { break-inside: avoid; }
  .daily { font-size: 9pt; } .daily th, .daily td { padding: 4px; }
  .number { text-align: right; } .note { margin-top: 12px; }
  .employee { break-before: page; page-break-before: always; }
  .employee header { break-inside: avoid; break-after: avoid; }
  .toolbar { margin-bottom: 24px; padding: 12px; background: #f1f1f1; }
  button { min-height: 44px; padding: 8px 16px; font: inherit; cursor: pointer; }
  button:focus-visible { outline: 2px solid #222; outline-offset: 3px; }
  @media screen { body { max-width: 820px; margin: 24px auto; padding: 16px; } .employee { margin-top: 40px; } }
  @media print { .toolbar { display: none; } }
`;

export function buildMonthlyAttendancePrintHtml(input: MonthlyAttendancePrintInput) {
  const { year, month, employees, businessDateSet, generatedAt = new Date() } = input;
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('출력할 연월을 확인해 주세요.');
  }
  if (!employees.length) throw new Error('출력할 구성원이 없습니다.');
  const start = new Date(year, month - 1, 1);
  const dates = eachDayOfInterval({ start, end: endOfMonth(start) }).map(day => ({ date: format(day, 'yyyy-MM-dd'), day }));
  const first = dates[0].date;
  const last = dates[dates.length - 1].date;
  const records = input.records.filter(row => row.date >= first && row.date <= last);
  const today = koreanDate(generatedAt);
  const title = `근태기록_${year}-${String(month).padStart(2, '0')}_${employees.length === 1 ? employees[0].name || '구성원' : '전체'}`;
  const incomplete = (id: string) => records.filter(row => row.user_id === id && isIncomplete(row)).length;

  // React escapes all employee names and stored status values; no raw record HTML.
  return '<!doctype html>' + renderToStaticMarkup(<html lang="ko">
    <head><meta charSet="utf-8" /><meta name="referrer" content="no-referrer" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title><style dangerouslySetInnerHTML={{ __html: printCss }} /></head>
    <body>
      <div className="toolbar"><button id="attendance-print-button" type="button">PDF 저장 / 인쇄</button>
        <p>인쇄창에서 대상을 ‘PDF로 저장’으로 선택하세요. 머리글·바닥글을 끄면 주소 없이 저장됩니다.</p></div>
      <main>
        <section aria-label="월별 근태 요약">
          <h1>{year}년 {month}월 근태 기록</h1>
          <p className="meta">ACBANK · {first} ~ {last} · 대상 {employees.length}명 · 한국시간 기준</p>
          <p className="meta">출력 시각: {today} {clock.format(generatedAt)} · 조회 시점의 저장 기록</p>
          <table><thead><tr><th scope="col">이름</th><th scope="col">부서</th><th scope="col" className="number">출퇴근 완료일</th><th scope="col" className="number">근무시간(h)</th><th scope="col" className="number">지각(건)</th><th scope="col" className="number">미완료(건)</th></tr></thead>
            <tbody>{employees.map(employee => <tr key={employee.id}><th scope="row">{employee.name || '이름 미등록'}</th><td>{employee.department}</td>
              <td className="number">{employee.workDays}</td><td className="number">{employee.totalHours}</td><td className="number">{employee.lateDays}</td><td className="number">{incomplete(employee.id)}</td></tr>)}</tbody></table>
          <p className="note">근무시간은 기존 월별 리포트와 동일하게 출퇴근이 모두 저장된 기록만 합산합니다. 미완료 기록은 확인이 필요합니다.<br />
            ‘기록 없음’은 결근 판정이 아닙니다. 휴가에는 승인 상태만 표시하며, 대기·반려·취소된 휴가는 제외합니다.<br />
            휴가 사유, 위치, 연락처 등은 포함하지 않습니다. 구성원의 개인정보가 포함된 문서이므로 보관·공유에 유의해 주세요.</p>
        </section>
        {employees.map((employee, index) => {
          const employeeRecords = records.filter(row => row.user_id === employee.id);
          return <section className="employee" key={employee.id} aria-label="직원별 일자 기록">
            <header><p className="meta">ACBANK · {year}년 {month}월 · 구성원 {index + 1} / {employees.length}</p>
              <h2>{employee.name || '이름 미등록'} <small>· {employee.department}</small></h2>
              <p className="metrics">출퇴근 완료 {employee.workDays}일 · 근무 {employee.totalHours}h · 지각 {employee.lateDays}건 · 미완료 {incomplete(employee.id)}건</p></header>
            <table className="daily"><colgroup><col style={{ width: '14%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '16%' }} /></colgroup>
              <thead><tr><th scope="col">일자</th><th scope="col">출근</th><th scope="col">퇴근</th><th scope="col" className="number">근무(h)</th><th scope="col">상태</th><th scope="col">휴가</th></tr></thead>
              <tbody>{dates.flatMap(({ date, day }) => {
                const dayRecords = employeeRecords.filter(row => row.date === date);
                const leave = businessDateSet.has(date) ? [...new Set(input.leaveRequests.filter(row => row.user_id === employee.id && row.status === 'approved' && row.start_date <= date && row.end_date >= date)
                  .map(row => row.leave_type === 'half_am' ? '오전 반차' : row.leave_type === 'half_pm' ? '오후 반차' : '승인 휴가'))].join(', ') : '';
                return (dayRecords.length ? dayRecords : [null]).map((row, rowIndex) => {
                  const state = row ? [statusLabels[row.status] || row.status, isIncomplete(row) ? row.check_in ? '미퇴근' : '출근 누락' : ''].filter(Boolean).join(' · ')
                    : isWeekend(day) ? '주말' : !businessDateSet.has(date) ? '회사 휴일' : leave ? '휴가' : date > today ? '예정' : '기록 없음';
                  return <tr key={date + ':' + rowIndex}><th scope="row">{format(day, 'MM/dd')} ({'일월화수목금토'[day.getDay()]})</th>
                    <td>{timeLabel(row?.check_in || null, date)}</td><td>{timeLabel(row?.check_out || null, date)}</td>
                    <td className="number">{row?.check_in && row.check_out && row.work_hours !== null ? Number(row.work_hours).toFixed(1) : '-'}</td><td>{state}</td><td>{leave || '-'}</td></tr>;
                });
              })}</tbody></table>
            <p className="note">시간은 한국시간입니다. 근태 일자와 다른 날짜에 출퇴근한 경우 월/일을 함께 표시합니다.</p>
          </section>;
        })}
      </main>
    </body>
  </html>);
}

export async function printMonthlyAttendanceReport(input: MonthlyAttendancePrintInput) {
  const html = buildMonthlyAttendancePrintHtml(input);
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요.');
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  const print = () => { if (!printWindow.closed) { printWindow.focus(); printWindow.print(); } };
  printWindow.document.getElementById('attendance-print-button')?.addEventListener('click', print);
  await printWindow.document.fonts.ready;
  print();
}
