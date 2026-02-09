import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import TeamChatCard from '@/components/TeamChatCard';
import MessengerSidebar, { ChatTarget } from '@/components/chat/MessengerSidebar';
import DirectMessageView from '@/components/chat/DirectMessageView';

const TeamChatPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTarget, setActiveTarget] = useState<ChatTarget>({ type: 'team' });

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <MessageSquare className="h-5 w-5 text-primary" />
        <h1 className="text-base font-semibold text-foreground">메신저</h1>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-72 shrink-0">
          <MessengerSidebar
            activeTarget={activeTarget}
            onSelectTarget={setActiveTarget}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 min-w-0">
          {activeTarget.type === 'team' ? (
            <TeamChatCard />
          ) : (
            <DirectMessageView
              partnerId={activeTarget.partner.user_id}
              partnerName={activeTarget.partner.full_name}
              partnerAvatar={activeTarget.partner.avatar_url}
              partnerDepartment={activeTarget.partner.department}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamChatPage;
