import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, User, Plus, Save, X } from 'lucide-react';

export interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (contact: ContactInfo) => void;
  recipientCompany?: string | null;
}

const LinkContactDialog: React.FC<Props> = ({ open, onOpenChange, onSelect, recipientCompany }) => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('existing');
  const [form, setForm] = useState<ContactInfo>({ name: '', phone: '', email: '' });

  // Fetch unique contacts from saved_quotes
  const { data: quoteContacts = [] } = useQuery({
    queryKey: ['quote-contacts', recipientCompany],
    queryFn: async () => {
      let query = supabase
        .from('saved_quotes')
        .select('recipient_name, recipient_phone, recipient_email, recipient_company')
        .not('recipient_name', 'is', null);

      if (recipientCompany) {
        query = query.eq('recipient_company', recipientCompany);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Deduplicate by name
      const map = new Map<string, ContactInfo & { company?: string }>();
      (data || []).forEach((q: any) => {
        if (!q.recipient_name) return;
        const key = `${q.recipient_name}-${q.recipient_phone || ''}`;
        if (!map.has(key)) {
          map.set(key, {
            name: q.recipient_name,
            phone: q.recipient_phone || '',
            email: q.recipient_email || '',
            company: q.recipient_company || '',
          });
        }
      });
      return Array.from(map.values());
    },
    enabled: open,
  });

  // Also fetch from recipients table
  const { data: recipientContacts = [] } = useQuery({
    queryKey: ['recipient-contacts', recipientCompany],
    queryFn: async () => {
      let query = supabase
        .from('recipients')
        .select('contact_person, phone, email, company_name');

      if (recipientCompany) {
        query = query.eq('company_name', recipientCompany);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        name: r.contact_person,
        phone: r.phone,
        email: r.email,
        company: r.company_name,
      }));
    },
    enabled: open,
  });

  const allContacts = useMemo(() => {
    const map = new Map<string, ContactInfo & { company?: string }>();
    [...recipientContacts, ...quoteContacts].forEach(c => {
      const key = `${c.name}-${c.phone}`;
      if (!map.has(key)) map.set(key, c);
    });
    return Array.from(map.values());
  }, [quoteContacts, recipientContacts]);

  const filtered = allContacts.filter(c => {
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) ||
      c.phone.toLowerCase().includes(s) ||
      (c.company || '').toLowerCase().includes(s);
  });

  const handleManualSave = () => {
    if (!form.name.trim()) return;
    onSelect({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() });
    setForm({ name: '', phone: '', email: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            담당자 연결
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1 text-xs">기존 담당자 선택</TabsTrigger>
            <TabsTrigger value="new" className="flex-1 text-xs">직접 입력</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름, 연락처, 회사명 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filtered.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
                  <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => setTab('new')}>
                    직접 입력하기
                  </Button>
                </div>
              ) : (
                filtered.map((c, i) => (
                  <button
                    key={i}
                    className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors text-sm"
                    onClick={() => onSelect({ name: c.name, phone: c.phone, email: c.email })}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{c.name}</p>
                      {c.company && (
                        <Badge variant="outline" className="text-[9px]">{c.company}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.phone}{c.phone && c.email ? ' · ' : ''}{c.email}
                    </p>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-3 mt-3">
            <Input
              placeholder="담당자명 *"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder="연락처"
              value={form.phone}
              onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
            />
            <Input
              placeholder="이메일"
              value={form.email}
              onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-3 w-3 mr-1" /> 취소
              </Button>
              <Button size="sm" disabled={!form.name.trim()} onClick={handleManualSave}>
                <Save className="h-3 w-3 mr-1" /> 연결
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default LinkContactDialog;
