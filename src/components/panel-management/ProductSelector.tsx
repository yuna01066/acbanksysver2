import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CASTING_QUALITIES } from '@/types/calculator';

interface PanelMaster {
  id: string;
  name: string;
  material: string;
  quality: string;
  description: string | null;
}

interface ProductSelectorProps {
  materialId: string;
  materialName: string;
  onSelectProduct: (masterId: string, productName: string) => void;
  onBack: () => void;
  selectedProductId: string | null;
}

export function ProductSelector({ materialId, materialName, onSelectProduct, onBack, selectedProductId }: ProductSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use CASTING_QUALITIES from calculator as the source of truth
  const qualities = CASTING_QUALITIES;


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>재질 선택</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{materialName}의 재질을 선택해주세요</p>
          </div>
          <Button onClick={onBack} variant="outline" size="sm">
            소재 선택으로
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {qualities.map((quality) => (
            <Button
              key={quality.id}
              variant={selectedProductId === quality.id ? "default" : "outline"}
              className="h-20 text-lg font-semibold"
              onClick={() => onSelectProduct(quality.id, quality.name)}
            >
              {quality.name}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
