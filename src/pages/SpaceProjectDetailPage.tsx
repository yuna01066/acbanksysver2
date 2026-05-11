import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Pencil, Printer, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';

interface SpaceQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_until: string | null;
  project_name: string;
  client_name: string | null;
  project_type: string | null;
  location: string | null;
  scheduled_date: string | null;
  total_area: number | null;
  area_unit: string | null;
  floor_count: number | null;
  zones: any;
  items: any;
  cost_breakdown: any;
  subtotal: number;
  tax: number;
  total: number;
  recipient_company: string | null;
  recipient_contact: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_address: string | null;
  memo: string | null;
  attachments: any;
}

const SpaceProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SpaceQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('space_project_quotes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) {
        toast.error('견적을 찾을 수 없습니다.');
        navigate('/space-quotes');
        return;
      }
      setData(data as any);
      setLoading(false);
    })();
  }, [id, navigate]);

  const downloadAttachment = async (path: string, name: string) => {
    const { data: signed, error } = await supabase.storage
      .from('quote-attachments')
      .createSignedUrl(path, 60);
    if (error || !signed) {
      toast.error('다운로드 실패');
      return;
    }
    const a = document.createElement('a');
    a.href = signed.signedUrl;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const items = (data.items as any[]) ?? [];
  const cb = (data.cost_breakdown as Record<string, number>) ?? {};
  const zones: string[] = Array.isArray(data.zones) ? data.zones : [];
  const attachments = (data.attachments as any[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate('/space-quotes')}>
            <ArrowLeft className="w-4 h-4 mr-1" />목록
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">공간 프로젝트 견적</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/space-quote?id=${data.id}`)}>
              <Pencil className="w-4 h-4 mr-1" />수정
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" />인쇄/PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>{data.project_name}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><div className="text-muted-foreground">견적번호</div><div className="font-medium">{data.quote_number}</div></div>
            <div><div className="text-muted-foreground">견적일</div><div className="font-medium">{data.quote_date}</div></div>
            <div><div className="text-muted-foreground">유효기간</div><div className="font-medium">{data.valid_until || '-'}</div></div>
            <div><div className="text-muted-foreground">유형</div><div className="font-medium">{data.project_type || '-'}</div></div>
            <div><div className="text-muted-foreground">클라이언트</div><div className="font-medium">{data.client_name || '-'}</div></div>
            <div><div className="text-muted-foreground">장소</div><div className="font-medium">{data.location || '-'}</div></div>
            <div><div className="text-muted-foreground">시공 예정일</div><div className="font-medium">{data.scheduled_date || '-'}</div></div>
            <div>
              <div className="text-muted-foreground">규모</div>
              <div className="font-medium">
                {data.total_area ? `${data.total_area} ${data.area_unit}` : '-'}
                {data.floor_count ? ` · ${data.floor_count}층` : ''}
              </div>
            </div>
            {zones.length > 0 && (
              <div className="col-span-2 sm:col-span-4">
                <div className="text-muted-foreground">존</div>
                <div className="font-medium">{zones.join(', ')}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">시공 항목</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="py-2">항목</th>
                  <th className="py-2">규격</th>
                  <th className="py-2 text-right">수량</th>
                  <th className="py-2">단위</th>
                  <th className="py-2 text-right">단가</th>
                  <th className="py-2 text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{it.name}</td>
                    <td className="py-2">{it.spec}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2">{it.unit}</td>
                    <td className="py-2 text-right">{formatPrice(it.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatPrice((it.quantity || 0) * (it.unitPrice || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {(cb.design || cb.construction || cb.material) ? (
          <Card>
            <CardHeader><CardTitle className="text-base">비용 분류</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-muted-foreground">디자인비</div><div className="font-medium">{formatPrice(cb.design || 0)}</div></div>
              <div><div className="text-muted-foreground">시공비</div><div className="font-medium">{formatPrice(cb.construction || 0)}</div></div>
              <div><div className="text-muted-foreground">자재비</div><div className="font-medium">{formatPrice(cb.material || 0)}</div></div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="bg-slate-900 text-white">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span>소계</span><span>{formatPrice(data.subtotal)}</span></div>
            <div className="flex justify-between"><span>부가세 (10%)</span><span>{formatPrice(data.tax)}</span></div>
            <div className="flex justify-between text-lg pt-2 border-t border-white/20 font-bold">
              <span>총 합계</span><span>{formatPrice(data.total)}</span>
            </div>
          </CardContent>
        </Card>

        {(data.recipient_company || data.recipient_contact) && (
          <Card>
            <CardHeader><CardTitle className="text-base">수신처</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground">회사명</div><div className="font-medium">{data.recipient_company || '-'}</div></div>
              <div><div className="text-muted-foreground">담당자</div><div className="font-medium">{data.recipient_contact || '-'}</div></div>
              <div><div className="text-muted-foreground">연락처</div><div className="font-medium">{data.recipient_phone || '-'}</div></div>
              <div><div className="text-muted-foreground">이메일</div><div className="font-medium">{data.recipient_email || '-'}</div></div>
              <div className="col-span-2"><div className="text-muted-foreground">주소</div><div className="font-medium">{data.recipient_address || '-'}</div></div>
            </CardContent>
          </Card>
        )}

        {data.memo && (
          <Card>
            <CardHeader><CardTitle className="text-base">메모/특기사항</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap">{data.memo}</CardContent>
          </Card>
        )}

        {attachments.length > 0 && (
          <Card className="print:hidden">
            <CardHeader><CardTitle className="text-base">첨부파일</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {attachments.map((a: any) => (
                <div key={a.path} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate text-sm">{a.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => downloadAttachment(a.path, a.name)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SpaceProjectDetailPage;
