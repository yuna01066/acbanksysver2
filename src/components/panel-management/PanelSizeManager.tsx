import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from "@/components/ui/badge";
import { CASTING_QUALITIES } from '@/types/calculator';

interface PanelSizeWithDimensions {
  id: string;
  size_name: string;
  thickness: string;
  panel_master_id: string;
  actual_width?: number;
  actual_height?: number;
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
  
  // Get available thicknesses and sizes for this quality
  const quality = CASTING_QUALITIES.find(q => q.id === qualityId);
  const thicknesses = quality?.thicknesses || [];
  
  // Get panel master by quality
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
    enabled: !!qualityId
  });

  // Fetch all panel sizes for this quality (including inactive ones for management)
  const { data: panelData, isLoading } = useQuery({
    queryKey: ['panel-size-matrix', qualityId],
    queryFn: async () => {
      if (!panelMaster?.id) return [];

      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', panelMaster.id)
        .order('thickness')
        .order('size_name');
      
      if (error) throw error;
      return data as PanelSizeWithDimensions[];
    },
    enabled: !!panelMaster?.id
  });

  // Get available sizes from quality definition and sort by custom order
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

  // Create or update panel size mutation
  const saveSizeMutation = useMutation({
    mutationFn: async ({ 
      panelSizeId, 
      thickness,
      sizeName,
      width, 
      height 
    }: { 
      panelSizeId?: string;
      thickness: string;
      sizeName: string;
      width: number;
      height: number;
    }) => {
      if (panelSizeId) {
        // Update existing size
        const { error } = await supabase
          .from('panel_sizes')
          .update({ 
            actual_width: width,
            actual_height: height
          })
          .eq('id', panelSizeId);

        if (error) throw error;
      } else {
        // Create new size
        if (!panelMaster?.id) throw new Error('Panel master not found');
        
        const { error } = await supabase
          .from('panel_sizes')
          .insert({
            panel_master_id: panelMaster.id,
            thickness,
            size_name: sizeName,
            actual_width: width,
            actual_height: height,
            is_active: true
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-size-matrix'] });
      toast.success('사이즈가 저장되었습니다');
      setEditingCell(null);
      setEditingWidth('');
      setEditingHeight('');
    },
    onError: (error) => {
      toast.error(`사이즈 저장 실패: ${error.message}`);
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ 
      panelSizeId, 
      isActive 
    }: { 
      panelSizeId: string;
      isActive: boolean;
    }) => {
      console.log('Mutation function executing:', { panelSizeId, isActive });
      
      const { data, error } = await supabase
        .from('panel_sizes')
        .update({ is_active: isActive })
        .eq('id', panelSizeId)
        .select();

      console.log('Mutation result:', { data, error });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('Mutation success:', data);
      queryClient.invalidateQueries({ queryKey: ['panel-size-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['panel-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['active-panel-sizes'] });
      queryClient.invalidateQueries({ queryKey: ['active-panel-sizes-yield'] });
      toast.success('상태가 변경되었습니다');
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error(`상태 변경 실패: ${error.message}`);
    }
  });

  const getCellKey = (thickness: string, sizeName: string) => `${thickness}-${sizeName}`;

  const getCellData = (thickness: string, sizeName: string): PanelSizeWithDimensions | undefined => {
    return panelData?.find(p => p.thickness === thickness && p.size_name === sizeName);
  };

  const handleEditStart = (thickness: string, sizeName: string, currentWidth?: number, currentHeight?: number) => {
    const key = getCellKey(thickness, sizeName);
    setEditingCell(key);
    setEditingWidth(currentWidth?.toString() || '');
    setEditingHeight(currentHeight?.toString() || '');
  };

  const handleEditSave = async (thickness: string, sizeName: string) => {
    const width = parseFloat(editingWidth);
    const height = parseFloat(editingHeight);
    
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
      height
    });
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditingWidth('');
    setEditingHeight('');
  };

  const handleToggleActive = async (thickness: string, sizeName: string) => {
    const cellData = getCellData(thickness, sizeName);
    
    console.log('Toggle active clicked:', { thickness, sizeName, cellData });
    
    if (!cellData?.id) {
      console.error('No cellData.id found');
      toast.error('사이즈 데이터를 먼저 입력해주세요');
      return;
    }

    console.log('Executing toggle mutation:', {
      panelSizeId: cellData.id,
      currentState: cellData.is_active,
      newState: !cellData.is_active
    });

    toggleActiveMutation.mutate({
      panelSizeId: cellData.id,
      isActive: !cellData.is_active
    });
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
            <CardTitle>{qualityName} - 사이즈 매트릭스</CardTitle>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          두께 x 사이즈 조합별 실제 치수(mm)를 관리합니다. 빈 셀을 클릭하여 치수를 입력하세요.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 sticky left-0 bg-background z-10">두께</TableHead>
                {availableSizes.map(size => (
                  <TableHead key={size} className="text-center min-w-[160px]">
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
                      <TableCell key={cellKey} className={`text-center relative group ${!cellData?.is_active ? 'bg-muted/30' : ''}`}>
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 justify-center">
                              <Input
                                type="number"
                                value={editingWidth}
                                onChange={(e) => setEditingWidth(e.target.value)}
                                className="w-20 h-8 text-sm"
                                placeholder="가로"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleEditSave(thickness, sizeName);
                                  } else if (e.key === 'Escape') {
                                    handleEditCancel();
                                  }
                                }}
                              />
                              <span className="text-xs">×</span>
                              <Input
                                type="number"
                                value={editingHeight}
                                onChange={(e) => setEditingHeight(e.target.value)}
                                className="w-20 h-8 text-sm"
                                placeholder="세로"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleEditSave(thickness, sizeName);
                                  } else if (e.key === 'Escape') {
                                    handleEditCancel();
                                  }
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditSave(thickness, sizeName)}
                                disabled={saveSizeMutation.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleEditCancel}
                                disabled={saveSizeMutation.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div 
                              className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors min-h-[32px] flex items-center justify-center"
                              onClick={() => handleEditStart(thickness, sizeName, cellData?.actual_width, cellData?.actual_height)}
                            >
                              {hasDimensions ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm ${!cellData?.is_active ? 'line-through text-muted-foreground' : ''}`}>
                                      {cellData.actual_width} × {cellData.actual_height}mm
                                    </span>
                                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                  {cellData?.is_active ? (
                                    <Badge variant="default" className="h-4 text-[10px] px-1.5 gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      활성
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5 gap-1">
                                      <XCircle className="w-2.5 h-2.5" />
                                      비활성
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm opacity-0 group-hover:opacity-100">
                                  클릭하여 입력
                                </span>
                              )}
                            </div>
                            {hasDimensions && (
                              <Button
                                size="sm"
                                variant={cellData?.is_active ? "outline" : "default"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(thickness, sizeName);
                                }}
                                disabled={toggleActiveMutation.isPending}
                                className="h-6 text-xs"
                              >
                                {cellData?.is_active ? '비활성화' : '활성화'}
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

        {thicknesses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            두께 정보가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
