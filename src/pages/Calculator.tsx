import { useSearchParams } from 'react-router-dom';
import CalculatorWidget from "@/components/CalculatorWidget";
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Calculator as CalculatorIcon, Home, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Calculator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') as 'quote' | 'yield' | null;
  const title = type === 'yield' ? '수율 계산기' : type === 'quote' ? '견적 계산기' : '계산기';

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow="Calculator"
        title={title}
        description="원판 수율과 판재 견적을 동일한 기준으로 계산합니다."
        icon={<CalculatorIcon className="h-5 w-5" />}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <Home className="h-4 w-4" />
              홈
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin-settings')}>
              <Settings className="h-4 w-4" />
              관리자 설정
            </Button>
          </>
        )}
      />
      <CalculatorWidget initialType={type} />
    </PageShell>
  );
};

export default Calculator;
