import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, ArrowLeft, FileText, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';

interface Row {
  id: string;
  quote_number: string;
  quote_date: string;
  project_name: string;
  client_name: string | null;
  recipient_company: string | null;
  total: number;
  created_at: string;
}

const SpaceProjectsListPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('space_project_quotes')
      .select('id, quote_number, quote_date, project_name, client_name, recipient_company, total, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('목록 로드 실패');
      setLoading(false);
      return;
    }
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 견적을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('space_project_quotes').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패');
      return;
    }
    toast.success('삭제되었습니다');
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.project_name?.toLowerCase().includes(s) ||
      r.quote_number?.toLowerCase().includes(s) ||
      r.client_name?.toLowerCase().includes(s) ||
      r.recipient_company?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1" />홈
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">공간 프로젝트 견적 목록</h1>
          <Button onClick={() => navigate('/space-quote')}>
            <Plus className="w-4 h-4 mr-1" />새 견적
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="프로젝트명, 견적번호, 클라이언트로 검색"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              저장된 공간 프로젝트 견적이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => (
              <Card key={r.id} className="hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/space-quotes/${r.id}`)}>
                <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{r.project_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.quote_number} · {r.quote_date} {r.client_name && `· ${r.client_name}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatPrice(r.total)}</div>
                    <div className="text-xs text-muted-foreground">{r.recipient_company || '-'}</div>
                  </div>
                  {(isAdmin || isModerator) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaceProjectsListPage;
