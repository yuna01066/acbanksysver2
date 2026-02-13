import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Receipt, Building2, Phone, Hash, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  projectId: string;
}

const InternalProjectItemsCard: React.FC<Props> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<'quote' | 'receipt'>('quote');

  const { data: documents = [] } = useQuery({
    queryKey: ['internal-docs', projectId, activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_project_documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('document_type', activeTab)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const docsWithItems = documents.filter((d: any) => d.items && Array.isArray(d.items) && d.items.length > 0);

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-2.5 border-b">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">프로젝트 견적 항목</span>
          <div className="flex bg-muted rounded-md p-0.5">
            <button
              onClick={() => setActiveTab('quote')}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-all ${
                activeTab === 'quote' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <FileText className="h-2.5 w-2.5" /> 견적서
            </button>
            <button
              onClick={() => setActiveTab('receipt')}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-all ${
                activeTab === 'receipt' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Receipt className="h-2.5 w-2.5" /> 영수증
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {docsWithItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {activeTab === 'quote' ? '견적서를 업로드하면 항목이 자동으로 표시됩니다.' : '영수증을 업로드하면 항목이 자동으로 표시됩니다.'}
          </p>
        ) : (
          <div className="space-y-4">
            {docsWithItems.map((doc: any) => (
              <div key={doc.id} className="space-y-2">
                {/* Vendor info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {doc.vendor_name && (
                      <span className="text-xs font-medium flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" /> {doc.vendor_name}
                      </span>
                    )}
                    {doc.vendor_phone && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Phone className="h-2.5 w-2.5" /> {doc.vendor_phone}
                      </span>
                    )}
                    {doc.vendor_business_number && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Hash className="h-2.5 w-2.5" /> {doc.vendor_business_number}
                      </span>
                    )}
                  </div>
                  {doc.purchase_date && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {format(new Date(doc.purchase_date), 'yyyy.MM.dd', { locale: ko })}
                    </span>
                  )}
                </div>

                {/* Items table */}
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">항목</th>
                        <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-16">수량</th>
                        <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-24">단가</th>
                        <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-24">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-t border-border/50">
                          <td className="px-2 py-1.5">{item.name || '-'}</td>
                          <td className="text-right px-2 py-1.5 tabular-nums">{item.quantity ?? '-'}</td>
                          <td className="text-right px-2 py-1.5 tabular-nums">
                            {item.unit_price != null ? `₩${Number(item.unit_price).toLocaleString()}` : '-'}
                          </td>
                          <td className="text-right px-2 py-1.5 tabular-nums font-medium">
                            {item.amount != null ? `₩${Number(item.amount).toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t">
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="text-right px-2 py-1.5 text-muted-foreground">공급가액</td>
                        <td className="text-right px-2 py-1.5 tabular-nums font-medium">
                          ₩{Math.round(doc.subtotal || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="text-right px-2 py-1.5 text-muted-foreground">부가세</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">
                          ₩{Math.round(doc.tax || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-muted/50">
                        <td colSpan={3} className="text-right px-2 py-1.5 font-semibold">합계</td>
                        <td className="text-right px-2 py-1.5 tabular-nums font-bold">
                          ₩{Math.round(doc.total || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {doc.is_paid && (
                  <div className="flex justify-end">
                    <Badge variant="secondary" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">입금완료</Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InternalProjectItemsCard;
