import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelMasterList } from "@/components/panel-management/PanelMasterList";
import { PanelSizeManager } from "@/components/panel-management/PanelSizeManager";
import { PanelPriceManager } from "@/components/panel-management/PanelPriceManager";

const PanelManagementPage = () => {
  const navigate = useNavigate();
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);

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
              원판 사이즈, 두께, 가격을 관리합니다. 여기서 설정한 정보는 견적 계산기와 수율 계산기에서 공유됩니다.
            </p>
          </div>

          <Tabs defaultValue="masters" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="masters">원판 마스터</TabsTrigger>
              <TabsTrigger value="sizes" disabled={!selectedMasterId}>
                사이즈 관리 {selectedMasterId && '✓'}
              </TabsTrigger>
              <TabsTrigger value="prices" disabled={!selectedMasterId}>
                가격 관리 {selectedMasterId && '✓'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="masters" className="mt-6">
              <PanelMasterList 
                onSelectMaster={setSelectedMasterId}
                selectedMasterId={selectedMasterId}
              />
            </TabsContent>

            <TabsContent value="sizes" className="mt-6">
              {selectedMasterId && (
                <PanelSizeManager masterId={selectedMasterId} />
              )}
            </TabsContent>

            <TabsContent value="prices" className="mt-6">
              {selectedMasterId && (
                <PanelPriceManager masterId={selectedMasterId} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PanelManagementPage;
