import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, ArrowLeft, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PanelPrice {
  id: string;
  panel_size_id: string;
  price: number;
  effective_from: string;
  effective_to: string | null;
  panel_sizes: {
    thickness: string;
  };
}

interface ThicknessPriceManagerProps {
  sizeId: string;
  sizeName: string;
  productName: string;
  onBack: () => void;
}

export function ThicknessPriceManager({ sizeId, sizeName, productName, onBack }: ThicknessPriceManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  // Fetch prices for this size
  const { data: prices = [], isLoading } = useQuery({
    queryKey: ['panel-prices', sizeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_prices')
        .select(`
          *,
          panel_sizes!inner(thickness)
        `)
        .eq('panel_size_id', sizeId)
        .is('effective_to', null)
        .order('panel_sizes(thickness)');
      
      if (error) throw error;
      return data as PanelPrice[];
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      // Set effective_to for old price
      const { error: updateError } = await supabase
        .from('panel_prices')
        .update({ effective_to: new Date().toISOString() })
        .eq('id', id);
      
      if (updateError) throw updateError;

      // Get the old price details
      const oldPrice = prices.find(p => p.id === id);
      if (!oldPrice) throw new Error('Price not found');

      // Insert new price
      const { error: insertError } = await supabase
        .from('panel_prices')
        .insert([{
          panel_size_id: oldPrice.panel_size_id,
          price: price
        }]);
      
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-prices', sizeId] });
      toast({ title: "가격이 수정되었습니다" });
      setEditingId(null);
      setEditPrice('');
    }
  });

  const handleEdit = (price: PanelPrice) => {
    setEditingId(price.id);
    setEditPrice(price.price.toString());
  };

  const handleSave = (id: string) => {
    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      toast({ title: "올바른 가격을 입력해주세요", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id, price });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditPrice('');
  };

  if (isLoading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

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
              <TableHead className="text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price) => (
              <TableRow key={price.id}>
                <TableCell className="font-medium">{price.panel_sizes.thickness}</TableCell>
                <TableCell>
                  {editingId === price.id ? (
                    <Input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-32"
                    />
                  ) : (
                    `${price.price.toLocaleString()}원`
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === price.id ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(price.id)}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(price)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {prices.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            가격 정보가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
