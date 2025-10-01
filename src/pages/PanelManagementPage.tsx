import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProductSelector } from "@/components/panel-management/ProductSelector";
import { SizeSelector } from "@/components/panel-management/SizeSelector";
import { ThicknessPriceManager } from "@/components/panel-management/ThicknessPriceManager";

type ViewLevel = 'product' | 'size' | 'price';

const PanelManagementPage = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewLevel>('product');
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [selectedSize, setSelectedSize] = useState<{ id: string; name: string } | null>(null);

  const handleSelectProduct = (id: string, name: string) => {
    setSelectedProduct({ id, name });
    setCurrentView('size');
  };

  const handleSelectSize = (id: string, name: string) => {
    setSelectedSize({ id, name });
    setCurrentView('price');
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
    setSelectedSize(null);
    setCurrentView('product');
  };

  const handleBackToSizes = () => {
    setSelectedSize(null);
    setCurrentView('size');
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
              제품 → 사이즈 → 두께별 가격을 단계적으로 관리합니다.
            </p>
          </div>

          {currentView === 'product' && (
            <ProductSelector
              onSelectProduct={handleSelectProduct}
              selectedProductId={selectedProduct?.id || null}
            />
          )}

          {currentView === 'size' && selectedProduct && (
            <SizeSelector
              masterId={selectedProduct.id}
              productName={selectedProduct.name}
              onSelectSize={handleSelectSize}
              onBack={handleBackToProducts}
              selectedSizeId={selectedSize?.id || null}
            />
          )}

          {currentView === 'price' && selectedProduct && selectedSize && (
            <ThicknessPriceManager
              sizeId={selectedSize.id}
              sizeName={selectedSize.name}
              productName={selectedProduct.name}
              onBack={handleBackToSizes}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelManagementPage;
