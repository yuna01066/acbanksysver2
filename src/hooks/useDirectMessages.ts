import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationPartner {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

export const useDirectMessages = (partnerId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!user || !partnerId) return;
    setLoading(true);

    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(200);

    if (data) setMessages(data as DirectMessage[]);
    setLoading(false);

    // Mark unread messages as read
    if (data && data.length > 0) {
      const unreadIds = data
        .filter((m: any) => m.receiver_id === user.id && !m.is_read)
        .map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('direct_messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    }
  }, [user, partnerId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !partnerId) return;

    const channel = supabase
      .channel(`dm-${[user.id, partnerId].sort().join('-')}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      }, (payload) => {
        const msg = payload.new as DirectMessage;
        if (
          (msg.sender_id === user.id && msg.receiver_id === partnerId) ||
          (msg.sender_id === partnerId && msg.receiver_id === user.id)
        ) {
          setMessages(prev => [...prev, msg]);
          // Auto-mark as read if we're the receiver
          if (msg.receiver_id === user.id && !msg.is_read) {
            supabase
              .from('direct_messages')
              .update({ is_read: true })
              .eq('id', msg.id)
              .then();
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!user || !partnerId || !text.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: partnerId,
        message: text.trim(),
      });
      if (error) throw error;
    } catch (e: any) {
      throw e;
    } finally {
      setSending(false);
    }
  }, [user, partnerId]);

  return { messages, loading, sending, sendMessage, refetch: fetchMessages };
};

export const useConversationList = () => {
  const { user } = useAuth();
  const [partners, setPartners] = useState<ConversationPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Get all DMs involving the user
    const { data: dms } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!dms || dms.length === 0) {
      setPartners([]);
      setLoading(false);
      return;
    }

    // Group by partner
    const partnerMap = new Map<string, { lastMsg: any; unread: number }>();
    for (const dm of dms) {
      const pid = dm.sender_id === user.id ? dm.receiver_id : dm.sender_id;
      if (!partnerMap.has(pid)) {
        partnerMap.set(pid, { lastMsg: dm, unread: 0 });
      }
      if (dm.receiver_id === user.id && !dm.is_read) {
        const entry = partnerMap.get(pid)!;
        entry.unread++;
      }
    }

    const partnerIds = Array.from(partnerMap.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, department, position')
      .in('id', partnerIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const result: ConversationPartner[] = partnerIds
      .map(pid => {
        const entry = partnerMap.get(pid)!;
        const prof = profileMap.get(pid);
        return {
          user_id: pid,
          full_name: prof?.full_name || '알 수 없음',
          avatar_url: prof?.avatar_url || null,
          department: prof?.department || null,
          position: prof?.position || null,
          last_message: entry.lastMsg.message,
          last_message_at: entry.lastMsg.created_at,
          unread_count: entry.unread,
        };
      })
      .sort((a, b) => {
        const ta = a.last_message_at || '';
        const tb = b.last_message_at || '';
        return tb.localeCompare(ta);
      });

    setPartners(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dm-list-refresh')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  return { partners, loading, refetch: fetchConversations };
};
