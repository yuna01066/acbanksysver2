import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Building2, MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';

const CompanyInfoForm: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
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
    workplace_lat: '',
    workplace_lng: '',
    workplace_radius: '500',
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
        workplace_lat: (data as any).workplace_lat?.toString() || '',
        workplace_lng: (data as any).workplace_lng?.toString() || '',
        workplace_radius: (data as any).workplace_radius?.toString() || '500',
      });
    }
    setLoading(false);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('브라우저에서 위치 기능을 지원하지 않습니다.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          workplace_lat: pos.coords.latitude.toFixed(6),
          workplace_lng: pos.coords.longitude.toFixed(6),
        }));
        toast.success('현재 위치가 입력되었습니다.');
        setLocating(false);
      },
      (err) => {
        const reasons: Record<number, string> = {
          1: '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.',
          2: '위치 정보를 가져올 수 없습니다. GPS 또는 네트워크를 확인해주세요.',
          3: '위치 요청 시간이 초과되었습니다. 다시 시도해주세요.',
        };
        toast.error(reasons[err.code] || `위치 오류: ${err.message}`);
        console.error('Geolocation error:', err.code, err.message);
        setLocating(false);
      },
      { timeout: 15000, enableHighAccuracy: false }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        company_name: form.company_name,
        ceo_name: form.ceo_name,
        business_number: form.business_number,
        address: form.address,
        detail_address: form.detail_address,
        phone: form.phone,
        fax: form.fax,
        email: form.email,
        website: form.website,
        industry: form.industry,
        business_type: form.business_type,
        workplace_lat: form.workplace_lat ? parseFloat(form.workplace_lat) : null,
        workplace_lng: form.workplace_lng ? parseFloat(form.workplace_lng) : null,
        workplace_radius: form.workplace_radius ? parseFloat(form.workplace_radius) : 500,
        updated_at: new Date().toISOString(),
      };

      if (id) {
        const { error } = await supabase
          .from('company_info')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_info')
          .insert(payload);
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
    <div className="space-y-6">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" /> 근무지 위치 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            근무지 GPS 좌표를 설정하면, 직원이 해당 범위 밖에서 출퇴근할 때 확인 절차가 진행됩니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">위도 (Latitude)</Label>
              <Input
                value={form.workplace_lat}
                onChange={(e) => setForm(prev => ({ ...prev, workplace_lat: e.target.value }))}
                placeholder="37.XXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">경도 (Longitude)</Label>
              <Input
                value={form.workplace_lng}
                onChange={(e) => setForm(prev => ({ ...prev, workplace_lng: e.target.value }))}
                placeholder="127.XXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">허용 반경 (미터)</Label>
              <Input
                type="number"
                value={form.workplace_radius}
                onChange={(e) => setForm(prev => ({ ...prev, workplace_radius: e.target.value }))}
                placeholder="500"
              />
            </div>
          </div>
          <Button variant="outline" onClick={handleGetCurrentLocation} disabled={locating} className="gap-1.5">
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            현재 위치로 설정
          </Button>
          {form.workplace_lat && form.workplace_lng && (
            <div className="text-xs text-muted-foreground">
              <a
                href={`https://maps.google.com/?q=${form.workplace_lat},${form.workplace_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" /> 지도에서 확인하기
              </a>
            </div>
          )}
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

export default CompanyInfoForm;
