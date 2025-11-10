import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from "@/components/ui/badge";
import { CASTING_QUALITIES } from '@/types/calculator';
import { Switch } from "@/components/ui/switch";

interface PanelSizeWithPrice {
  id: string;
  size_name: string;
  thickness: string;
  panel_master_id: string;
  actual_width?: number;
  actual_height?: number;
  price?: number;
  is_active: boolean;
}

interface PanelSizeManagerProps {
  qualityId: string;
  qualityName: string;
  onBack: () => void;
}

export const PanelSizeManager = ({ qualityId, qualityName, onBack }: PanelSizeManagerProps) => {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingWidth, setEditingWidth] = useState<string>('');
  const [editingHeight, setEditingHeight] = useState<string>('');
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [editingCost, setEditingCost] = useState<{ type: 'color' | 'adhesive', thickness: string } | null>(null);
  const [editCostValue, setEditCostValue] = useState<string>('');
  
  const quality = CASTING_QUALITIES.find(q => q.id === qualityId);
  const thicknesses = quality?.thicknesses || [];
  
  const { data: panelMaster } = useQuery({
    queryKey: ['panel-master', qualityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', qualityId as any)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: panelData, isLoading } = useQuery({
    queryKey: ['panel-size-matrix', qualityId, panelMaster?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];

      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', panelMaster.id)
        .order('thickness')
        .order('size_name');
      
      if (error) throw error;
      return data as PanelSizeWithPrice[];
    },
    enabled: !!panelMaster?.id
  });

  const { data: colorMixingData } = useQuery({
    queryKey: ['color-mixing-costs', panelMaster?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];

      const { data, error } = await supabase
        .from('color_mixing_costs')
        .select('*')
        .eq('panel_master_id', panelMaster.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!panelMaster?.id
  });

  const { data: adhesiveData } = useQuery({
    queryKey: ['adhesive-costs', panelMaster?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];

      const { data, error } = await supabase
        .from('adhesive_costs')
        .select('*')
        .eq('panel_master_id', panelMaster.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!panelMaster?.id
  });

  const sizeOrder = ['3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '4*10', '5*6', '5*8', '소3*6', '소1*2', '5*5'];
  const qualitySizes = quality?.sizes || [];
  const availableSizes = qualitySizes.sort((a, b) => {
    const indexA = sizeOrder.indexOf(a);
    const indexB = sizeOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const saveSizeMutation = useMutation({
    mutationFn: async ({ 
      panelSizeId, 
      thickness,
      sizeName,
      width, 
      height,
      price
    }: { 
      panelSizeId?: string;
      thickness: string;
      sizeName: string;
      width: number;
      height: number;
      price?: number;
    }) => {
      if (panelSizeId) {
        const { error } = await supabase
          .from('panel_sizes')
          .update({ 
            actual_width: width, 
            actual_height: height,
            price: price
          })
          .eq('id', panelSizeId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('panel_sizes')
          .insert({ 
            panel_master_id: panelMaster!.id,
            thickness,
            size_name: sizeName,
            actual_width: width,
            actual_height: height,
            price: price,
            is_active: true
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-size-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['active-panel-sizes'] });
      setEditingCell(null);
      setEditingWidth('');
      setEditingHeight('');
      setEditingPrice('');
      toast.success('저장되었습니다');
    },
    onError: (error) => {
      toast.error(`저장 실패: ${error.message}`);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ 
      panelSizeId, 
      isActive 
    }: { 
      panelSizeId: string; 
      isActive: boolean;
    }) => {
      console.log('Toggling active status:', { panelSizeId, isActive });
      
      const { data, error } = await supabase
        .from('panel_sizes')
        .update({ is_active: isActive })
        .eq('id', panelSizeId)
        .select();

      if (error) {
        console.error('Toggle error:', error);
        throw error;
      }
      
      console.log('Toggle success:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('Invalidating queries after toggle');
      // 모든 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['panel-size-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['active-panel-sizes'] });
      queryClient.invalidateQueries({ queryKey: ['panel-sizes'] });
      
      // 데이터 즉시 리페치
      queryClient.refetchQueries({ queryKey: ['panel-size-matrix', qualityId, panelMaster?.id] });
      
      toast.success('상태가 변경되었습니다');
    },
    onError: (error) => {
      console.error('Toggle mutation error:', error);
      toast.error(`상태 변경 실패: ${error.message}`);
    }
  });

  const getCellKey = (thickness: string, sizeName: string) => `${thickness}-${sizeName}`;

  const getCellData = (thickness: string, sizeName: string): PanelSizeWithPrice | undefined => {
    return panelData?.find(p => p.thickness === thickness && p.size_name === sizeName);
  };

  const handleEditStart = (thickness: string, sizeName: string, currentWidth?: number, currentHeight?: number, currentPrice?: number) => {
    const key = getCellKey(thickness, sizeName);
    setEditingCell(key);
    setEditingWidth(currentWidth?.toString() || '');
    setEditingHeight(currentHeight?.toString() || '');
    setEditingPrice(currentPrice?.toString() || '');
  };

  const handleEditSave = async (thickness: string, sizeName: string) => {
    const width = parseFloat(editingWidth);
    const height = parseFloat(editingHeight);
    const price = editingPrice ? parseFloat(editingPrice) : undefined;
    
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      toast.error('올바른 크기를 입력해주세요');
      return;
    }

    const cellData = getCellData(thickness, sizeName);
    
    saveSizeMutation.mutate({ 
      panelSizeId: cellData?.id,
      thickness,
      sizeName,
      width,
      height,
      price
    });
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditingWidth('');
    setEditingHeight('');
    setEditingPrice('');
  };

  const handleToggleActive = async (thickness: string, sizeName: string) => {
    const cellData = getCellData(thickness, sizeName);
    
    if (!cellData?.id) {
      toast.error('사이즈 데이터를 먼저 입력해주세요');
      return;
    }

    toggleActiveMutation.mutate({
      panelSizeId: cellData.id,
      isActive: !cellData.is_active
    });
  };

  const saveCostMutation = useMutation({
    mutationFn: async ({ 
      type, 
      thickness, 
      cost 
    }: { 
      type: 'color' | 'adhesive'; 
      thickness: string; 
      cost: number;
    }) => {
      const tableName = type === 'color' ? 'color_mixing_costs' : 'adhesive_costs';
      
      const { error } = await supabase
        .from(tableName)
        .upsert({
          panel_master_id: panelMaster!.id,
          thickness,
          cost,
        }, {
          onConflict: 'panel_master_id,thickness'
        });
      
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type === 'color' ? 'color-mixing-costs' : 'adhesive-costs'] });
      setEditingCost(null);
      setEditCostValue('');
      toast.success('저장되었습니다');
    },
    onError: (error) => {
      toast.error(`저장 실패: ${error.message}`);
    }
  });

  const handleSaveCost = (type: 'color' | 'adhesive', thickness: string) => {
    const cost = parseFloat(editCostValue);
    
    if (isNaN(cost) || cost < 0) {
      toast.error('올바른 금액을 입력해주세요');
      return;
    }

    saveCostMutation.mutate({ type, thickness, cost });
  };

  const handleEditCostStart = (type: 'color' | 'adhesive', thickness: string, currentCost: number = 0) => {
    setEditingCost({ type, thickness });
    setEditCostValue(currentCost.toString());
  };

  const handleEditCostCancel = () => {
    setEditingCost(null);
    setEditCostValue('');
  };

  const getColorMixingCost = (thickness: string): number => {
    const cost = colorMixingData?.find(c => c.thickness === thickness);
    return cost?.cost || 0;
  };

  const getAdhesiveCost = (thickness: string): number => {
    const cost = adhesiveData?.find(c => c.thickness === thickness);
    return cost?.cost || 0;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          로딩 중...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={onBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{qualityName} - 사이즈 / 가격 관리</CardTitle>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          두께 x 사이즈 조합별 실제 치수(mm)와 가격을 관리합니다. 셀을 클릭하여 수정하세요.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 sticky left-0 bg-background z-10">두께</TableHead>
                {availableSizes.map(size => (
                  <TableHead key={size} className="text-center min-w-[200px]">
                    {size}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {thicknesses.map(thickness => (
                <TableRow key={thickness}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10">
                    {thickness}
                  </TableCell>
                  {availableSizes.map(sizeName => {
                    const cellData = getCellData(thickness, sizeName);
                    const cellKey = getCellKey(thickness, sizeName);
                    const isEditing = editingCell === cellKey;
                    const hasDimensions = cellData?.actual_width && cellData?.actual_height;

                    return (
                      <TableCell 
                        key={cellKey} 
                        className={`text-center relative group ${!cellData?.is_active ? 'bg-muted/30' : ''}`}
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-2 p-2">
                            <div className="flex items-center gap-1 justify-center">
                              <Input
                                type="number"
                                value={editingWidth}
                                onChange={(e) => setEditingWidth(e.target.value)}
                                className="w-20 h-8 text-sm"
                                placeholder="가로"
                                autoFocus
                              />
                              <span className="text-xs">×</span>
                              <Input
                                type="number"
                                value={editingHeight}
                                onChange={(e) => setEditingHeight(e.target.value)}
                                className="w-20 h-8 text-sm"
                                placeholder="세로"
                              />
                            </div>
                            <Input
                              type="number"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              className="w-full h-8 text-sm"
                              placeholder="가격 (원)"
                            />
                            <div className="flex items-center gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditSave(thickness, sizeName)}
                                className="h-7 w-7 p-0"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleEditCancel}
                                className="h-7 w-7 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {hasDimensions ? (
                              <>
                                <div className="text-sm font-mono">
                                  {cellData.actual_width}×{cellData.actual_height}mm
                                </div>
                                {cellData.price && (
                                  <div className="text-xs font-semibold text-primary">
                                    ₩{cellData.price.toLocaleString()}
                                  </div>
                                )}
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <Switch
                                    checked={cellData.is_active}
                                    onCheckedChange={() => handleToggleActive(thickness, sizeName)}
                                    className="h-5 scale-75"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditStart(
                                      thickness, 
                                      sizeName, 
                                      cellData.actual_width, 
                                      cellData.actual_height,
                                      cellData.price
                                    )}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditStart(thickness, sizeName)}
                                className="h-16 w-full opacity-50 hover:opacity-100"
                              >
                                + 추가
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Color Mixing & Adhesive Costs */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-3">조색비 (두께별)</h4>
            <div className="space-y-2">
              {thicknesses.map(thickness => {
                const currentCost = getColorMixingCost(thickness);
                const isEditing = editingCost?.type === 'color' && editingCost?.thickness === thickness;
                
                return (
                  <div key={`color-${thickness}`} className="flex items-center justify-between p-2 border rounded bg-background">
                    <span className="font-medium text-sm">{thickness}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editCostValue}
                          onChange={(e) => setEditCostValue(e.target.value)}
                          className="w-24 h-8 text-sm"
                          placeholder="금액"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveCost('color', thickness)}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditCostCancel}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          ₩{currentCost.toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditCostStart('color', thickness, currentCost)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-3">양면 테이프 (두께별)</h4>
            <div className="space-y-2">
              {thicknesses.map(thickness => {
                const currentCost = getAdhesiveCost(thickness);
                const isEditing = editingCost?.type === 'adhesive' && editingCost?.thickness === thickness;
                
                return (
                  <div key={`adhesive-${thickness}`} className="flex items-center justify-between p-2 border rounded bg-background">
                    <span className="font-medium text-sm">{thickness}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editCostValue}
                          onChange={(e) => setEditCostValue(e.target.value)}
                          className="w-24 h-8 text-sm"
                          placeholder="금액"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveCost('adhesive', thickness)}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditCostCancel}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          ₩{currentCost.toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditCostStart('adhesive', thickness, currentCost)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">안내</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>셀을 클릭하여 사이즈와 가격을 입력할 수 있습니다</li>
            <li>스위치를 통해 각 사이즈의 활성화/비활성화를 관리할 수 있습니다</li>
            <li>비활성화된 사이즈는 계산기에 표시되지 않습니다</li>
            <li>조색비와 양면 테이프 비용은 두께별로 관리됩니다</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};