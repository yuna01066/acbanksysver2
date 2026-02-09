import React, { useState, useEffect } from 'react';
import AvatarUpload from '@/components/employee/AvatarUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  User, Mail, Phone, MapPin, Building2, Briefcase,
  Calendar, CreditCard, Globe, Hash, Pencil, Save, X, Loader2,
  Clock, Award, AlertTriangle, GraduationCap, Heart, FileText, Wallet, CalendarDays
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
  work_type: string;
  work_hours_per_week: number;
  overtime_policy: string;
  salary_info: string;
  wage_contract: string;
  leave_policy: string;
  holidays: string;
  leave_history: string;
  awards: string;
  disciplinary: string;
  career_history: string;
  education: string;
  special_notes: string;
  family_info: string;
  avatar_url: string;
}

const defaultProfile: ProfileData = {
  full_name: '', email: '', phone: '', department: '', position: '',
  employee_number: '', birthday: '', address: '', detail_address: '', zipcode: '',
  nationality: '대한민국(KOR)', bank_name: '', bank_account: '', join_date: '',
  job_title: '', job_group: '', rank_title: '', rank_level: '', nickname: '', personal_email: '',
  work_type: '', work_hours_per_week: 40, overtime_policy: '', salary_info: '',
  wage_contract: '', leave_policy: '', holidays: '', leave_history: '',
  awards: '', disciplinary: '', career_history: '', education: '',
  special_notes: '', family_info: '', avatar_url: '',
};

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
      const d = data as any;
      setProfileData({
        ...defaultProfile,
        full_name: d.full_name || '',
        email: d.email || '',
        phone: d.phone || '',
        department: d.department || '',
        position: d.position || '',
        employee_number: d.employee_number || '',
        birthday: d.birthday || '',
        address: d.address || '',
        detail_address: d.detail_address || '',
        zipcode: d.zipcode || '',
        nationality: d.nationality || '대한민국(KOR)',
        bank_name: d.bank_name || '',
        bank_account: d.bank_account || '',
        join_date: d.join_date || '',
        job_title: d.job_title || '',
        job_group: d.job_group || '',
        rank_title: d.rank_title || '',
        rank_level: d.rank_level || '',
        nickname: d.nickname || '',
        personal_email: d.personal_email || '',
        work_type: d.work_type || '',
        work_hours_per_week: d.work_hours_per_week ?? 40,
        overtime_policy: d.overtime_policy || '',
        salary_info: d.salary_info || '',
        wage_contract: d.wage_contract || '',
        leave_policy: d.leave_policy || '',
        holidays: d.holidays || '',
        leave_history: d.leave_history || '',
        awards: d.awards || '',
        disciplinary: d.disciplinary || '',
        career_history: d.career_history || '',
        education: d.education || '',
        special_notes: d.special_notes || '',
        family_info: d.family_info || '',
        avatar_url: d.avatar_url || '',
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

  type FieldDef = { key: string; label: string; type?: string; disabled?: boolean; multiline?: boolean };

  const getSectionFields = (section: string): FieldDef[] => {
    switch (section) {
      case 'org': return [
        { key: 'department', label: '조직 (부서)' },
        { key: 'position', label: '직책' },
      ];
      case 'job': return [
        { key: 'job_title', label: '직무' },
        { key: 'job_group', label: '직군' },
      ];
      case 'rank': return [
        { key: 'rank_title', label: '직위' },
        { key: 'rank_level', label: '직급' },
      ];
      case 'basic': return [
        { key: 'full_name', label: '이름' },
        { key: 'nickname', label: '닉네임' },
        { key: 'email', label: '이메일', disabled: true },
        { key: 'personal_email', label: '개인 이메일' },
        { key: 'employee_number', label: '사번' },
      ];
      case 'join': return [
        { key: 'join_date', label: '입사일', type: 'date' },
      ];
      case 'personal': return [
        { key: 'birthday', label: '생일', type: 'date' },
        { key: 'nationality', label: '국적' },
        { key: 'phone', label: '휴대전화번호' },
      ];
      case 'address': return [
        { key: 'address', label: '주소' },
        { key: 'detail_address', label: '상세주소' },
        { key: 'zipcode', label: '우편번호' },
      ];
      case 'bank': return [
        { key: 'bank_name', label: '은행명' },
        { key: 'bank_account', label: '계좌번호' },
      ];
      case 'work': return [
        { key: 'work_type', label: '근무 유형' },
        { key: 'work_hours_per_week', label: '주당 근무시간', type: 'number' },
      ];
      case 'overtime': return [
        { key: 'overtime_policy', label: '초과 근무 보상 정책', multiline: true },
      ];
      case 'wage': return [
        { key: 'wage_contract', label: '임금 계약 정보', multiline: true },
      ];
      case 'salary': return [
        { key: 'salary_info', label: '급여 지급 정보', multiline: true },
      ];
      case 'leave': return [
        { key: 'leave_policy', label: '연차 정책', multiline: true },
      ];
      case 'holidays': return [
        { key: 'holidays', label: '쉬는 날', multiline: true },
      ];
      case 'leave_history': return [
        { key: 'leave_history', label: '휴직 이력', multiline: true },
      ];
      case 'awards': return [
        { key: 'awards', label: '수상', multiline: true },
      ];
      case 'disciplinary': return [
        { key: 'disciplinary', label: '징계', multiline: true },
      ];
      case 'career': return [
        { key: 'career_history', label: '경력 정보', multiline: true },
      ];
      case 'education': return [
        { key: 'education', label: '학력', multiline: true },
      ];
      case 'special': return [
        { key: 'special_notes', label: '특이사항', multiline: true },
      ];
      case 'family': return [
        { key: 'family_info', label: '가족', multiline: true },
      ];
      default: return [];
    }
  };

  const getTenureBadge = () => {
    if (!profileData?.join_date) return null;
    const joinDate = new Date(profileData.join_date);
    const now = new Date();
    const months = differenceInMonths(now, joinDate);
    const days = differenceInDays(now, joinDate) - months * 30;
    if (months > 0) return `${months}개월 ${days > 0 ? days + '일' : ''} 재직`;
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
              <div key={f.key} className={f.multiline ? 'md:col-span-2' : ''}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {f.multiline ? (
                  <Textarea
                    value={(editValues as any)[f.key] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [f.key]: e.target.value })}
                    rows={3}
                    className="text-sm mt-1 resize-none"
                  />
                ) : (
                  <Input
                    type={f.type || 'text'}
                    value={(editValues as any)[f.key] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [f.key]: e.target.value })}
                    disabled={f.disabled}
                    className="h-9 text-sm mt-1"
                  />
                )}
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
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium whitespace-pre-line">{value || <span className="text-muted-foreground/50">입력하기</span>}</span>
      {badge}
    </div>
  );

  const SimpleSection = ({ sectionKey, title, icon, fieldKey, label }: {
    sectionKey: string; title: string; icon: React.ReactNode; fieldKey: keyof ProfileData; label: string;
  }) => renderSection(sectionKey, title, icon, () => (
    <InfoRow label={label} value={(profileData as any)[fieldKey] || undefined} />
  ));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-4">
          <AvatarUpload
            userId={user!.id}
            avatarUrl={profileData.avatar_url || null}
            name={profileData.full_name}
            size="lg"
            editable
            onUploaded={(url) => setProfileData({ ...profileData, avatar_url: url })}
          />
          <div>
            <CardTitle className="text-xl">{profileData.full_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {profileData.department || '부서 미설정'} {profileData.position && `· ${profileData.position}`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* 인사 정보 */}
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
          <InfoRow
            label="입사일"
            value={profileData.join_date ? format(new Date(profileData.join_date), 'yyyy년 M월 d일', { locale: ko }) : undefined}
            badge={getTenureBadge() ? <Badge variant="default" className="text-xs">{getTenureBadge()}</Badge> : undefined}
          />
        ))}

        <Separator />
        {renderSection('personal', '개인 정보', <Globe className="h-4 w-4" />, () => (
          <div className="space-y-1">
            {profileData.birthday && (
              <InfoRow label="생일" value={format(new Date(profileData.birthday), 'yyyy년 M월 d일', { locale: ko })} />
            )}
            {!profileData.birthday && <InfoRow label="생일" />}
            <InfoRow label="국적" value={profileData.nationality} />
            <InfoRow label="휴대전화" value={profileData.phone} />
          </div>
        ))}

        <Separator />
        {renderSection('address', '주소', <MapPin className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow label="주소" value={[profileData.address, profileData.detail_address].filter(Boolean).join(' ') || undefined} />
            {profileData.zipcode && <InfoRow label="우편번호" value={profileData.zipcode} />}
          </div>
        ))}

        <Separator />
        {renderSection('bank', '급여계좌', <CreditCard className="h-4 w-4" />, () => (
          <InfoRow label="계좌" value={profileData.bank_name && profileData.bank_account ? `${profileData.bank_name} ${profileData.bank_account}` : undefined} />
        ))}

        {/* 근무 정보 */}
        <Separator />
        {renderSection('work', '근무 정보', <Clock className="h-4 w-4" />, () => (
          <div className="space-y-1">
            <InfoRow label="근무 유형" value={profileData.work_type} />
            <InfoRow label="주당 근무시간" value={profileData.work_hours_per_week ? `주 ${profileData.work_hours_per_week}시간` : undefined} />
          </div>
        ))}

        <Separator />
        <SimpleSection sectionKey="overtime" title="초과 근무 보상 정보" icon={<Clock className="h-4 w-4" />} fieldKey="overtime_policy" label="보상 정책" />

        <Separator />
        <SimpleSection sectionKey="wage" title="임금 계약 정보" icon={<Wallet className="h-4 w-4" />} fieldKey="wage_contract" label="임금 계약" />

        <Separator />
        <SimpleSection sectionKey="salary" title="급여 지급 정보" icon={<Wallet className="h-4 w-4" />} fieldKey="salary_info" label="급여 지급" />

        {/* 휴가 정보 */}
        <Separator />
        <SimpleSection sectionKey="leave" title="휴가 정보" icon={<CalendarDays className="h-4 w-4" />} fieldKey="leave_policy" label="연차 정책" />

        <Separator />
        <SimpleSection sectionKey="holidays" title="쉬는 날 정보" icon={<CalendarDays className="h-4 w-4" />} fieldKey="holidays" label="쉬는 날" />

        <Separator />
        <SimpleSection sectionKey="leave_history" title="휴직 이력" icon={<FileText className="h-4 w-4" />} fieldKey="leave_history" label="휴직 이력" />

        {/* 이력 정보 */}
        <Separator />
        <SimpleSection sectionKey="awards" title="수상" icon={<Award className="h-4 w-4" />} fieldKey="awards" label="수상" />

        <Separator />
        <SimpleSection sectionKey="disciplinary" title="징계" icon={<AlertTriangle className="h-4 w-4" />} fieldKey="disciplinary" label="징계" />

        <Separator />
        <SimpleSection sectionKey="career" title="경력 정보" icon={<Briefcase className="h-4 w-4" />} fieldKey="career_history" label="경력" />

        <Separator />
        <SimpleSection sectionKey="education" title="학력" icon={<GraduationCap className="h-4 w-4" />} fieldKey="education" label="학력" />

        <Separator />
        <SimpleSection sectionKey="special" title="특이사항" icon={<FileText className="h-4 w-4" />} fieldKey="special_notes" label="특이사항" />

        <Separator />
        <SimpleSection sectionKey="family" title="가족" icon={<Heart className="h-4 w-4" />} fieldKey="family_info" label="가족" />
      </CardContent>
    </Card>
  );
};

export default ProfileInfoCard;
