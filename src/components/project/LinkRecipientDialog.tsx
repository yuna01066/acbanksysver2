import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Building2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (recipientId: string) => void;
}

const LinkRecipientDialog: React.FC<Props> = ({ open, onOpenChange, onSelect }) => {
  const [search, setSearch] = useState('');

  const { data: recipients = [] } = useQuery({
    queryKey: ['recipients-for-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipients')
        .select('id, company_name, contact_person, phone')
        .order('company_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const filtered = recipients.filter((r: any) =>
    r.company_name.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_person.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>고객사 연결</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="고객사를 검색하세요..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-1 mt-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
            </div>
          ) : (
            filtered.map((r: any) => (
              <button
                key={r.id}
                className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors text-sm"
                onClick={() => onSelect(r.id)}
              >
                <p className="font-medium">{r.company_name}</p>
                <p className="text-xs text-muted-foreground">{r.contact_person} · {r.phone}</p>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkRecipientDialog;
