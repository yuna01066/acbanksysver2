import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Home, Package } from "lucide-react";
import { MaterialSelector } from "@/components/panel-management/MaterialSelector";
import { ProductSelector } from "@/components/panel-management/ProductSelector";
import { OptionSelector } from "@/components/panel-management/OptionSelector";
import { PanelSizeManager } from "@/components/panel-management/UnifiedSizePriceManager";
import ColorManager from "@/components/panel-management/ColorManager";
import { PageHeader, PageShell } from "@/components/layout/PageLayout";

type ViewLevel = 'material' | 'product' | 'option' | 'size' | 'color';
type ManagementOption = 'size' | 'color';

const PanelManagementPage = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewLevel>('material');
  const [selectedMaterial, setSelectedMaterial] = useState<{ id: string; name: string } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [selectedOption, setSelectedOption] = useState<ManagementOption | null>(null);

  const handleSelectMaterial = (id: string, name: string) => {
    setSelectedMaterial({ id, name });
    setCurrentView('product');
  };

  const handleSelectProduct = (id: string, name: string) => {
    setSelectedProduct({ id, name });
    setCurrentView('option');
  };

  const handleSelectOption = (option: ManagementOption) => {
    setSelectedOption(option);
    setCurrentView(option);
  };

  const handleBackToMaterials = () => {
    setSelectedMaterial(null);
    setSelectedProduct(null);
    setSelectedOption(null);
    setCurrentView('material');
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
    setSelectedOption(null);
    setCurrentView('product');
  };

  const handleBackToOptions = () => {
    setSelectedOption(null);
    setCurrentView('option');
  };

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Panel Master"
        title="원판 관리"
        description="소재와 재질을 선택한 뒤 사이즈, 가격, 컬러 기준을 관리합니다."
        icon={<Package className="h-5 w-5" />}
        meta={(
          <>
            {selectedMaterial && <Badge variant="secondary">{selectedMaterial.name}</Badge>}
            {selectedProduct && <Badge variant="secondary">{selectedProduct.name}</Badge>}
            {selectedOption && <Badge variant="outline">{selectedOption === 'size' ? '사이즈/가격' : '컬러'}</Badge>}
          </>
        )}
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

      <div className="space-y-6">
        {currentView === 'material' && (
          <MaterialSelector
            onSelectMaterial={handleSelectMaterial}
            selectedMaterialId={selectedMaterial?.id || null}
          />
        )}

        {currentView === 'product' && selectedMaterial && (
          <ProductSelector
            materialId={selectedMaterial.id}
            materialName={selectedMaterial.name}
            onSelectProduct={handleSelectProduct}
            onBack={handleBackToMaterials}
            selectedProductId={selectedProduct?.id || null}
          />
        )}

        {currentView === 'option' && selectedProduct && (
          <OptionSelector
            materialName={`${selectedMaterial?.name} - ${selectedProduct.name}`}
            onSelectOption={handleSelectOption}
            onBack={handleBackToProducts}
          />
        )}

        {currentView === 'size' && selectedProduct && (
          <PanelSizeManager
            qualityId={selectedProduct.id}
            qualityName={selectedProduct.name}
            onBack={handleBackToOptions}
          />
        )}

        {currentView === 'color' && selectedProduct && selectedMaterial && (
          <div className="space-y-4">
            <Button 
              variant="outline" 
              onClick={handleBackToOptions}
              className="flex items-center gap-2"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4" />
              옵션 선택으로 돌아가기
            </Button>
            <ColorManager qualityId={selectedProduct.id} />
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default PanelManagementPage;
