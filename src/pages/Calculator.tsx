import { useSearchParams } from 'react-router-dom';
import CalculatorWidget from "@/components/CalculatorWidget";
import QuoteDraftToolbar from "@/components/QuoteDraftToolbar";
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Calculator as CalculatorIcon, FileText, List, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Calculator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') as 'quote' | 'yield' | null;
  const calculatorType: 'quote' | 'yield' = type === 'yield' ? 'yield' : 'quote';
  const title = calculatorType === 'yield' ? '수율 계산기' : '견적 계산기';

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow="Calculator"
        title={title}
        description="원판 수율과 판재 견적을 동일한 기준으로 계산합니다."
        icon={<CalculatorIcon className="h-5 w-5" />}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/quote-drafts')}>
              <FileText className="h-4 w-4" />
              초안함
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/saved-quotes')}>
              <List className="h-4 w-4" />
              발행 견적서
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin-settings')}>
              <Settings className="h-4 w-4" />
              관리자 설정
            </Button>
          </>
        )}
      />
      {calculatorType !== 'yield' && <QuoteDraftToolbar />}
      <CalculatorWidget initialType={calculatorType} />
    </PageShell>
  );
};

export default Calculator;
