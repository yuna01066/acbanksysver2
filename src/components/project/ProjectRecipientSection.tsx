import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  recipient: any | null;
  onRecipientLinked: (recipientId: string) => void;
}

const ProjectRecipientSection: React.FC<Props> = ({ projectId, recipient, onRecipientLinked }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  });

  const createAndLink = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인 필요');
      const { data, error } = await supabase
        .from('recipients')
        .insert({
          company_name: form.company_name.trim(),
          contact_person: form.contact_person.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim() || null,
          user_id: user.id,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Link to project
      const { error: linkError } = await supabase
        .from('projects')
        .update({ recipient_id: data.id })
        .eq('id', projectId);
      if (linkError) throw linkError;

      return data.id;
    },
    onSuccess: (recipientId) => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      setIsCreating(false);
      setForm({ company_name: '', contact_person: '', phone: '', email: '', address: '' });
      toast.success('고객사가 등록 및 연결되었습니다.');
    },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  if (recipient) {
    return (
      <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div>
            <span className="text-muted-foreground text-[10px] block">업체명</span>
            <p className="font-medium">{recipient.company_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px] block">담당자</span>
            <p>{recipient.contact_person}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px] block">연락처</span>
            <p>{recipient.phone}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-[10px] block">이메일</span>
            <p>{recipient.email}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="space-y-2 p-3 border rounded-lg">
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="업체명 *"
            value={form.company_name}
            onChange={(e) => setForm(p => ({ ...p, company_name: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            placeholder="담당자 *"
            value={form.contact_person}
            onChange={(e) => setForm(p => ({ ...p, contact_person: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            placeholder="연락처 *"
            value={form.phone}
            onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            placeholder="이메일 *"
            value={form.email}
            onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <Input
          placeholder="주소 (선택)"
          value={form.address}
          onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
          className="h-8 text-xs"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsCreating(false)}>
            <X className="h-3 w-3 mr-1" /> 취소
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={!form.company_name.trim() || !form.contact_person.trim() || !form.phone.trim() || !form.email.trim() || createAndLink.isPending}
            onClick={() => createAndLink.mutate()}
          >
            <Save className="h-3 w-3" /> {createAndLink.isPending ? '등록 중...' : '등록 및 연결'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-3">
      <p className="text-xs text-muted-foreground mb-2">연결된 고객사가 없습니다.</p>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => setIsCreating(true)}
      >
        <Plus className="h-3 w-3" /> 신규 고객사 등록
      </Button>
    </div>
  );
};

export default ProjectRecipientSection;
