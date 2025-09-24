
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { PricingData } from "@/types/pricing";
import { generateAllCombinations } from "@/utils/priceCombinations";
import { 
  initializeGlossyColorPrices, 
  initializeAstelColorPrices, 
  initializeGlossyStandardPrices,
  initializeSatinColorPrices,
  exportPricingData 
} from "@/utils/priceCalculations";
import PriceManagerHeader from "./PriceManagerHeader";
import PriceManagerInstructions from "./PriceManagerInstructions";
import PriceTable from "./PriceTable";
import PriceManagerSummary from "./PriceManagerSummary";

const PriceManager = () => {
  const [pricingData, setPricingData] = useState<PricingData>({});
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingPrice, setEditingPrice] = useState<string>('');

  const combinations = generateAllCombinations();

  const handleLoadGlossyColorPrices = () => {
    const glossyPrices = initializeGlossyColorPrices();
    setPricingData(prev => ({ ...prev, ...glossyPrices }));
  };

  const handleLoadAstelColorPrices = () => {
    const astelPrices = initializeAstelColorPrices();
    setPricingData(prev => ({ ...prev, ...astelPrices }));
  };

  const handleLoadGlossyStandardPrices = () => {
    const glossyStandardPrices = initializeGlossyStandardPrices();
    setPricingData(prev => ({ ...prev, ...glossyStandardPrices }));
  };

  const handleLoadSatinColorPrices = () => {
    const satinPrices = initializeSatinColorPrices();
    setPricingData(prev => ({ ...prev, ...satinPrices }));
  };

  const handleExportPricing = () => {
    exportPricingData(pricingData);
  };

  const handlePriceEdit = (key: string, currentPrice: number) => {
    setEditingKey(key);
    setEditingPrice(currentPrice.toString());
  };

  const handlePriceSave = () => {
    if (editingKey && editingPrice) {
      const price = parseFloat(editingPrice.replace(/[^0-9.]/g, ''));
      if (!isNaN(price)) {
        setPricingData(prev => ({
          ...prev,
          [editingKey]: price
        }));
      }
    }
    setEditingKey('');
    setEditingPrice('');
  };

  const handlePriceCancel = () => {
    setEditingKey('');
    setEditingPrice('');
  };

  useEffect(() => {
    // 컴포넌트 마운트 시 모든 가격 데이터 자동 로드
    handleLoadGlossyColorPrices();
    handleLoadAstelColorPrices();
    handleLoadGlossyStandardPrices();
    handleLoadSatinColorPrices();
  }, []);

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <PriceManagerHeader
        onLoadGlossyColorPrices={handleLoadGlossyColorPrices}
        onLoadAstelColorPrices={handleLoadAstelColorPrices}
        onLoadGlossyStandardPrices={handleLoadGlossyStandardPrices}
        onLoadSatinColorPrices={handleLoadSatinColorPrices}
        onExportPricing={handleExportPricing}
      />
      <CardContent>
        <PriceManagerInstructions />
        
        <PriceTable
          combinations={combinations}
          pricingData={pricingData}
          editingKey={editingKey}
          editingPrice={editingPrice}
          onEditStart={handlePriceEdit}
          onEditChange={setEditingPrice}
          onEditSave={handlePriceSave}
          onEditCancel={handlePriceCancel}
        />

        <PriceManagerSummary
          totalCombinations={combinations.length}
          setPrices={Object.keys(pricingData).length}
        />
      </CardContent>
    </Card>
  );
};

export default PriceManager;
