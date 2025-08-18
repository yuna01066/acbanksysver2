
import React from 'react';
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PriceManagerHeaderProps {
  onLoadGlossyColorPrices: () => void;
  onLoadAstelColorPrices: () => void;
  onLoadGlossyStandardPrices: () => void;
  onExportPricing: () => void;
}

const PriceManagerHeader: React.FC<PriceManagerHeaderProps> = ({
  onLoadGlossyColorPrices,
  onLoadAstelColorPrices,
  onLoadGlossyStandardPrices,
  onExportPricing
}) => {
  return (
    <CardHeader>
      <CardTitle className="flex justify-between items-center">
        <span>가격 관리</span>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={onLoadGlossyColorPrices} variant="secondary">
            유광 색상판 가격 로드
          </Button>
          <Button onClick={onLoadAstelColorPrices} variant="secondary">
            아스텔 색상판 가격 로드
          </Button>
          <Button onClick={onLoadGlossyStandardPrices} variant="secondary">
            유광 보급판 가격 로드
          </Button>
          <Button onClick={onExportPricing} variant="outline">
            가격 데이터 내보내기
          </Button>
        </div>
      </CardTitle>
    </CardHeader>
  );
};

export default PriceManagerHeader;
