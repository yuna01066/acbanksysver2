import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  User, Mail, Phone, MapPin, Building2, Briefcase, 
  Calendar, CreditCard, Globe, Hash, Pencil, Save, X, Loader2
} from 'lucide-react';

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  employee_number: string;
  birthday: string;
  address: string;
  detail_address: string;
  zipcode: string;
  nationality: string;
  bank_name: string;
  bank_account: string;
  join_date: string;
  job_title: string;
  job_group: string;
  rank_title: string;
  rank_level: string;
  nickname: string;
  personal_email: string;
}

const ProfileInfoCard = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ProfileData>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFullProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfileData({
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        department: data.department || '',
        position: data.position || '',
        employee_number: (data as any).employee_number || '',
        birthday: (data as any).birthday || '',
        address: (data as any).address || '',
        detail_address: (data as any).detail_address || '',
        zipcode: (data as any).zipcode || '',
        nationality: (data as any).nationality || '대한민국(KOR)',
        bank_name: (data as any).bank_name || '',
        bank_account: (data as any).bank_account || '',
        join_date: (data as any).join_date || '',
        job_title: (data as any).job_title || '',
        job_group: (data as any).job_group || '',
        rank_title: (data as any).rank_title || '',
        rank_level: (data as any).rank_level || '',
        nickname: (data as any).nickname || '',
        personal_email: (data as any).personal_email || '',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFullProfile();
  }, [user]);

  const startEdit = (section: string) => {
    if (!profileData) return;
    setEditSection(section);
    setEditValues({ ...profileData });
  };

  const cancelEdit = () => {
    setEditSection(null);
    setEditValues({});
  };

  const saveSection = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      const fields = getSectionFields(editSection!);
      for (const f of fields) {
        if (f.key !== 'email') {
          updates[f.key] = (editValues as any)[f.key] || null;
        }
      }
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      toast.success('정보가 저장되었습니다.');
      await fetchFullProfile();
      setEditSection(null);
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const getSectionFields = (section: string) => {
    switch (section) {
      case 'org':
        return [
          { key: 'department', label: '조직 (부서)' },
          { key: 'position', label: '직책' },
        ];
      case 'job':
        return [
          { key: 'job_title', label: '직무' },
          { key: 'job_group', label: '직군' },
        ];
      case 'rank':
        return [
          { key: 'rank_title', label: '직위' },
          { key: 'rank_level', label: '직급' },
        ];
      case 'basic':
        return [
          { key: 'full_name', label: '이름' },
          { key: 'nickname', label: '닉네임' },
          { key: 'email', label: '이메일', disabled: true },
          { key: 'personal_email', label: '개인 이메일' },
          { key: 'employee_number', label: '사번' },
        ];
      case 'join':
        return [
          { key: 'join_date', label: '입사일', type: 'date' },
        ];
      case 'personal':
        return [
          { key: 'birthday', label: '생일', type: 'date' },
          { key: 'nationality', label: '국적' },
          { key: 'phone', label: '휴대전화번호' },
        ];
      case 'address':
        return [
          { key: 'address', label: '주소' },
          { key: 'detail_address', label: '상세주소' },
          { key: 'zipcode', label: '우편번호' },
        ];
      case 'bank':
        return [
          { key: 'bank_name', label: '은행명' },
          { key: 'bank_account', label: '계좌번호' },
        ];
      default:
        return [];
    }
  };

  const getTenureBadge = () => {
    if (!profileData?.join_date) return null;
    const joinDate = new Date(profileData.join_date);
    const now = new Date();
    const months = differenceInMonths(now, joinDate);
    const days = differenceInDays(now, joinDate) - months * 30;
    if (months > 0) {
      return `${months}개월 ${days > 0 ? days + '일' : ''} 재직`;
    }
    return `${differenceInDays(now, joinDate)}일 재직`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!profileData) return null;

  const renderSection = (
    sectionKey: string,
    title: string,
    icon: React.ReactNode,
    renderContent: () => React.ReactNode
  ) => {
    const isEditing = editSection === sectionKey;
    const fields = getSectionFields(sectionKey);

    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {!isEditing ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => startEdit(sectionKey)}>
              <Pencil className="h-3 w-3" />
              변경
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                <X className="h-3 w-3" />
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={saveSection} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                저장
              </Button>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  type={(f as any).type || 'text'}
                  value={(editValues as any)[f.key] || ''}
                  onChange={(e) => setEditValues({ ...editValues, [f.key]: e.target.value })}
                  disabled={(f as any).disabled}
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>
        ) : (
          renderContent()
        )}
      </div>
    );
  };

  const InfoRow = ({ label, value, badge }: { label: string; value?: string; badge?: React.ReactNode }) => (
    <div className="flex items-center gap-4 py-1.5">
      <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value || <span className="text-muted-foreground/50">입력하기</span>}</span>
      {badge}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-2xl font-bold text-primary">
            {profileData.full_name?.charAt(0) || '?'}
          </div>
          <div>
            <CardTitle className="text-xl">{profileData.full_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {profileData.department || '부서 미설정'} {profileData.position && `· ${profileData.position}`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <Separator />

        {renderSection('org', '조직 · 직책', <Building2 className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow label="조직 (부서)" value={profileData.department} />
            <InfoRow label="직책" value={profileData.position} />
          </div>
        ))}

        <Separator />

        {renderSection('job', '직무 · 직군', <Briefcase className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow label="직무" value={profileData.job_title} />
            <InfoRow label="직군" value={profileData.job_group} />
          </div>
        ))}

        <Separator />

        {renderSection('rank', '직위 · 직급', <Hash className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow label="직위" value={profileData.rank_title} />
            <InfoRow label="직급" value={profileData.rank_level} />
          </div>
        ))}

        <Separator />

        {renderSection('basic', '기본 정보', <User className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow label="이름" value={profileData.full_name} />
            {profileData.nickname && <InfoRow label="닉네임" value={profileData.nickname} />}
            <InfoRow label="이메일" value={profileData.email} />
            {profileData.personal_email && <InfoRow label="개인 이메일" value={profileData.personal_email} />}
            <InfoRow label="사번" value={profileData.employee_number} />
          </div>
        ))}

        <Separator />

        {renderSection('join', '입사 정보', <Calendar className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow
              label="입사일"
              value={profileData.join_date ? format(new Date(profileData.join_date), 'yyyy년 M월 d일', { locale: ko }) : undefined}
              badge={getTenureBadge() ? (
                <Badge variant="default" className="text-xs">{getTenureBadge()}</Badge>
              ) : undefined}
            />
          </div>
        ))}

        <Separator />

        {renderSection('personal', '개인 정보', <Globe className="h-4 w-4" />, () => (
          <div className="space-y-1">
            {profileData.birthday && (
              <InfoRow label="생일" value={format(new Date(profileData.birthday), 'yyyy년 M월 d일', { locale: ko })} />
            )}
            <InfoRow label="국적" value={profileData.nationality} />
            <InfoRow label="휴대전화" value={profileData.phone} />
          </div>
        ))}

        <Separator />

        {renderSection('address', '주소', <MapPin className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow 
              label="주소" 
              value={[profileData.address, profileData.detail_address].filter(Boolean).join(' ') || undefined} 
            />
            {profileData.zipcode && <InfoRow label="우편번호" value={profileData.zipcode} />}
          </div>
        ))}

        <Separator />

        {renderSection('bank', '급여계좌', <CreditCard className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow 
              label="계좌" 
              value={profileData.bank_name && profileData.bank_account 
                ? `${profileData.bank_name} ${profileData.bank_account}` 
                : undefined} 
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ProfileInfoCard;
