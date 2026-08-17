import { supabase, getSafeChannel } from './supabaseClient';
import { BackendNotification } from '../types';

const mapNotification = (row: any): BackendNotification => ({
    id: row.id,
    eventKey: row.event_key || row.id,
    category: row.category,
    title: row.title || 'System Notification',
    message: row.message || '',
    severity: row.severity === 'error' || row.severity === 'success' ? row.severity : 'warning',
    relatedRef: row.related_ref || undefined,
    targetScreen: row.target_screen || 'notifications',
    targetTab: row.target_tab || undefined,
    isActive: row.is_active !== false,
    createdAt: row.created_at || new Date().toISOString()
});

export function subscribeToBackendNotifications(
    businessId: string,
    onUpdate: (notifications: BackendNotification[]) => void,
    onError?: (error: any) => void
): () => void {
    if (!businessId) {
        onUpdate([]);
        return () => { };
    }

    const fetchNotifications = async () => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            onError?.(error);
            return;
        }
        onUpdate((data || []).map(mapNotification));
    };

    fetchNotifications();

    const channel = getSafeChannel(`backend_notifications_${businessId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `business_id=eq.${businessId}` },
            () => fetchNotifications()
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}
