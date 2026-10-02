/**
 * 알림함 어댑터. 목록·안 읽은 개수는 PostgREST, 읽음 처리는 RPC, 새 알림은 Realtime.
 * 알림 행은 서버 트리거가 만들므로 여기에 "생성" 은 없다.
 */
import { run, supabase, unwrap } from './client';
import type { AppNotification } from '@typ/domain';

type Row = {
  id: number;
  kind: AppNotification['kind'];
  title: string;
  body: string;
  order_id: string | null;
  notice_id: number | null;
  read_at: string | null;
  created_at: string;
};

const toNotification = (r: Row): AppNotification => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  orderId: r.order_id,
  noticeId: r.notice_id,
  readAt: r.read_at,
  createdAt: r.created_at,
});

const PAGE_SIZE = 50;

/** 최신순 알림 목록 (최근 50건) */
export const getNotifications = () =>
  run(async () => {
    const rows = unwrap(
      await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE),
    ) as Row[];
    return { notifications: rows.map(toNotification) };
  });

/** 안 읽은 알림 개수. 행은 받지 않고 개수만 센다 */
export const getUnreadCount = () =>
  run(async () => {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    return { count: count ?? 0 };
  });

/** 읽음 처리. ids 를 주면 그것만, 없으면 전부. 처리한 건수를 돌려준다 */
export const markNotificationsRead = (ids?: number[]) =>
  run(async () => {
    const count = unwrap(await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null })) as number;
    return { count };
  });

/** 새 알림 Realtime 구독. RLS 덕분에 필터 없이 구독해도 내 가게 알림만 온다 */
export const subscribeNotifications = (onInsert: (n: AppNotification) => void) => {
  const channel = supabase
    .channel('notifications-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      onInsert(toNotification(payload.new as Row));
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};
