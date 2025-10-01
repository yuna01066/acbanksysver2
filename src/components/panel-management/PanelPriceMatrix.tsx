import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, X, Pencil, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CASTING_QUALITIES } from '@/types/calculator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PanelPriceMatrixProps {
  qualityId: string;
  productName: string;
  onBack: () => void;
}

interface PanelSizeWithPrice {
  id: string;
  size_name: string;
  thickness: string;
  panel_master_id: string;
  is_active: boolean;
  price?: number;
  priceId?: string;
}

export function PanelPriceMatrix({ qualityId, productName, onBack }: PanelPriceMatrixProps) {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');

  // Get available thicknesses for this quality
  const quality = CASTING_QUALITIES.find(q => q.id === qualityId);
  const thicknesses = quality?.thicknesses || [];

  // Fetch panel master for this quality
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
    }
  });

  // Fetch all panel sizes and prices for this quality (including inactive ones)
  const { data: panelData, isLoading } = useQuery({
    queryKey: ['panel-matrix', qualityId],
    queryFn: async () => {
      if (!panelMaster?.id) return [];

      const { data, error } = await supabase
        .from('panel_sizes')
        .select(`
          id,
          size_name,
          thickness,
          panel_master_id,
          is_active,
          panel_prices (
            id,
            price,
            effective_from,
            effective_to
          )
        `)
        .eq('panel_master_id', panelMaster.id)
        .order('thickness')
        .order('size_name');
      
      if (error) throw error;

      // Transform data to include current price
      return data.map(ps => ({
        id: ps.id,
        size_name: ps.size_name,
        thickness: ps.thickness,
        panel_master_id: ps.panel_master_id,
        is_active: ps.is_active,
        price: ps.panel_prices?.find(p => !p.effective_to)?.price,
        priceId: ps.panel_prices?.find(p => !p.effective_to)?.id
      })) as PanelSizeWithPrice[];
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

  // Save or update price mutation
  const savePriceMutation = useMutation({
    mutationFn: async ({ panelSizeId, price, existingPriceId }: { 
      panelSizeId: string; 
      price: number;
      existingPriceId?: string;
    }) => {
      if (existingPriceId) {
        // Update existing price by setting effective_to and creating new one
        const now = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('panel_prices')
          .update({ effective_to: now })
          .eq('id', existingPriceId);

        if (updateError) throw updateError;
      }

      // Insert new price
      const { error: insertError } = await supabase
        .from('panel_prices')
        .insert({
          panel_size_id: panelSizeId,
          price: price,
          effective_from: new Date().toISOString()
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-matrix'] });
      toast.success('가격이 저장되었습니다');
      setEditingCell(null);
      setEditingPrice('');
    },
    onError: (error) => {
      toast.error(`가격 저장 실패: ${error.message}`);
    }
  });

  // Create missing panel size
  const createPanelSizeMutation = useMutation({
    mutationFn: async ({ thickness, sizeName }: { thickness: string; sizeName: string }) => {
      if (!panelMaster?.id) throw new Error('Panel master not found');

      // Get actual dimensions from quality.sizes if available
      const sizeInfo = quality?.sizes.find(s => s === sizeName);
      
      const { error } = await supabase
        .from('panel_sizes')
        .insert({
          panel_master_id: panelMaster.id,
          thickness,
          size_name: sizeName,
          actual_width: 1000, // Default values - should be updated
          actual_height: 1000,
          is_active: true
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-matrix'] });
      toast.success('사이즈가 추가되었습니다');
    },
    onError: (error) => {
      toast.error(`사이즈 추가 실패: ${error.message}`);
    }
  });

  const getCellKey = (thickness: string, sizeName: string) => `${thickness}-${sizeName}`;

  const getCellData = (thickness: string, sizeName: string): PanelSizeWithPrice | undefined => {
    return panelData?.find(p => p.thickness === thickness && p.size_name === sizeName);
  };

  const handleEditStart = (thickness: string, sizeName: string, currentPrice?: number) => {
    const key = getCellKey(thickness, sizeName);
    setEditingCell(key);
    setEditingPrice(currentPrice?.toString() || '');
  };

  const handleEditSave = async (thickness: string, sizeName: string) => {
    const price = parseFloat(editingPrice);
    if (isNaN(price) || price < 0) {
      toast.error('올바른 가격을 입력해주세요');
      return;
    }

    const cellData = getCellData(thickness, sizeName);
    
    if (!cellData) {
      // Need to create panel_size first
      toast.info('사이즈를 먼저 생성합니다...');
      await createPanelSizeMutation.mutateAsync({ thickness, sizeName });
      
      // Refetch to get the new panel_size_id
      await queryClient.invalidateQueries({ queryKey: ['panel-matrix'] });
      
      // Now try again with the new data
      const updatedData = queryClient.getQueryData<PanelSizeWithPrice[]>(['panel-matrix', qualityId]);
      const newCellData = updatedData?.find(p => p.thickness === thickness && p.size_name === sizeName);
      
      if (newCellData) {
        savePriceMutation.mutate({ 
          panelSizeId: newCellData.id, 
          price 
        });
      }
    } else {
      savePriceMutation.mutate({ 
        panelSizeId: cellData.id, 
        price,
        existingPriceId: cellData.priceId
      });
    }
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditingPrice('');
  };

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ 
      panelSizeId, 
      isActive 
    }: { 
      panelSizeId: string;
      isActive: boolean;
    }) => {
      console.log('Mutation function executing (PriceMatrix):', { panelSizeId, isActive });
      
      const { data, error } = await supabase
        .from('panel_sizes')
        .update({ is_active: isActive })
        .eq('id', panelSizeId)
        .select();

      console.log('Mutation result (PriceMatrix):', { data, error });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('Mutation success (PriceMatrix):', data);
      queryClient.invalidateQueries({ queryKey: ['panel-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['panel-size-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['active-panel-sizes'] });
      queryClient.invalidateQueries({ queryKey: ['active-panel-sizes-yield'] });
      toast.success('상태가 변경되었습니다');
    },
    onError: (error) => {
      console.error('Mutation error (PriceMatrix):', error);
      toast.error(`상태 변경 실패: ${error.message}`);
    }
  });

  const handleToggleActive = async (thickness: string, sizeName: string) => {
    const cellData = getCellData(thickness, sizeName);
    
    console.log('Toggle active clicked (PriceMatrix):', { thickness, sizeName, cellData });
    
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
            <CardTitle>{productName} - 가격 매트릭스</CardTitle>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          두께 x 사이즈 조합별 가격을 관리합니다. 빈 셀을 클릭하여 가격을 입력하세요.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 sticky left-0 bg-background z-10">두께</TableHead>
                {availableSizes.map(size => (
                  <TableHead key={size} className="text-center min-w-[120px]">
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
                    const hasPrice = cellData?.price !== undefined && cellData?.price !== null;

                    return (
                      <TableCell key={cellKey} className={`text-center relative group ${!cellData?.is_active ? 'bg-muted/30' : ''}`}>
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              className="w-24 h-8 text-sm"
                              placeholder="가격"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleEditSave(thickness, sizeName);
                                } else if (e.key === 'Escape') {
                                  handleEditCancel();
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditSave(thickness, sizeName)}
                              disabled={savePriceMutation.isPending}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleEditCancel}
                              disabled={savePriceMutation.isPending}
                              className="h-8 w-8 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div 
                              className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors min-h-[32px] flex items-center justify-center"
                              onClick={() => handleEditStart(thickness, sizeName, cellData?.price)}
                            >
                              {hasPrice ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm ${!cellData?.is_active ? 'line-through text-muted-foreground' : ''}`}>
                                      ₩{cellData.price?.toLocaleString()}
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
                            {cellData && (
                              <Button
                                size="sm"
                                variant={cellData.is_active ? "outline" : "default"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(thickness, sizeName);
                                }}
                                disabled={toggleActiveMutation.isPending}
                                className="h-6 text-xs"
                              >
                                {cellData.is_active ? '비활성화' : '활성화'}
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
}
