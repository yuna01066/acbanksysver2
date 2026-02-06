import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PluuugSyncEvent {
  id: string;
  quote_id: string;
  user_id: string;
  event_type: 'deleted' | 'modified';
  pluuug_estimate_id: string;
  details: any;
  status: string;
  resolved_action: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function usePluuugSyncEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<PluuugSyncEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('pluuug_sync_events')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents((data || []) as PluuugSyncEvent[]);
    } catch (err) {
      console.error('[SyncEvents] Fetch error:', err);
    }
  }, [user]);

  // Poll every 5 minutes
  useEffect(() => {
    if (!user) return;
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, fetchEvents]);

  const resolveEvent = useCallback(async (eventId: string, action: 'delete_local' | 'unlink' | 'dismiss') => {
    if (!user) return;
    setLoading(true);
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      if (action === 'delete_local') {
        // Delete the local quote
        const { error } = await supabase
          .from('saved_quotes')
          .delete()
          .eq('id', event.quote_id);
        if (error) throw error;
        toast.success('로컬 견적서가 삭제되었습니다.');
      } else if (action === 'unlink') {
        // Unlink: clear pluuug sync metadata
        const { error } = await supabase
          .from('saved_quotes')
          .update({
            pluuug_synced: false,
            pluuug_synced_at: null,
            pluuug_estimate_id: null,
          })
          .eq('id', event.quote_id);
        if (error) throw error;
        toast.success('Pluuug 연결이 해제되었습니다.');
      }

      // Mark event as resolved
      await supabase
        .from('pluuug_sync_events')
        .update({
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          resolved_action: action,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err: any) {
      console.error('[SyncEvents] Resolve error:', err);
      toast.error(`처리 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, events]);

  const triggerManualSync = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pluuug-reverse-sync');
      if (error) throw error;
      console.log('[Reverse Sync] Result:', data);
      toast.success(`동기화 확인 완료: ${data?.checked || 0}건 확인, ${data?.autoUnlinked || 0}건 자동 해제, ${data?.events || 0}건 변경 감지`);
      await fetchEvents();
    } catch (err: any) {
      console.error('[Reverse Sync] Error:', err);
      toast.error(`동기화 확인 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, fetchEvents]);

  return { events, loading, resolveEvent, triggerManualSync, fetchEvents };
}
