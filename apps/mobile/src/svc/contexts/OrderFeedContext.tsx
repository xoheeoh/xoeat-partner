import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import Toast from 'react-native-toast-message';

import { getTodayCounts, subscribeOrders } from '@apis/orderApi';
import { isOk } from '@apis/client';
import type { Order, OrderTab } from '@typ/domain';

const NEW_ORDER_SOUND = require('../../../assets/sounds/new-order.wav');

type Counts = Record<OrderTab, number>;
const EMPTY: Counts = { PENDING: 0, ING: 0, COMPLETED: 0, CLOSED: 0 };

type OrderFeedContextType = {
  /** 오늘 상태별 건수 */
  counts: Counts;
  /** 마지막으로 서버에서 온 변경. 목록 화면이 이 값을 보고 다시 조회한다 */
  lastEvent: { seq: number; type: 'INSERT' | 'UPDATE'; order: Order } | null;
  /** 건수 다시 읽기 */
  refreshCounts: () => Promise<void>;
  /** 알림음 켜짐 여부 (가게 탭에서 바꾼다) */
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
};

const OrderFeedContext = createContext<OrderFeedContextType | null>(null);

export function useOrderFeed() {
  const ctx = useContext(OrderFeedContext);
  if (!ctx) throw new Error('useOrderFeed 는 <OrderFeedProvider> 안에서 사용해야 합니다.');
  return ctx;
}

/**
 * 주문 Realtime 구독을 앱에 하나만 두고, 새 주문이 오면 알림음 + 토스트 + 건수 갱신을 한다.
 * 어느 탭에 있어도 새 주문을 놓치지 않게 하기 위해 화면이 아니라 프로바이더가 구독한다.
 */
export function OrderFeedProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [lastEvent, setLastEvent] = useState<OrderFeedContextType['lastEvent']>(null);
  const [soundOn, setSoundOn] = useState(true);
  const seq = useRef(0);
  const player = useAudioPlayer(NEW_ORDER_SOUND);
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const refreshCounts = useCallback(async () => {
    const res = await getTodayCounts();
    if (isOk(res) && res.counts) setCounts(res.counts);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCounts(EMPTY);
      setLastEvent(null);
      return;
    }
    refreshCounts();

    const unsubscribe = subscribeOrders((e) => {
      seq.current += 1;
      setLastEvent({ seq: seq.current, ...e });
      refreshCounts();

      if (e.type === 'INSERT' && e.order.status === 'PENDING') {
        if (soundOnRef.current) {
          try {
            player.seekTo(0);
            player.play();
          } catch {
            // 웹에서 사용자 상호작용 전에는 재생이 막힐 수 있다. 토스트는 그대로 띄운다
          }
        }
        Toast.show({
          type: 'success',
          text1: `새 주문이 들어왔어요 · ${e.order.orderType === 'DELIVERY' ? '배달' : '포장'} ${e.order.totalAmount.toLocaleString('ko-KR')}원`,
          text2: '주문 현황 탭에서 수락 또는 거절해 주세요.',
          visibilityTime: 4000,
        });
      }
    });
    return unsubscribe;
  }, [enabled, refreshCounts, player]);

  const value = useMemo<OrderFeedContextType>(
    () => ({ counts, lastEvent, refreshCounts, soundOn, setSoundOn }),
    [counts, lastEvent, refreshCounts, soundOn],
  );

  return <OrderFeedContext.Provider value={value}>{children}</OrderFeedContext.Provider>;
}
