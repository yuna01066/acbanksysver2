import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowLeft, Save, Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';

interface LineItem {
  id: string;
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  note?: string;
}

interface SpaceAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

const PROJECT_TYPES = ['쇼룸', '팝업', '매장', '오피스', '전시', '주거', '기타'];
const AREA_UNITS = ['㎡', '평'];
const ITEM_UNITS = ['식', 'EA', '㎡', '평', 'm', 'set'];

const round100 = (n: number) => Math.round(n / 100) * 100;

const lineSchema = z.object({
  name: z.string().trim().max(200),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
});

const SpaceProjectFormPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('id');
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('견적일로부터 30일');

  // Project info
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [location, setLocation] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  // Client info (separate card)
  const [clientName, setClientName] = useState('');
  const [clientBusinessNumber, setClientBusinessNumber] = useState('');
  const [clientBusinessName, setClientBusinessName] = useState('');
  const [clientRepresentative, setClientRepresentative] = useState('');
  const [clientBusinessType, setClientBusinessType] = useState('');
  const [clientBusinessItem, setClientBusinessItem] = useState('');
  const [clientBusinessAddress, setClientBusinessAddress] = useState('');
  const [clientContactName, setClientContactName] = useState('');
  const [clientContactPosition, setClientContactPosition] = useState('');
  const [clientContactPhone, setClientContactPhone] = useState('');
  const [clientContactEmail, setClientContactEmail] = useState('');

  // Scale
  const [totalArea, setTotalArea] = useState<string>('');
  const [areaUnit, setAreaUnit] = useState('㎡');
  const [floorCount, setFloorCount] = useState<string>('');
  const [zonesText, setZonesText] = useState('');

  // Items
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), name: '', spec: '', quantity: 1, unit: '식', unitPrice: 0, note: '' },
  ]);

  // Cost categories
  const [designCost, setDesignCost] = useState<string>('');
  const [constructionCost, setConstructionCost] = useState<string>('');
  const [materialCost, setMaterialCost] = useState<string>('');

  // Recipient (발주처 - separate from client)
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');

  const [memo, setMemo] = useState('');
  const [attachments, setAttachments] = useState<SpaceAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!quoteNumber && !editId) {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setQuoteNumber(
        `SP-${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(Math.floor(Math.random() * 100))}`
      );
    }
  }, [quoteNumber, editId]);

  // Load existing
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('space_project_quotes')
        .select('*')
        .eq('id', editId)
        .maybeSingle();
      if (error || !data) {
        toast.error('견적을 불러올 수 없습니다.');
        navigate('/space-quotes');
        return;
      }
      setQuoteNumber(data.quote_number);
      setQuoteDate(data.quote_date);
      setValidUntil(data.valid_until ?? '');
      setProjectName(data.project_name);
      setClientName(data.client_name ?? '');
      setClientBusinessNumber((data as any).client_business_number ?? '');
      setClientBusinessName((data as any).client_business_name ?? '');
      setClientRepresentative((data as any).client_representative ?? '');
      setClientBusinessType((data as any).client_business_type ?? '');
      setClientBusinessItem((data as any).client_business_item ?? '');
      setClientBusinessAddress((data as any).client_business_address ?? '');
      setClientContactName((data as any).client_contact_name ?? '');
      setClientContactPosition((data as any).client_contact_position ?? '');
      setClientContactPhone((data as any).client_contact_phone ?? '');
      setClientContactEmail((data as any).client_contact_email ?? '');
      setProjectType(data.project_type ?? '');
      setLocation(data.location ?? '');
      setScheduledDate(data.scheduled_date ?? '');
      setTotalArea(data.total_area?.toString() ?? '');
      setAreaUnit(data.area_unit ?? '㎡');
      setFloorCount(data.floor_count?.toString() ?? '');
      setZonesText(Array.isArray(data.zones) ? (data.zones as string[]).join(', ') : '');
      const loadedItems = (data.items as unknown as LineItem[]) ?? [];
      setItems(loadedItems.length ? loadedItems : [{ id: crypto.randomUUID(), name: '', spec: '', quantity: 1, unit: '식', unitPrice: 0 }]);
      const cb = (data.cost_breakdown as Record<string, number>) ?? {};
      setDesignCost(cb.design?.toString() ?? '');
      setConstructionCost(cb.construction?.toString() ?? '');
      setMaterialCost(cb.material?.toString() ?? '');
      setRecipientCompany(data.recipient_company ?? '');
      setRecipientContact(data.recipient_contact ?? '');
      setRecipientPhone(data.recipient_phone ?? '');
      setRecipientEmail(data.recipient_email ?? '');
      setRecipientAddress(data.recipient_address ?? '');
      setMemo(data.memo ?? '');
      setAttachments((data.attachments as unknown as SpaceAttachment[]) ?? []);
      setLoading(false);
    })();
  }, [editId, navigate]);

  const totals = useMemo(() => {
    const itemsSubtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const extras = (Number(designCost) || 0) + (Number(constructionCost) || 0) + (Number(materialCost) || 0);
    const subtotal = round100(itemsSubtotal + extras);
    const tax = round100(subtotal * 0.1);
    const total = round100(subtotal + tax);
    return { subtotal, tax, total };
  }, [items, designCost, constructionCost, materialCost]);

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const addItem = () =>
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: '', spec: '', quantity: 1, unit: '식', unitPrice: 0 }]);
  const removeItem = (id: string) => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !user) return;
    setUploading(true);
    try {
      const newAttachments: SpaceAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name}: 20MB 이하만 업로드 가능`);
          continue;
        }
        const path = `space/${user.id}/${quoteNumber}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('quote-attachments').upload(path, file);
        if (error) {
          toast.error(`${file.name} 업로드 실패`);
          continue;
        }
        newAttachments.push({ name: file.name, path, size: file.size, type: file.type });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
      if (newAttachments.length) toast.success(`${newAttachments.length}개 파일 업로드 완료`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = async (att: SpaceAttachment) => {
    await supabase.storage.from('quote-attachments').remove([att.path]);
    setAttachments((prev) => prev.filter((a) => a.path !== att.path));
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!projectName.trim()) {
      toast.error('프로젝트명을 입력해주세요.');
      return;
    }
    // validate items
    for (const it of items) {
      const r = lineSchema.safeParse(it);
      if (!r.success) {
        toast.error('항목 입력값을 확인해주세요.');
        return;
      }
    }
    setSaving(true);
    try {
      const zones = zonesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        user_id: user.id,
        quote_number: quoteNumber,
        quote_date: quoteDate,
        valid_until: validUntil || null,
        project_name: projectName.trim(),
        client_name: clientName.trim() || null,
        client_business_number: clientBusinessNumber.trim() || null,
        client_business_name: clientBusinessName.trim() || null,
        client_representative: clientRepresentative.trim() || null,
        client_business_type: clientBusinessType.trim() || null,
        client_business_item: clientBusinessItem.trim() || null,
        client_business_address: clientBusinessAddress.trim() || null,
        client_contact_name: clientContactName.trim() || null,
        client_contact_position: clientContactPosition.trim() || null,
        client_contact_phone: clientContactPhone.trim() || null,
        client_contact_email: clientContactEmail.trim() || null,
        project_type: projectType || null,
        location: location.trim() || null,
        scheduled_date: scheduledDate || null,
        total_area: totalArea ? Number(totalArea) : null,
        area_unit: areaUnit,
        floor_count: floorCount ? Number(floorCount) : null,
        zones,
        items: items as any,
        cost_breakdown: {
          design: Number(designCost) || 0,
          construction: Number(constructionCost) || 0,
          material: Number(materialCost) || 0,
        } as any,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        recipient_company: recipientCompany.trim() || null,
        recipient_contact: recipientContact.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        recipient_email: recipientEmail.trim() || null,
        recipient_address: recipientAddress.trim() || null,
        memo: memo.trim() || null,
        attachments: attachments as any,
      };

      if (editId) {
        const { error } = await supabase.from('space_project_quotes').update(payload).eq('id', editId);
        if (error) throw error;
        toast.success('공간 프로젝트 견적이 수정되었습니다.');
        navigate(`/space-quotes/${editId}`);
      } else {
        const { data, error } = await supabase
          .from('space_project_quotes')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        toast.success('공간 프로젝트 견적이 저장되었습니다.');
        navigate(`/space-quotes/${data.id}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('저장 실패: ' + (e?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> 뒤로
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">공간 프로젝트 견적 {editId ? '수정' : '작성'}</h1>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? '저장 중...' : '저장'}
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">견적 기본</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>견적번호</Label>
              <Input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
            </div>
            <div>
              <Label>견적일</Label>
              <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </div>
            <div>
              <Label>유효기간</Label>
              <Input value={validUntil} onChange={(e) => setValidUntil(e.target.value)} placeholder="예: 견적일로부터 30일" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">프로젝트 정보</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>프로젝트명 *</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label>프로젝트 유형</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>장소(주소)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} />
            </div>
            <div>
              <Label>시공 예정일</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">클라이언트 정보</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">클라이언트(통칭)</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={200} placeholder="예: ABC 브랜드" />
            </div>

            <div>
              <div className="text-sm font-medium mb-2 text-muted-foreground">사업자 정보</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>사업자등록번호</Label>
                  <Input value={clientBusinessNumber} onChange={(e) => setClientBusinessNumber(e.target.value)} maxLength={20} placeholder="000-00-00000" />
                </div>
                <div>
                  <Label>상호 / 법인명</Label>
                  <Input value={clientBusinessName} onChange={(e) => setClientBusinessName(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <Label>대표자</Label>
                  <Input value={clientRepresentative} onChange={(e) => setClientRepresentative(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label>업태</Label>
                  <Input value={clientBusinessType} onChange={(e) => setClientBusinessType(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label>종목</Label>
                  <Input value={clientBusinessItem} onChange={(e) => setClientBusinessItem(e.target.value)} maxLength={100} />
                </div>
                <div className="sm:col-span-2">
                  <Label>사업장 주소</Label>
                  <Input value={clientBusinessAddress} onChange={(e) => setClientBusinessAddress(e.target.value)} maxLength={300} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2 text-muted-foreground">담당자 정보</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>담당자명</Label>
                  <Input value={clientContactName} onChange={(e) => setClientContactName(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label>직책</Label>
                  <Input value={clientContactPosition} onChange={(e) => setClientContactPosition(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label>연락처</Label>
                  <Input value={clientContactPhone} onChange={(e) => setClientContactPhone(e.target.value)} maxLength={50} />
                </div>
                <div>
                  <Label>이메일</Label>
                  <Input type="email" value={clientContactEmail} onChange={(e) => setClientContactEmail(e.target.value)} maxLength={255} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">공간 규모</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label>총 면적</Label>
              <Input type="number" value={totalArea} onChange={(e) => setTotalArea(e.target.value)} />
            </div>
            <div>
              <Label>단위</Label>
              <Select value={areaUnit} onValueChange={setAreaUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AREA_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>층수</Label>
              <Input type="number" value={floorCount} onChange={(e) => setFloorCount(e.target.value)} />
            </div>
            <div className="sm:col-span-4">
              <Label>존(zone) 구분 — 콤마로 구분</Label>
              <Input value={zonesText} onChange={(e) => setZonesText(e.target.value)} placeholder="예: 입구, 메인홀, 라운지" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">시공 항목</CardTitle>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" />항목 추가</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
                <div className="col-span-12 sm:col-span-3">
                  <Label className="text-xs">항목명 #{idx + 1}</Label>
                  <Input value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} maxLength={200} />
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <Label className="text-xs">규격</Label>
                  <Input value={it.spec} onChange={(e) => updateItem(it.id, { spec: e.target.value })} maxLength={200} />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <Label className="text-xs">수량</Label>
                  <Input type="number" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })} />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <Label className="text-xs">단위</Label>
                  <Select value={it.unit} onValueChange={(v) => updateItem(it.id, { unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ITEM_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-xs">단가</Label>
                  <Input type="number" value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) })} />
                </div>
                <div className="col-span-10 sm:col-span-1 text-right text-sm font-medium">
                  {formatPrice((it.quantity || 0) * (it.unitPrice || 0))}
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)} disabled={items.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">비용 분류 (추가 합산)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>디자인비</Label>
              <Input type="number" value={designCost} onChange={(e) => setDesignCost(e.target.value)} />
            </div>
            <div>
              <Label>시공비</Label>
              <Input type="number" value={constructionCost} onChange={(e) => setConstructionCost(e.target.value)} />
            </div>
            <div>
              <Label>자재비</Label>
              <Input type="number" value={materialCost} onChange={(e) => setMaterialCost(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span>소계</span><span className="font-semibold">{formatPrice(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span>부가세 (10%)</span><span className="font-semibold">{formatPrice(totals.tax)}</span></div>
            <div className="flex justify-between text-lg pt-2 border-t border-white/20"><span>총 합계</span><span className="font-bold">{formatPrice(totals.total)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">수신처(발주처) 정보</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>회사명</Label><Input value={recipientCompany} onChange={(e) => setRecipientCompany(e.target.value)} maxLength={200} /></div>
            <div><Label>담당자</Label><Input value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} maxLength={100} /></div>
            <div><Label>연락처</Label><Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} maxLength={50} /></div>
            <div><Label>이메일</Label><Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} maxLength={255} /></div>
            <div className="sm:col-span-2"><Label>주소</Label><Input value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} maxLength={300} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">메모/특기사항</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} maxLength={2000} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">첨부파일</CardTitle>
            <Button size="sm" variant="outline" asChild disabled={uploading}>
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-1" />{uploading ? '업로드 중...' : '파일 선택'}
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              </label>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {attachments.length === 0 && <p className="text-sm text-muted-foreground">첨부된 파일이 없습니다.</p>}
            {attachments.map((a) => (
              <div key={a.path} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate text-sm">{a.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">({Math.round(a.size / 1024)}KB)</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeAttachment(a)}><X className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-1" /> {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SpaceProjectFormPage;
