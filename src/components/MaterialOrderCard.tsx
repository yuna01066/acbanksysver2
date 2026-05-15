import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, FileText, Pencil, Trash2, User, Palette, Ruler, Layers, Box, Hash, MessageSquareText, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ordered: { label: '발주완료', color: 'bg-blue-500' },
  pending_delivery: { label: '입고대기', color: 'bg-amber-500' },
  delivered: { label: '입고완료', color: 'bg-emerald-500' },
  cancelled: { label: '취소', color: 'bg-destructive' },
};

export interface MaterialOrderData {
  id: string;
  order_date: string;
  material: string;
  quality: string;
  thickness: string;
  size_name: string;
  width: number;
  height: number;
  quantity: number;
  color_code?: string | null;
  surface_type?: string | null;
  project_id?: string | null;
  quote_id?: string | null;
  quote_item_summary?: string | null;
  user_id: string;
  user_name: string;
  memo?: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; project_name: string } | null;
  saved_quotes?: { id: string; quote_number: string; project_name: string | null } | null;
}

interface Props {
  order: MaterialOrderData;
  canManage?: boolean;
  currentUserId?: string;
  onEdit?: (order: MaterialOrderData) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  showDate?: boolean;
}

const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  iconColor?: string;
  small?: boolean;
}> = ({ icon, label, value, iconColor = 'text-muted-foreground', small }) => (
  <div className={cn("flex items-center", small ? "gap-1.5 py-0.5" : "gap-2.5 py-1")}>
    <span className={cn('shrink-0', iconColor)}>{icon}</span>
    <span className={cn("text-muted-foreground font-medium shrink-0", small ? "min-w-[50px]" : "min-w-[80px]")}>{label}</span>
    <span className="text-foreground font-semibold truncate">{value}</span>
  </div>
);

const MaterialOrderCard: React.FC<Props> = ({ order, canManage, currentUserId, onEdit, onDelete, compact, showDate }) => {
  const navigate = useNavigate();
  const st = STATUS_MAP[order.status] || STATUS_MAP.ordered;

  const handleCopyText = () => {
    const projectName = order.projects?.project_name
      ? order.projects.project_name.slice(0, 2)
      : order.saved_quotes?.project_name
        ? order.saved_quotes.project_name.slice(0, 2)
        : '-';
    const sizeText = order.width && order.height
      ? `${order.size_name} (${order.width}×${order.height})`
      : order.size_name;

    const lines = [
      `<아크뱅크 원판발주> ${projectName}`,
      `재질: ${order.material} ${order.quality}`,
      `컬러 (아크뱅크 코드 (AC- )): ${order.color_code || '-'}`,
      `두께: ${order.thickness}`,
      `양단면: ${order.surface_type || '-'}`,
      `원판 사이즈: ${sizeText}`,
      `수량: ${order.quantity}장`,
      `원판 생산 참고사항: ${order.memo || '-'}`,
      `발주 담당자 : ${order.user_name}`,
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      toast({ title: '클립보드에 복사되었습니다' });
    });
  };

  // Compact mini card for sidebar
  if (compact) {
    const sizeText = order.width && order.height ? `${order.size_name} (${order.width}×${order.height})` : order.size_name;
    return (
      <div className="group rounded-md border border-border/50 bg-muted/20 p-2 text-[10px] space-y-1">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium text-[11px] truncate">{order.material} {order.quality}</span>
          <Badge className={cn('text-[8px] px-1.5 py-0 h-[14px] text-white shrink-0', st.color)}>
            {st.label}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
          <span>{order.thickness}</span>
          <span>{order.color_code || '-'}</span>
          <span>{order.surface_type || '-'}</span>
          <span>{sizeText}</span>
          <span>{order.quantity}장</span>
        </div>
        {showDate && (
          <div className="text-muted-foreground/70">{order.order_date}</div>
        )}
      </div>
    );
  }

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="space-y-2">
          {/* Project / Quote Link + Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {order.projects && (
              <button
                className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                onClick={() => navigate(`/project-management?id=${order.projects!.id}`)}
              >
                <FolderOpen className="h-4 w-4" />
                {order.projects.project_name}
              </button>
            )}
            {order.saved_quotes && (
              <button
                className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                onClick={() => navigate(`/saved-quotes/${order.saved_quotes!.id}`)}
              >
                <FileText className="h-4 w-4" />
                {order.saved_quotes.quote_number}
                {order.saved_quotes.project_name ? ` - ${order.saved_quotes.project_name}` : ''}
              </button>
            )}
            {!order.projects && !order.saved_quotes && (
              <span className="text-sm text-muted-foreground italic">연결 없음</span>
            )}
            <Badge className={cn('text-[11px] px-2 py-0.5 text-white ml-auto', st.color)}>
              {st.label}
            </Badge>
          </div>

          {showDate && (
            <div className="text-xs text-muted-foreground">발주일: {order.order_date}</div>
          )}

          {/* Detail Grid */}
          <div className="grid grid-cols-2 gap-x-6 text-[13px]">
            <InfoRow icon={<Box className="h-4 w-4" />} label="재질" value={`${order.material} ${order.quality}`} iconColor="text-primary" />
            <InfoRow icon={<Palette className="h-4 w-4" />} label="컬러" value={order.color_code || '-'} iconColor="text-pink-500" />
            <InfoRow icon={<Layers className="h-4 w-4" />} label="두께" value={order.thickness} iconColor="text-amber-500" />
            <InfoRow icon={<Ruler className="h-4 w-4" />} label="양단면" value={order.surface_type || '-'} iconColor="text-teal-500" />
            <InfoRow icon={<Hash className="h-4 w-4" />} label="원판 사이즈" value={order.width && order.height ? `${order.size_name} (${order.width}×${order.height})` : order.size_name} iconColor="text-indigo-500" />
            <InfoRow icon={<Hash className="h-4 w-4" />} label="수량" value={`${order.quantity}장`} iconColor="text-emerald-500" />
          </div>

          {/* Production Note */}
          {order.memo && (
            <div className="flex items-start gap-2.5 rounded-lg bg-accent/60 p-3 text-[13px]">
              <MessageSquareText className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground font-medium">원판생산 참고사항</span>
                <p className="text-foreground font-medium mt-0.5">{order.memo}</p>
              </div>
            </div>
          )}

          {/* Author + Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>발주 담당: <span className="font-semibold text-foreground">{order.user_name}</span></span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyText}>
                <Copy className="h-4 w-4" />
              </Button>
              {(onEdit || onDelete) && (canManage || order.user_id === currentUserId) && (
                <>
                  {onEdit && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(order)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(order.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialOrderCard;
