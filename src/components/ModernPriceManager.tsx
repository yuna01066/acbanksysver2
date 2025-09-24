import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Upload, Edit3, Check, X, RefreshCw } from "lucide-react";
import { PricingData } from "@/types/pricing";
import { 
  initializeGlossyColorPrices, 
  initializeAstelColorPrices, 
  initializeGlossyStandardPrices,
  initializeSatinColorPrices,
  exportPricingData,
  formatPrice
} from "@/utils/priceCalculations";
import {
  glossyColorSinglePrices,
  astelColorSinglePrices,
  glossyStandardSinglePrices,
  satinColorSinglePrices
} from "@/data/glossyColorPricing";

interface PriceCardProps {
  thickness: string;
  sizeData: Record<string, number>;
  surface: string;
  onPriceEdit: (thickness: string, size: string, surface: string, price: number) => void;
}

const PriceCard: React.FC<PriceCardProps> = ({ thickness, sizeData, surface, onPriceEdit }) => {
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingPrice, setEditingPrice] = useState<string>('');

  const handleEditStart = (size: string, price: number) => {
    setEditingKey(`${thickness}-${size}`);
    setEditingPrice(price.toString());
  };

  const handleEditSave = (size: string) => {
    const price = parseFloat(editingPrice.replace(/[^0-9.]/g, ''));
    if (!isNaN(price)) {
      onPriceEdit(thickness, size, surface, price);
    }
    setEditingKey('');
    setEditingPrice('');
  };

  const handleEditCancel = () => {
    setEditingKey('');
    setEditingPrice('');
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div>
            <span>{thickness}</span>
            <div className="text-sm font-normal text-muted-foreground">{surface}</div>
          </div>
          <Badge variant="outline">{Object.keys(sizeData).length}개 사이즈</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(sizeData).map(([size, price]) => {
          const isEditing = editingKey === `${thickness}-${size}`;
          
          return (
            <div key={size} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{size}</div>
                <div className="text-sm text-muted-foreground">
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={editingPrice}
                        onChange={(e) => setEditingPrice(e.target.value)}
                        className="h-8 w-24"
                        placeholder="가격"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditSave(size)}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditCancel}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-lg">{formatPrice(price)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditStart(size, price)}
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

interface QualityTabProps {
  qualityId: string;
  qualityName: string;
  priceData: Record<string, Record<string, Record<string, number>>>;
  searchTerm: string;
  onPriceEdit: (thickness: string, size: string, surface: string, price: number) => void;
  onLoadPrices: () => void;
}

const QualityTab: React.FC<QualityTabProps> = ({ 
  qualityId, 
  qualityName, 
  priceData, 
  searchTerm, 
  onPriceEdit,
  onLoadPrices 
}) => {
  const filteredData = Object.entries(priceData).filter(([thickness]) =>
    thickness.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCards = filteredData.reduce((sum, [_, surfaceData]) => 
    sum + Object.keys(surfaceData).length, 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">{qualityName}</h3>
          <p className="text-muted-foreground">총 {totalCards}개 가격 카드 ({filteredData.length}개 두께)</p>
        </div>
        <Button onClick={onLoadPrices} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          가격 새로고침
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredData.map(([thickness, surfaceData]) => 
          Object.entries(surfaceData).map(([surface, sizeData]) => (
            <div key={`${thickness}-${surface}`} className="group">
              <PriceCard
                thickness={thickness}
                surface={surface}
                sizeData={sizeData}
                onPriceEdit={onPriceEdit}
              />
            </div>
          ))
        )}
      </div>
      
      {filteredData.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">검색 결과가 없습니다.</p>
        </div>
      )}
    </div>
  );
};

const ModernPriceManager = () => {
  const [pricingData, setPricingData] = useState<PricingData>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('glossy-color');

  // 단면 가격 데이터를 단면/양면 구조로 변환
  const convertToSurfaceStructure = (singlePrices: Record<string, Record<string, number>>) => {
    const result: Record<string, Record<string, Record<string, number>>> = {};
    
    Object.entries(singlePrices).forEach(([thickness, sizes]) => {
      result[thickness] = {
        '단면': sizes,
        '양면': Object.fromEntries(
          Object.entries(sizes).map(([size, price]) => [size, price * 2])
        )
      };
    });
    
    return result;
  };

  const qualities = [
    { id: 'glossy-color', name: '유광 색상판 (Clear)', data: convertToSurfaceStructure(glossyColorSinglePrices) },
    { id: 'astel-color', name: '아스텔 색상판 (Astel)', data: convertToSurfaceStructure(astelColorSinglePrices) },
    { id: 'glossy-standard', name: '유광 보급판 (Standard)', data: convertToSurfaceStructure(glossyStandardSinglePrices) },
    { id: 'satin-color', name: '사틴 색상판 (Bright)', data: convertToSurfaceStructure(satinColorSinglePrices) }
  ];

  const handlePriceEdit = (qualityId: string, thickness: string, size: string, surface: string, price: number) => {
    // 실제 가격 데이터 업데이트 로직
    console.log(`Price updated: ${qualityId} ${thickness} ${size} ${surface} = ${price}`);
  };

  const loadPricesByQuality = (qualityId: string) => {
    let newPrices = {};
    switch (qualityId) {
      case 'glossy-color':
        newPrices = initializeGlossyColorPrices();
        break;
      case 'astel-color':
        newPrices = initializeAstelColorPrices();
        break;
      case 'glossy-standard':
        newPrices = initializeGlossyStandardPrices();
        break;
      case 'satin-color':
        newPrices = initializeSatinColorPrices();
        break;
    }
    setPricingData(prev => ({ ...prev, ...newPrices }));
  };

  const loadAllPrices = () => {
    const allPrices = {
      ...initializeGlossyColorPrices(),
      ...initializeAstelColorPrices(),
      ...initializeGlossyStandardPrices(),
      ...initializeSatinColorPrices()
    };
    setPricingData(allPrices);
  };

  const handleExportPricing = () => {
    exportPricingData(pricingData);
  };

  useEffect(() => {
    loadAllPrices();
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6">
      {/* Apple-style header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-3xl mb-6">
          <Edit3 className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-title-1 font-display">가격 관리</h1>
        <p className="text-body text-muted-foreground max-w-2xl mx-auto">
          제품별 가격을 쉽게 관리하고 수정할 수 있는 스마트 관리 도구입니다
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-4">
        <Button onClick={loadAllPrices} variant="secondary" className="btn-apple">
          <RefreshCw className="h-4 w-4 mr-2" />
          전체 새로고침
        </Button>
        <Button onClick={handleExportPricing} className="btn-apple">
          <Download className="h-4 w-4 mr-2" />
          내보내기
        </Button>
      </div>

      {/* Apple-style search */}
      <Card className="glass shadow-apple border-0 rounded-2xl">
        <CardContent className="pt-6">
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="두께로 검색 (예: 3T, 10T)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 rounded-xl border-0 bg-muted/50 focus:bg-background transition-colors"
            />
          </div>
        </CardContent>
      </Card>

      {/* Apple-style tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-center">
          <TabsList className="glass shadow-apple border-0 rounded-2xl p-1 h-auto">
            {qualities.map((quality) => (
              <TabsTrigger 
                key={quality.id} 
                value={quality.id} 
                className="rounded-xl px-6 py-3 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                {quality.name.split(' ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {qualities.map((quality) => (
          <TabsContent key={quality.id} value={quality.id}>
            <QualityTab
              qualityId={quality.id}
              qualityName={quality.name}
              priceData={quality.data}
              searchTerm={searchTerm}
              onPriceEdit={(thickness, size, surface, price) => 
                handlePriceEdit(quality.id, thickness, size, surface, price)
              }
              onLoadPrices={() => loadPricesByQuality(quality.id)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Summary Stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{qualities.length}</div>
              <div className="text-sm text-muted-foreground">품질 종류</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {qualities.reduce((sum, q) => sum + Object.keys(q.data).length, 0)}
              </div>
              <div className="text-sm text-muted-foreground">총 두께 옵션</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {qualities.reduce((sum, q) => 
                  sum + Object.values(q.data).reduce((s, thicknessData) => 
                    s + Object.values(thicknessData).reduce((ss, sizes) => ss + Object.keys(sizes).length, 0), 0
                  ), 0
                )}
              </div>
              <div className="text-sm text-muted-foreground">총 가격 항목</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{Object.keys(pricingData).length}</div>
              <div className="text-sm text-muted-foreground">로드된 가격</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModernPriceManager;