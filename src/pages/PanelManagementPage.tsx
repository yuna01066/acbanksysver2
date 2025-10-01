import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MaterialSelector } from "@/components/panel-management/MaterialSelector";
import { ProductSelector } from "@/components/panel-management/ProductSelector";
import { OptionSelector } from "@/components/panel-management/OptionSelector";
import { PanelPriceMatrix } from "@/components/panel-management/PanelPriceMatrix";
import { PanelSizeManager } from "@/components/panel-management/PanelSizeManager";

type ViewLevel = 'material' | 'product' | 'option' | 'size' | 'price';
type ManagementOption = 'size' | 'price';

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
    setCurrentView(option === 'size' ? 'size' : 'price');
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
    <div className="min-h-screen bg-background p-4">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin-settings')}
            className="flex items-center gap-2"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            관리자 설정으로 돌아가기
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">원판 관리</h1>
            <p className="text-muted-foreground mt-2">
              소재 → 재질 선택 후, 두께 x 사이즈 매트릭스로 가격을 관리합니다.
            </p>
          </div>

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

          {currentView === 'price' && selectedProduct && (
            <PanelPriceMatrix
              qualityId={selectedProduct.id}
              productName={selectedProduct.name}
              onBack={handleBackToOptions}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelManagementPage;
