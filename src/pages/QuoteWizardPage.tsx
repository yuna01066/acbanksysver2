import { useNavigate } from 'react-router-dom';
import { WandSparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import QuoteWizardPanel from '@/components/QuoteWizardPanel';

const QuoteWizardPage = () => {
  const navigate = useNavigate();

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Quote Wizard"
        title="견적 마법사"
        description="관리자용 보조 화면입니다. 일반 사용자는 햄찌 위젯에서 견적 마법사를 사용합니다."
        icon={<WandSparkles className="h-5 w-5" />}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/calculator?type=quote')}>
            기존 견적 계산기
          </Button>
        )}
        meta={(
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            24시간 임시 저장
          </Badge>
        )}
      />

      <QuoteWizardPanel />
    </PageShell>
  );
};

export default QuoteWizardPage;
