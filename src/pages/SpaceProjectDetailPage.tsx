import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Pencil, Printer, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import PrintStyles from '@/components/PrintStyles';
import QuoteDocumentsSection from '@/components/quote-detail/QuoteDocumentsSection';

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
  client_business_number: string | null;
  client_business_name: string | null;
  client_representative: string | null;
  client_business_type: string | null;
  client_business_item: string | null;
  client_business_address: string | null;
  client_contact_name: string | null;
  client_contact_position: string | null;
  client_contact_phone: string | null;
  client_contact_email: string | null;
  issuer_name: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;
  issuer_department: string | null;
  issuer_position: string | null;
  memo: string | null;
  attachments: any;
}

const SpaceProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SpaceQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState({
    company_name: '(주)아크뱅크',
    business_number: '299-87-02991',
    website: 'acbank.co.kr',
    address: '경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호',
    detail_address: '',
    business_type: '제조업 / 도매 및 소매업',
    industry: '아크릴 가공 외',
    phone: '070-7666-9828',
    email: 'acbank@acbank.co.kr',
  });
  const [bankInfo, setBankInfo] = useState('국민은행 882801-01-326611 (주)아크뱅크');

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

    (async () => {
      const { data: ci } = await supabase.from('company_info').select('*').limit(1).maybeSingle();
      if (ci) {
        const d = ci as any;
        setCompanyInfo(prev => ({
          company_name: d.company_name || prev.company_name,
          business_number: d.business_number || prev.business_number,
          website: d.website || prev.website,
          address: d.address || prev.address,
          detail_address: d.detail_address || '',
          business_type: d.business_type || prev.business_type,
          industry: d.industry || prev.industry,
          phone: d.phone || prev.phone,
          email: d.email || prev.email,
        }));
        if (d.quote_bank_info) setBankInfo(d.quote_bank_info);
      }
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
    <div className="min-h-screen bg-background print-layout-wrapper">
      <PrintStyles
        quoteNumber={data.quote_number}
        projectName={data.project_name}
        companyName={data.client_name || data.recipient_company}
        isInternal={false}
      />
      <style>{`
        @media print {
          .print-container {
            zoom: 0.6;
          }
        }
      `}</style>
      <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 print-container">
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

        {/* 인쇄용 헤더 */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-2xl font-bold tracking-wider">견 적 서</h1>
          <div className="text-xs text-gray-600 mt-1">QUOTATION · 공간 프로젝트</div>
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

        {(data.client_name || data.client_business_number || data.client_business_name || data.client_contact_name) && (
          <Card>
            <CardHeader><CardTitle className="text-base">클라이언트 정보</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {data.client_name && (
                <div><span className="text-muted-foreground">클라이언트:</span> <span className="font-medium ml-1">{data.client_name}</span></div>
              )}
              {(data.client_business_number || data.client_business_name) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-medium">사업자 정보</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="text-muted-foreground">사업자등록번호</div><div className="font-medium">{data.client_business_number || '-'}</div></div>
                    <div><div className="text-muted-foreground">상호/법인명</div><div className="font-medium">{data.client_business_name || '-'}</div></div>
                    <div><div className="text-muted-foreground">대표자</div><div className="font-medium">{data.client_representative || '-'}</div></div>
                    <div><div className="text-muted-foreground">업태</div><div className="font-medium">{data.client_business_type || '-'}</div></div>
                    <div><div className="text-muted-foreground">종목</div><div className="font-medium">{data.client_business_item || '-'}</div></div>
                    <div className="col-span-2"><div className="text-muted-foreground">사업장 주소</div><div className="font-medium">{data.client_business_address || '-'}</div></div>
                  </div>
                </div>
              )}
              {data.client_contact_name && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-medium">담당자</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="text-muted-foreground">담당자명</div><div className="font-medium">{data.client_contact_name || '-'}</div></div>
                    <div><div className="text-muted-foreground">직책</div><div className="font-medium">{data.client_contact_position || '-'}</div></div>
                    <div><div className="text-muted-foreground">연락처</div><div className="font-medium">{data.client_contact_phone || '-'}</div></div>
                    <div><div className="text-muted-foreground">이메일</div><div className="font-medium">{data.client_contact_email || '-'}</div></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">시공 항목</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm border-collapse table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[26%]" />
                <col className="w-[7%]" />
                <col className="w-[8%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="bg-muted/50 border-y border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="py-2.5 px-2 text-left">항목명</th>
                  <th className="py-2.5 px-2 text-left">규격 / 상세 내용</th>
                  <th className="py-2.5 px-2 text-left">단위</th>
                  <th className="py-2.5 px-2 text-left">수량</th>
                  <th className="py-2.5 px-2 text-left">단가</th>
                  <th className="py-2.5 px-2 text-left border-r border-border">금액</th>
                  <th className="py-2.5 pl-4 pr-2 text-left">비고</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, i: number) => (
                  <tr key={i} className="border-b border-border/60 align-top hover:bg-muted/20">
                    <td className="py-2.5 px-2 font-medium break-words">{it.name}</td>
                    <td className="py-2.5 px-2 whitespace-pre-wrap break-words text-muted-foreground">{it.spec}</td>
                    <td className="py-2.5 px-2 text-center">{it.unit}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{it.quantity}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatPrice(it.unitPrice)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-semibold border-r border-border/60">{formatPrice((it.quantity || 0) * (it.unitPrice || 0))}</td>
                    <td className="py-2.5 pl-4 pr-2 whitespace-pre-wrap break-words text-muted-foreground">{it.note || ''}</td>
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

        <Card className="bg-slate-900 text-white print:bg-white print:text-black print:border print:border-gray-400 break-inside-avoid">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span>소계</span><span>{formatPrice(data.subtotal)}</span></div>
            <div className="flex justify-between"><span>부가세 (10%)</span><span>{formatPrice(data.tax)}</span></div>
            <div className="flex justify-between text-lg pt-2 border-t border-white/20 print:border-gray-400 font-bold">
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

        {/* 발신/수신 카드 (공급자 / 공급받는자) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 quote-section">
          <div className="bg-[hsl(215,50%,94%)] rounded-lg border border-[hsl(215,40%,80%)] p-4 space-y-2">
            <h3 className="text-[15px] font-bold text-black border-b border-[hsl(215,45%,60%)] pb-1.5">공급자 (발신)</h3>
            <div className="space-y-1 text-[12.5px]">
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">상호</span><span className="font-semibold">{companyInfo.company_name}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">사업자번호</span><span className="font-semibold">{companyInfo.business_number}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">업태/종목</span><span className="font-semibold">{companyInfo.business_type} / {companyInfo.industry}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">주소</span><span className="font-semibold leading-snug">{companyInfo.address}{companyInfo.detail_address ? `, ${companyInfo.detail_address}` : ''}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold">{companyInfo.phone}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold">{companyInfo.email}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">웹사이트</span><span className="font-semibold">{companyInfo.website}</span></div>
            </div>
            {(data.issuer_name || data.issuer_email || data.issuer_phone) && (
              <div className="mt-2 pt-2 border-t border-[hsl(215,45%,70%)] space-y-1 text-[12.5px]">
                <div className="text-[11px] font-bold text-[hsl(215,60%,22%)] mb-1">담당자</div>
                <div className="flex"><span className="text-gray-600 w-20 shrink-0">담당자</span><span className="font-semibold">{data.issuer_name || '-'}{data.issuer_position ? ` (${data.issuer_position})` : ''}{data.issuer_department ? ` · ${data.issuer_department}` : ''}</span></div>
                {data.issuer_phone && <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold">{data.issuer_phone}</span></div>}
                {data.issuer_email && <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold">{data.issuer_email}</span></div>}
              </div>
            )}
            <div className="mt-2 p-2 bg-[hsl(210,60%,90%)] rounded border border-[hsl(210,50%,78%)]">
              <div className="text-[11px] font-bold text-[hsl(215,60%,22%)]">입금 계좌</div>
              <div className="text-[12.5px] font-bold text-[hsl(215,60%,18%)]">{bankInfo}</div>
            </div>
          </div>

          <div className="bg-[hsl(145,45%,93%)] rounded-lg border border-[hsl(145,35%,80%)] p-4 space-y-2">
            <h3 className="text-[15px] font-bold text-black border-b border-[hsl(145,40%,60%)] pb-1.5">공급받는자 (수신)</h3>
            <div className="space-y-1 text-[12.5px]">
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">프로젝트</span><span className="font-semibold">{data.project_name}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">견적번호</span><span className="font-semibold">{data.quote_number}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">견적일</span><span className="font-semibold">{data.quote_date}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">유효기간</span><span className="font-semibold">{data.valid_until || '-'}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">상호</span><span className="font-semibold">{data.client_business_name || data.client_name || data.recipient_company || '-'}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">사업자번호</span><span className="font-semibold">{data.client_business_number || '-'}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">대표자</span><span className="font-semibold">{data.client_representative || '-'}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">담당자</span><span className="font-semibold">{data.client_contact_name || data.recipient_contact || '-'}{data.client_contact_position ? ` (${data.client_contact_position})` : ''}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold">{data.client_contact_phone || data.recipient_phone || '-'}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold">{data.client_contact_email || data.recipient_email || '-'}</span></div>
              <div className="flex"><span className="text-gray-600 w-20 shrink-0">현장</span><span className="font-semibold">{data.location || '-'}</span></div>
            </div>
          </div>
        </div>

        {/* 첨부 서류 - 사업자등록증 + 통장사본 */}
        <QuoteDocumentsSection />
      </div>
    </div>
  );
};

export default SpaceProjectDetailPage;
