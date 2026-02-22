import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Loader2, FileText, Banknote, MessageSquare, Phone } from 'lucide-react';
import { toast } from 'sonner';

const QuoteDefaultTextSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    quote_bank_info: '',
    quote_notes: '',
    quote_consultation: '',
    quote_contact_phone: '',
    quote_contact_email: '',
    quote_contact_message: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_info')
      .select('id, quote_bank_info, quote_notes, quote_consultation, quote_contact_phone, quote_contact_email, quote_contact_message')
      .limit(1)
      .maybeSingle();

    if (data) {
      setCompanyId(data.id);
      setForm({
        quote_bank_info: (data as any).quote_bank_info || '',
        quote_notes: (data as any).quote_notes || '',
        quote_consultation: (data as any).quote_consultation || '',
        quote_contact_phone: (data as any).quote_contact_phone || '',
        quote_contact_email: (data as any).quote_contact_email || '',
        quote_contact_message: (data as any).quote_contact_message || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (companyId) {
        const { error } = await supabase
          .from('company_info')
          .update({
            quote_bank_info: form.quote_bank_info,
            quote_notes: form.quote_notes,
            quote_consultation: form.quote_consultation,
            quote_contact_phone: form.quote_contact_phone,
            quote_contact_email: form.quote_contact_email,
            quote_contact_message: form.quote_contact_message,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_info')
          .insert({
            company_name: '회사명',
            quote_bank_info: form.quote_bank_info,
            quote_notes: form.quote_notes,
            quote_consultation: form.quote_consultation,
            quote_contact_phone: form.quote_contact_phone,
            quote_contact_email: form.quote_contact_email,
            quote_contact_message: form.quote_contact_message,
          } as any);
        if (error) throw error;
      }
      toast.success('견적서 기본 텍스트가 저장되었습니다.');
      fetchSettings();
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="h-5 w-5" /> 입금 계좌 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">견적서 발신 섹션 하단에 표시되는 입금 계좌 정보입니다.</p>
          <Input
            value={form.quote_bank_info}
            onChange={(e) => setForm(prev => ({ ...prev, quote_bank_info: e.target.value }))}
            placeholder="예: 신한은행 140-014-544315 (주)아크뱅크"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" /> 특이사항
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">견적서에 기본으로 표시되는 특이사항입니다. 각 줄이 하나의 항목으로 표시됩니다.</p>
          <Textarea
            value={form.quote_notes}
            onChange={(e) => setForm(prev => ({ ...prev, quote_notes: e.target.value }))}
            placeholder="- 견적서의 유효기간은 발행일로부터 14일 입니다.&#10;- 운송비 및 부가세는 별도 입니다."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" /> 상담 내용
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">견적서에 기본으로 표시되는 상담/인사말 내용입니다.</p>
          <Textarea
            value={form.quote_consultation}
            onChange={(e) => setForm(prev => ({ ...prev, quote_consultation: e.target.value }))}
            placeholder="안녕하세요&#10;견적 문의해 주셔서 감사합니다."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5" /> 문의 연락처
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">견적서 하단에 표시되는 대표 연락처 정보입니다.</p>
          <div className="space-y-1.5">
            <Label className="text-sm">안내 문구</Label>
            <Input
              value={form.quote_contact_message}
              onChange={(e) => setForm(prev => ({ ...prev, quote_contact_message: e.target.value }))}
              placeholder="견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">대표전화</Label>
              <Input
                value={form.quote_contact_phone}
                onChange={(e) => setForm(prev => ({ ...prev, quote_contact_phone: e.target.value }))}
                placeholder="070-7537-3680"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">대표이메일</Label>
              <Input
                value={form.quote_contact_email}
                onChange={(e) => setForm(prev => ({ ...prev, quote_contact_email: e.target.value }))}
                placeholder="acbank@acbank.co.kr"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          저장
        </Button>
      </div>
    </div>
  );
};

export default QuoteDefaultTextSettings;
