import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
}

const ProjectProfitability: React.FC<Props> = ({ projectId }) => {
  const queryClient = useQueryClient();

  // Revenue: linked quotes total
  const { data: revenue = 0 } = useQuery({
    queryKey: ['project-profitability-revenue', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('total')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data || []).reduce((s, q) => s + Number(q.total || 0), 0);
    },
  });

  // Internal docs (receipts) cost
  const { data: docsCost = { receiptTotal: 0, paidQuoteTotal: 0 } } = useQuery({
    queryKey: ['project-profitability-docs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_project_documents')
        .select('document_type, total, is_paid')
        .eq('project_id', projectId);
      if (error) throw error;
      const quotes = (data || []).filter(d => d.document_type === 'quote');
      const receipts = (data || []).filter(d => d.document_type === 'receipt');
      return {
        paidQuoteTotal: quotes.filter(d => d.is_paid).reduce((s, d) => s + Number(d.total || 0), 0),
        receiptTotal: receipts.reduce((s, d) => s + Number(d.total || 0), 0),
      };
    },
  });

  // Manual cost adjustments from project custom_data
  const { data: project } = useQuery({
    queryKey: ['project-profit-custom', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const customData = (project?.custom_data as any) || {};
  const [materialCostAdj, setMaterialCostAdj] = useState<string>('');
  const [processingCostAdj, setProcessingCostAdj] = useState<string>('');
  const [initialized, setInitialized] = useState(false);

  if (project && !initialized) {
    setMaterialCostAdj(String(customData.material_cost_adj || ''));
    setProcessingCostAdj(String(customData.processing_cost_adj || ''));
    setInitialized(true);
  }

  const saveAdj = useMutation({
    mutationFn: async () => {
      const newData = {
        ...customData,
        material_cost_adj: Number(materialCostAdj) || 0,
        processing_cost_adj: Number(processingCostAdj) || 0,
      };
      const { error } = await supabase
        .from('projects')
        .update({ custom_data: newData } as any)
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-profit-custom', projectId] });
      toast.success('비용 보정이 저장되었습니다.');
    },
  });

  const autoCost = docsCost.receiptTotal + docsCost.paidQuoteTotal;
  const manualMaterial = Number(materialCostAdj) || 0;
  const manualProcessing = Number(processingCostAdj) || 0;
  const totalCost = autoCost + manualMaterial + manualProcessing;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const ProfitIcon = profit > 0 ? TrendingUp : profit < 0 ? TrendingDown : Minus;
  const profitColor = profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">매출</p>
          <p className="text-sm font-bold text-primary">₩{Math.round(revenue).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">총 비용</p>
          <p className="text-sm font-bold text-amber-600">₩{Math.round(totalCost).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">수익</p>
          <div className={`flex items-center justify-center gap-1 ${profitColor}`}>
            <ProfitIcon className="h-3.5 w-3.5" />
            <p className="text-sm font-bold">₩{Math.round(profit).toLocaleString()}</p>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">마진 {margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">비용 내역</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">자동 집계 (영수증 + 입금 견적)</span>
            <span className="font-medium">₩{Math.round(autoCost).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0 w-[100px]">원자재비 (보정)</span>
            <Input
              type="number"
              value={materialCostAdj}
              onChange={e => setMaterialCostAdj(e.target.value)}
              className="h-6 text-xs flex-1"
              placeholder="0"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0 w-[100px]">가공비 (보정)</span>
            <Input
              type="number"
              value={processingCostAdj}
              onChange={e => setProcessingCostAdj(e.target.value)}
              className="h-6 text-xs flex-1"
              placeholder="0"
            />
          </div>
          <Button size="sm" className="h-6 text-[10px] gap-1 w-full" onClick={() => saveAdj.mutate()}>
            <Save className="h-3 w-3" /> 보정 저장
          </Button>
        </div>
      </div>

      {/* Profit bar */}
      {revenue > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-[10px] text-muted-foreground mb-2">수익 구조</p>
          <div className="flex h-4 rounded-full overflow-hidden bg-muted">
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${Math.min((totalCost / revenue) * 100, 100)}%` }}
            />
            {profit > 0 && (
              <div
                className="bg-emerald-400 transition-all"
                style={{ width: `${(profit / revenue) * 100}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            <span>비용 {revenue > 0 ? ((totalCost / revenue) * 100).toFixed(0) : 0}%</span>
            <span>수익 {margin.toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectProfitability;
