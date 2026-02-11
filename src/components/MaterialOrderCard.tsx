import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, FolderOpen, FileText, Pencil, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const MaterialOrderCard: React.FC<Props> = ({ order, canManage, currentUserId, onEdit, onDelete, compact, showDate }) => {
  const navigate = useNavigate();
  const st = STATUS_MAP[order.status] || STATUS_MAP.ordered;

  return (
    <Card className={cn("group", compact && "border-border/50")}>
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Header line */}
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="h-4 w-4 text-primary shrink-0" />
              <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
                {order.material} {order.quality} {order.thickness}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {order.size_name} ({order.width}×{order.height})
              </Badge>
              <Badge className={cn('text-[10px] px-1.5 py-0 text-white', st.color)}>
                {st.label}
              </Badge>
            </div>

            {/* Detail rows */}
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {order.color_code && (
                <div>컬러: {order.color_code}</div>
              )}
              {order.surface_type && (
                <div>면수: {order.surface_type}</div>
              )}
              <div>수량: {order.quantity}장</div>
              {showDate && <div>발주일: {order.order_date}</div>}
            </div>

            {/* Memo */}
            {order.memo && (
              <p className="text-xs text-muted-foreground">참고: {order.memo}</p>
            )}

            {/* Links */}
            <div className="flex items-center gap-3 flex-wrap">
              {order.projects && (
                <button
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => navigate(`/project-management?project=${order.projects!.id}`)}
                >
                  <FolderOpen className="h-3 w-3" />
                  {order.projects.project_name}
                </button>
              )}
              {order.saved_quotes && (
                <button
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => navigate(`/saved-quotes/${order.saved_quotes!.id}`)}
                >
                  <FileText className="h-3 w-3" />
                  {order.saved_quotes.quote_number}
                </button>
              )}
            </div>

            {/* Author */}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="h-2.5 w-2.5" />
              {order.user_name}
            </div>
          </div>

          {/* Actions */}
          {(onEdit || onDelete) && (canManage || order.user_id === currentUserId) && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(order)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(order.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialOrderCard;
