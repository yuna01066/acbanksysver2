import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Plus, Save, X, Phone, Mail, User } from 'lucide-react';
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
      <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1.5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold">{recipient.company_name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{recipient.contact_person}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{recipient.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{recipient.email}</span>
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
