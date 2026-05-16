import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Wrench } from "lucide-react";
import ProcessingOptionsManager from "@/components/admin/ProcessingOptionsManager";
import { PageHeader, PageShell } from "@/components/layout/PageLayout";

const ProcessingPriceManagement = () => {
  const navigate = useNavigate();

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow="Processing"
        title="가공 가격 관리"
        description="가공 옵션, 배수, 단가 로직을 관리합니다."
        icon={<Wrench className="h-5 w-5" />}
        actions={(
          <>
            <Button
              variant="outline"
              onClick={() => navigate('/admin-settings')}
              size="sm"
            >
              <ArrowLeft className="w-4 h-4" />
              관리자 설정
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              size="sm"
            >
              <Home className="w-4 h-4" />
              홈
            </Button>
          </>
        )}
      />
      <ProcessingOptionsManager />
    </PageShell>
  );
};

export default ProcessingPriceManagement;
