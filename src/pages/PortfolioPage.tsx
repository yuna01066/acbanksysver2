import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PortfolioGallery from '@/components/exhibition/PortfolioGallery';

const PortfolioPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
              <Images className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">포트폴리오</h1>
              <p className="text-sm text-muted-foreground">인테리어 및 제작가공 사진을 검색하고 확대해 확인합니다.</p>
            </div>
          </div>
        </div>

        <PortfolioGallery />
      </div>
    </div>
  );
};

export default PortfolioPage;
