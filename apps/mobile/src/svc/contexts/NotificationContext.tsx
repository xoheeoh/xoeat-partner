import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';

import { getUnreadCount, markNotificationsRead, subscribeNotifications } from '@apis/notificationApi';
import { isOk } from '@apis/client';
import type { AppNotification } from '@typ/domain';

type NotificationContextType = {
  /** 안 읽은 알림 개수. 홈의 종 아이콘 뱃지가 본다 */
  unreadCount: number;
  /** 마지막으로 Realtime 으로 들어온 알림. 알림함 화면이 이 값을 보고 목록을 다시 읽는다 */
  lastArrived: { seq: number; notification: AppNotification } | null;
  refreshUnread: () => Promise<void>;
  /** 읽음 처리 후 개수 갱신. ids 없으면 전부 */
  markRead: (ids?: number[]) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications 는 <NotificationProvider> 안에서 사용해야 합니다.');
  return ctx;
}

/**
 * 알림 Realtime 구독을 앱에 하나만 두고 안 읽은 개수를 관리한다.
 * 새 주문 토스트와 알림음은 OrderFeedProvider 가 이미 띄우므로 여기서는 공지 알림만 토스트로 알린다.
 */
export function NotificationProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastArrived, setLastArrived] = useState<NotificationContextType['lastArrived']>(null);
  const seq = useRef(0);

  const refreshUnread = useCallback(async () => {
    const res = await getUnreadCount();
    if (isOk(res) && typeof res.count === 'number') setUnreadCount(res.count);
  }, []);

  const markRead = useCallback(
    async (ids?: number[]) => {
      const res = await markNotificationsRead(ids);
      if (isOk(res)) await refreshUnread();
    },
    [refreshUnread],
  );

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      setLastArrived(null);
      return;
    }
    refreshUnread();

    const unsubscribe = subscribeNotifications((n) => {
      seq.current += 1;
      setLastArrived({ seq: seq.current, notification: n });
      setUnreadCount((c) => c + 1);
      if (n.kind === 'NOTICE') {
        Toast.show({ type: 'success', text1: n.title, text2: n.body, visibilityTime: 4000 });
      }
    });
    return unsubscribe;
  }, [enabled, refreshUnread]);

  const value = useMemo<NotificationContextType>(
    () => ({ unreadCount, lastArrived, refreshUnread, markRead }),
    [unreadCount, lastArrived, refreshUnread, markRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
