import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Pencil, Check, X } from 'lucide-react';
import { CASTING_QUALITIES } from '@/types/calculator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ThicknessPriceManagerProps {
  qualityId: string;
  sizeId: string;
  sizeName: string;
  productName: string;
  onBack: () => void;
}

export function ThicknessPriceManager({ qualityId, sizeId, sizeName, productName, onBack }: ThicknessPriceManagerProps) {
  const queryClient = useQueryClient();
  const [editingThickness, setEditingThickness] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');

  // Use CASTING_QUALITIES from calculator as the source of truth
  const quality = CASTING_QUALITIES.find(q => q.id === qualityId);
  const thicknesses = quality?.thicknesses || [];

  // Fetch panel sizes with their prices for this size
  const { data: panelSizes } = useQuery({
    queryKey: ['panel-sizes-with-prices', sizeId, sizeName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select(`
          id,
          thickness,
          panel_prices (
            id,
            price,
            effective_from,
            effective_to
          )
        `)
        .eq('size_name', sizeName)
        .eq('is_active', true)
        .is('panel_prices.effective_to', null);
      
      if (error) throw error;
      return data;
    }
  });

  // Create or update price mutation
  const savePriceMutation = useMutation({
    mutationFn: async ({ thickness, price }: { thickness: string; price: number }) => {
      // Find the panel_size for this thickness and sizeName
      const panelSize = panelSizes?.find(ps => ps.thickness === thickness);
      
      if (!panelSize) {
        throw new Error('Panel size not found');
      }

      // Check if there's an existing active price
      const existingPrice = panelSize.panel_prices?.[0];

      if (existingPrice) {
        // Update existing price by setting effective_to and creating new one
        const now = new Date().toISOString();
        
        // Set effective_to on old price
        const { error: updateError } = await supabase
          .from('panel_prices')
          .update({ effective_to: now })
          .eq('id', existingPrice.id);

        if (updateError) throw updateError;
      }

      // Insert new price
      const { error: insertError } = await supabase
        .from('panel_prices')
        .insert({
          panel_size_id: panelSize.id,
          price: price,
          effective_from: new Date().toISOString()
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-sizes-with-prices'] });
      toast.success('가격이 저장되었습니다');
      setEditingThickness(null);
      setEditingPrice('');
    },
    onError: (error) => {
      toast.error(`가격 저장 실패: ${error.message}`);
    }
  });

  const handleEditStart = (thickness: string, currentPrice?: number) => {
    setEditingThickness(thickness);
    setEditingPrice(currentPrice?.toString() || '');
  };

  const handleEditSave = (thickness: string) => {
    const price = parseFloat(editingPrice);
    if (isNaN(price) || price < 0) {
      toast.error('올바른 가격을 입력해주세요');
      return;
    }
    savePriceMutation.mutate({ thickness, price });
  };

  const handleEditCancel = () => {
    setEditingThickness(null);
    setEditingPrice('');
  };

  const getPriceForThickness = (thickness: string) => {
    const panelSize = panelSizes?.find(ps => ps.thickness === thickness);
    return panelSize?.panel_prices?.[0]?.price;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={onBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{productName} - {sizeName} - 두께별 가격</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>두께</TableHead>
              <TableHead>가격 (원)</TableHead>
              <TableHead className="w-[100px]">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {thicknesses.map((thickness) => {
              const currentPrice = getPriceForThickness(thickness);
              const isEditing = editingThickness === thickness;

              return (
                <TableRow key={thickness}>
                  <TableCell className="font-medium">{thickness}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editingPrice}
                        onChange={(e) => setEditingPrice(e.target.value)}
                        className="w-32"
                        placeholder="가격 입력"
                        autoFocus
                      />
                    ) : (
                      <span>{currentPrice ? `₩${currentPrice.toLocaleString()}` : '-'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditSave(thickness)}
                          disabled={savePriceMutation.isPending}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditCancel}
                          disabled={savePriceMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditStart(thickness, currentPrice)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {thicknesses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            두께 정보가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
