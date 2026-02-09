import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ContractData {
  user_name: string;
  birth_date?: string | null;
  contract_date?: string;
  contract_type?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  position?: string | null;
  department?: string | null;
  work_type?: string | null;
  work_days?: string | null;
  pay_day?: number | null;
  annual_salary?: number | null;
  monthly_salary?: number | null;
  base_pay?: number | null;
  fixed_overtime_pay?: number | null;
  fixed_overtime_hours?: number | null;
  wage_basis?: string | null;
  comprehensive_wage_type?: string | null;
  comprehensive_wage_basis?: string | null;
  comprehensive_wage_hours?: number | null;
  probation_period?: string | null;
  probation_start_date?: string | null;
  probation_end_date?: string | null;
  probation_salary_rate?: number | null;
}

interface ContractPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractData | null;
  companyName?: string;
  ceoName?: string;
  templateType?: string;
}

const Highlight = ({ children }: { children: React.ReactNode }) => (
  <span className="bg-yellow-200 dark:bg-yellow-800/60 px-1 rounded font-semibold">{children}</span>
);

const RedHighlight = ({ children }: { children: React.ReactNode }) => (
  <span className="bg-red-100 dark:bg-red-900/40 text-destructive px-1 rounded font-semibold">{children}</span>
);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  try {
    return format(new Date(dateStr), 'yyyy년 MM월 dd일', { locale: ko });
  } catch {
    return dateStr;
  }
};

const formatNumber = (n?: number | null) => {
  if (!n) return '';
  return n.toLocaleString();
};

