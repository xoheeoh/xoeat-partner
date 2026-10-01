import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getMyStore, setStoreStatus as apiSetStoreStatus } from '@apis/storeApi';
import { isOk } from '@apis/client';
import type { Store, StoreStatus } from '@typ/domain';

type StoreContextType = {
  /** 로그인한 사장님의 가게. 로딩 전·로그아웃 상태는 null */
  store: Store | null;
  loading: boolean;
  /** 서버에서 다시 읽는다 */
  refresh: () => Promise<Store | null>;
  /** 화면이 받은 최신 값을 바로 반영한다 (수정 화면 저장 후) */
  setStore: (store: Store | null) => void;
  /** 영업 상태 변경 */
  setStatus: (status: StoreStatus) => Promise<boolean>;
};

const StoreContext = createContext<StoreContextType | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore 는 <StoreProvider> 안에서 사용해야 합니다.');
  return ctx;
}

/** 로그인 상태에서 가게 정보를 한 번 읽어 모든 화면이 공유한다 */
export function StoreProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await getMyStore();
    const next = isOk(res) && res.store ? res.store : null;
    setStore(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    if (enabled) refresh();
    else setStore(null);
  }, [enabled, refresh]);

  const setStatus = useCallback(async (status: StoreStatus) => {
    const res = await apiSetStoreStatus(status);
    if (isOk(res) && res.store) {
      setStore(res.store);
      return true;
    }
    return false;
  }, []);

  const value = useMemo<StoreContextType>(() => ({ store, loading, refresh, setStore, setStatus }), [store, loading, refresh, setStatus]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
