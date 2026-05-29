import { Card, CardContent } from '@/components/ui/card';
import AdminOnlineUsersPanel from '@/components/AdminOnlineUsersPanel';

const AdminOnlineUsersCard = () => (
  <Card className="glass-card h-full border-border/70 bg-background/85 shadow-sm">
    <CardContent className="p-4">
      <AdminOnlineUsersPanel />
    </CardContent>
  </Card>
);

export default AdminOnlineUsersCard;
