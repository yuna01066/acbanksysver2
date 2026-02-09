import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentBox } from '@/hooks/useDocumentBox';

interface SubmissionStatus {
  userId: string;
  userName: string;
  department: string;
  submittedCategories: string[];
  totalCategories: number;
}

const DocumentSubmissionDashboard: React.FC = () => {
  const { categories, loading: catLoading } = useDocumentBox();
  const [statuses, setStatuses] = useState<SubmissionStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (catLoading || categories.length === 0) return;

    const fetchSubmissions = async () => {
      // Fetch all employees
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, department')
        .eq('is_approved', true)
        .order('full_name');

      // Fetch all employee documents
      const { data: docs } = await supabase
        .from('employee_documents')
        .select('user_id, category_id');

      if (!profiles) { setLoading(false); return; }

      const results: SubmissionStatus[] = profiles.map((p: any) => {
        const userDocs = docs?.filter((d: any) => d.user_id === p.id) || [];
        const submittedCats = [...new Set(userDocs.map((d: any) => d.category_id))];
        return {
          userId: p.id,
          userName: p.full_name,
          department: p.department || '',
          submittedCategories: submittedCats,
          totalCategories: categories.length,
        };
      });

      setStatuses(results);
      setLoading(false);
    };

    fetchSubmissions();
  }, [categories, catLoading]);

  if (catLoading || loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        문서함을 먼저 설정해주세요.
      </div>
    );
  }

  const completedCount = statuses.filter(s => s.submittedCategories.length >= s.totalCategories).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          전체 {statuses.length}명
        </Badge>
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          완료 {completedCount}명
        </Badge>
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          미완료 {statuses.length - completedCount}명
        </Badge>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">이름</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">부서</th>
                {categories.map(cat => (
                  <th key={cat.id} className="text-center px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    {cat.name}
                  </th>
                ))}
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">진행률</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map(status => {
                const progress = status.totalCategories > 0
                  ? Math.round((status.submittedCategories.length / status.totalCategories) * 100)
                  : 0;
                return (
                  <tr key={status.userId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{status.userName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{status.department || '-'}</td>
                    {categories.map(cat => (
                      <td key={cat.id} className="text-center px-3 py-2.5">
                        {status.submittedCategories.includes(cat.id) ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    ))}
                    <td className="text-center px-4 py-2.5">
                      <span className={`text-xs font-medium ${progress === 100 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {progress}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DocumentSubmissionDashboard;
