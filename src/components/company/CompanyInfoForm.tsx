import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const CompanyInfoForm: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: '',
    ceo_name: '',
    business_number: '',
    address: '',
    detail_address: '',
    phone: '',
    fax: '',
    email: '',
    website: '',
    industry: '',
    business_type: '',
  });

  useEffect(() => {
    fetchInfo();
  }, []);

  const fetchInfo = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_info')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setId(data.id);
      setForm({
        company_name: data.company_name || '',
        ceo_name: data.ceo_name || '',
        business_number: data.business_number || '',
        address: data.address || '',
        detail_address: data.detail_address || '',
        phone: data.phone || '',
        fax: data.fax || '',
        email: data.email || '',
        website: data.website || '',
        industry: data.industry || '',
        business_type: data.business_type || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id) {
        const { error } = await supabase
          .from('company_info')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_info')
          .insert(form);
        if (error) throw error;
      }
      toast.success('회사 정보가 저장되었습니다');
      fetchInfo();
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: 'company_name', label: '회사명' },
    { key: 'ceo_name', label: '대표자명' },
    { key: 'business_number', label: '사업자등록번호' },
    { key: 'phone', label: '전화번호' },
    { key: 'fax', label: '팩스번호' },
    { key: 'email', label: '이메일' },
    { key: 'website', label: '웹사이트' },
    { key: 'address', label: '주소' },
    { key: 'detail_address', label: '상세주소' },
    { key: 'industry', label: '업종' },
    { key: 'business_type', label: '업태' },
  ];

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5" /> 회사 기본 정보
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key} className="text-sm">{label}</Label>
              <Input
                id={key}
                value={form[key]}
                onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={label}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyInfoForm;