const ContractPreviewDialog: React.FC<ContractPreviewDialogProps> = ({
  open,
  onOpenChange,
  contract,
  companyName = 'ACRIVE',
  ceoName = '대표',
  templateType = '자동 근로계약서',
}) => {
  if (!contract) return null;

  const contractStartFormatted = formatDate(contract.contract_start_date);
  const contractEndFormatted = formatDate(contract.contract_end_date);
  const birthDateFormatted = formatDate(contract.birth_date);
  const contractDateFormatted = formatDate(contract.contract_date);
  const workDays = contract.work_days || '월,화,수,목,금요일';
  const workDaysList = workDays.replace('요일', '').split(',').map(d => d.trim());
  const weekdays = ['월', '화', '수', '목', '금'];
  const isIndefinite = !contract.contract_end_date;
  const hasOvertimePay = contract.fixed_overtime_pay && contract.fixed_overtime_pay > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0 flex flex-row items-center justify-between">
          <DialogTitle>계약서 미리보기</DialogTitle>
          <Select defaultValue="labor">
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="labor">자동 근로계약서</SelectItem>
              <SelectItem value="salary">자동 연봉계약서</SelectItem>
            </SelectContent>
          </Select>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="px-10 py-8 space-y-6 text-sm leading-relaxed">
            {/* Title */}
            <h1 className="text-2xl font-bold text-center mb-8">근로계약서</h1>

            {/* Preamble */}
            <p>
              <Highlight>{companyName}</Highlight> (이하 'A')와(과){' '}
              <Highlight>{contract.user_name}</Highlight> (이하 'B')은(는) 다음과 같이 근로계약을 체결하고, 이를 성실히 준수할 것을 약속하며 서명날인합니다.
            </p>

            {/* 제1조 */}
            <div>
              <h3 className="font-bold mb-1">제1조 (근로계약기간)</h3>
              {isIndefinite ? (
                <p>
                  근로계약기간은 <Highlight>{contractStartFormatted || '날짜 입력'}</Highlight> 부터 기간의 정함이 없는 근로계약을 체결하기로 한다.
                </p>
              ) : (
                <p>
                  근로계약기간은 <Highlight>{contractStartFormatted || '날짜 입력'}</Highlight> 부터{' '}
                  <Highlight>{contractEndFormatted || '날짜 입력'}</Highlight> 까지로 한다.
                </p>
              )}
            </div>

            {/* 제2조 */}
            <div>
              <h3 className="font-bold mb-1">제2조 (근무장소 및 업무)</h3>
              <p>
                'B'의 근무장소는 회사 내이며, 주요 업무는 <Highlight>{contract.position || '직무 입력'}</Highlight> 이다.
              </p>
              <p>'A'는 업무 필요 시 근무장소와 주요 업무를 변경할 수 있고 'B'는 이에 동의한다.</p>
            </div>

            {/* 제3조 */}
            <div>
              <h3 className="font-bold mb-1">제3조 (근로시간 및 휴게)</h3>
              <p>
                근로시간은 <Highlight>{contract.work_type || '고정 근무제'}</Highlight> 를 운영하는 것을 원칙으로 한다.
              </p>
              <p>'B'의 근로일 및 휴게시간은 아래와 같으며, 업무특성 또는 사업장에 따라 변경될 수 있다.</p>
              <p>'B'는 업무상 필요에 따라 연장/휴일/야간근로를 할 수 있고 이에 동의한다.</p>

              <div className="my-4 border rounded overflow-hidden">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="py-2 px-3 font-medium">근로요일</th>
                      <th className="py-2 px-3 font-medium">출근시간</th>
                      <th className="py-2 px-3 font-medium">퇴근시간</th>
                      <th className="py-2 px-3 font-medium">소정근로시간</th>
                      <th className="py-2 px-3 font-medium">휴게시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekdays.map(day => (
                      <tr key={day} className="border-b last:border-0">
                        <td className="py-2 px-3">{day}요일</td>
                        <td className="py-2 px-3"><Highlight>9시</Highlight></td>
                        <td className="py-2 px-3"><Highlight>18시</Highlight></td>
                        <td className="py-2 px-3"><Highlight>8시간</Highlight></td>
                        <td className="py-2 px-3"><Highlight>12시~13시</Highlight></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 제4조 */}
            <div>
              <h3 className="font-bold mb-1">제4조 (근로일 및 휴일)</h3>
              <p>
                'B'의 근로일은 <Highlight>{workDays}</Highlight> 이며, 주휴일은 <Highlight>일요일</Highlight> 로 한다.
              </p>
              <p>근로기준법의 정함에 따라 국가가 지정한 공휴일을 휴일로 한다.</p>
            </div>

            {/* 제5조 */}
            <div>
              <h3 className="font-bold mb-1">제5조 (임금)</h3>
              <p>
                'B'의 임금은 매월 1일부터 말일까지 산정하여 <Highlight>매월 {contract.pay_day || 25}일</Highlight> 에 'B' 명의의 예금계좌로 지급한다.
              </p>
              <p>계약시간을 넘어선 별도의 근로에 대해서는 고정초과근무수당 또는 보상휴가로 지급한다.</p>
              <p>
                'B'의 연봉 은 {contract.annual_salary ? (
                  <Highlight>{formatNumber(contract.annual_salary)}원</Highlight>
                ) : (
                  <RedHighlight>계약 금액</RedHighlight>
                )} 이며, 구성항목은 다음과 같다.
              </p>

              <div className="my-4 border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="py-2 px-4 text-left font-medium w-40">구분</th>
                      <th className="py-2 px-4 text-left font-medium">금액</th>
                      <th className="py-2 px-4 text-left font-medium" colSpan={2}>고정초과근무수당</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-4">월 지급액</td>
                      <td className="py-2 px-4">
                        {contract.monthly_salary ? (
                          <Highlight>{formatNumber(contract.monthly_salary)}원</Highlight>
                        ) : (
                          <RedHighlight>월 지급액</RedHighlight>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {contract.comprehensive_wage_type !== '미포함' ? (
                          <>
                            <Highlight>{contract.comprehensive_wage_basis || '포괄임금 계약기준'}</Highlight> /
                            <Highlight>{contract.comprehensive_wage_hours || '포괄임금 고정초과근로 계약시간'}</Highlight>
                          </>
                        ) : (
                          '계약 기준'
                        )}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-4">기본급 (주휴수당포함)</td>
                      <td className="py-2 px-4">
                        {contract.base_pay ? (
                          <Highlight>{formatNumber(contract.base_pay)}원</Highlight>
                        ) : (
                          <RedHighlight>기본급</RedHighlight>
                        )}
                      </td>
                      <td className="py-2 px-4">고정초과근무 상세</td>
                      <td className="py-2 px-4">
                        {hasOvertimePay ? (
                          <Highlight>포괄임금 고정초과근로 계약항목 상세</Highlight>
                        ) : (
                          <RedHighlight>포괄임금 고정초과근로 계약항목 상세</RedHighlight>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4">고정초과근무수당</td>
                      <td className="py-2 px-4">
                        {contract.fixed_overtime_pay ? (
                          <Highlight>{formatNumber(contract.fixed_overtime_pay)}원</Highlight>
                        ) : (
                          <RedHighlight>포괄임금 고정초과근로 수당</RedHighlight>
                        )}
                      </td>
                      <td className="py-2 px-4" colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 제6조 */}
            <div>
              <h3 className="font-bold mb-1">제6조 (휴가)</h3>
              <p>연차유급휴가는 '근로기준법'의 정함에 따르며, 그 외 사항은 '취업규칙'에 의거한다.</p>
            </div>

            {/* 제7조 */}
            <div>
              <h3 className="font-bold mb-1">제7조 (비밀유지 등)</h3>
              <p>'B'는 계약기간 및 계약 종료 후에도 계약기간 없은 'A'의 영업비밀, 고객정보 및 기타 'A'가 비밀로 취급하는 모든 정보를 'A'의 사전 서면동의 없이 누설하거나 'A' 이외의 자를 위하여 사용하여서는 아니 된다.</p>
            </div>

            {/* 제8조 */}
            <div>
              <h3 className="font-bold mb-1">제8조 (손해배상)</h3>
              <p>'B'는 'A'의 영업비밀누설, 명예훼손 등 피해 시 'A'에게 모든 손해를 배상하고, 민·형사상 책임을 진다.</p>
            </div>

            {/* 제9조 */}
            <div>
              <h3 className="font-bold mb-1">제9조 (재해보상)</h3>
              <p>'B'가 업무상 재해 시 산업재해보상보험법에 따른다. 업무 외 사유로 재해 시 'A'는 책임지지 않는다.</p>
            </div>

            {/* 제10조 */}
            <div>
              <h3 className="font-bold mb-1">제10조 (기타)</h3>
              <p>'B'는 위 계약서의 내용을 충분히 숙지하여 사본을 교부받았고, 본 계약서에 정하지 않은 사항은 '근로기준법' 및 사규에 따르며 상기 모든 계약 조건의 동의 여부는 아래 'B'의 서명으로 갈음한다.</p>
            </div>

            {/* Signature Section */}
            <div className="mt-10 pt-6 border-t">
              <div className="text-center mb-8">
                <Highlight>{contractDateFormatted || format(new Date(), 'yyyy년 MM월 dd일', { locale: ko })}</Highlight>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Company Side (A) */}
                <div className="text-center space-y-3">
                  <div className="flex justify-between px-4">
                    <span className="text-muted-foreground">회사명(A)</span>
                    <span className="font-semibold">{companyName}</span>
                  </div>
                  <div className="flex justify-between px-4">
                    <span className="text-muted-foreground">직위 / 성명(A)</span>
                    <span className="font-semibold">대표 / {ceoName}</span>
                  </div>
                  <div className="flex justify-center py-4">
                    <div className="w-16 h-16 rounded-full border-2 border-destructive flex items-center justify-center text-destructive text-xs font-bold rotate-[-15deg]">
                      대표<br/>이사
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">서명(인)</p>
                </div>

                {/* Employee Side (B) */}
                <div className="text-center space-y-3">
                  <div className="flex justify-between px-4">
                    <span className="text-muted-foreground">생년월일(B)</span>
                    <span className="font-semibold">
                      {birthDateFormatted ? (
                        <Highlight>{birthDateFormatted}</Highlight>
                      ) : (
                        <RedHighlight>날짜 입력</RedHighlight>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between px-4">
                    <span className="text-muted-foreground">성명(B)</span>
                    <span className="font-semibold text-decoration-line: underline">
                      {contract.user_name}
                    </span>
                  </div>
                  <div className="flex justify-center py-4">
                    <div className="w-16 h-16 rounded-full border border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground text-xs">
                      서명(인)
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">서명(인)</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ContractPreviewDialog;
