import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileSignature, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ContractPreviewDialog from '@/components/contract/ContractPreviewDialog';

interface Contract {
  id: string;
  contract_type: string;
  status: string;
  contract_date: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  annual_salary: number | null;
  monthly_salary: number | null;
  signed_at: string | null;
  requested_at: string | null;
  user_name: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: '임시저장', className: 'bg-muted text-muted-foreground' },
  requested: { label: '계약 요청됨', className: 'bg-primary/10 text-primary' },
  signed: { label: '서명 완료', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '거절', className: 'bg-destructive/10 text-destructive' },
};

const CONTRACT_TYPES: Record<string, string> = {
  regular: '정규직',
  fixed_term: '기간제',
  part_time: '파트타임',
};

interface EmployeeContractsPanelProps {
  userId: string;
  isAdmin?: boolean;
}

const EmployeeContractsPanel: React.FC<EmployeeContractsPanelProps> = ({ userId }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewContract, setPreviewContract] = useState<any>(null);

  useEffect(() => {
    fetchContracts();
  }, [userId]);

  const fetchContracts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employment_contracts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContracts(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">전자계약 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contracts.map((c) => {
        const status = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
        return (
          <Card
            key={c.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setPreviewContract(c)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {CONTRACT_TYPES[c.contract_type] || c.contract_type}
                    </span>
                    <Badge className={`text-[10px] ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(c.contract_date), 'yyyy.MM.dd', { locale: ko })}
                    </span>
                    {c.contract_start_date && (
                      <span>
                        기간: {format(new Date(c.contract_start_date), 'yyyy.MM.dd')}
                        {c.contract_end_date && ` ~ ${format(new Date(c.contract_end_date), 'yyyy.MM.dd')}`}
                      </span>
                    )}
                    {c.annual_salary && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        연봉 {(c.annual_salary / 10000).toLocaleString()}만원
                      </span>
                    )}
                  </div>
                  {c.signed_at && (
                    <p className="text-[10px] text-green-600 mt-1">
                      서명일: {format(new Date(c.signed_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {previewContract && (
        <ContractPreviewDialog
          contract={previewContract}
          open={!!previewContract}
          onOpenChange={(open) => !open && setPreviewContract(null)}
        />
      )}
    </div>
  );
};

export default EmployeeContractsPanel;
