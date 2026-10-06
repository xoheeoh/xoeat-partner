import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { MainTabParamList, RootStackParamList } from '@typ/navigation';
import type { Order, OrderTab } from '@typ/domain';
import { getTodayOrders } from '@apis/orderApi';
import { isOk } from '@apis/client';
import { useOrderFeed } from '@contexts/OrderFeedContext';
import { useStore } from '@contexts/StoreContext';
import { todayKo } from '@utils/formatter';
import { OrderCard } from '@components/order';
import { ScreenWrapper, SkeletonList, Typography } from '@components/common';
import { theme } from '@styles';

const TABS: { key: OrderTab; label: string }[] = [
  { key: 'PENDING', label: '접수대기' },
  { key: 'ING', label: '진행중' },
  { key: 'COMPLETED', label: '완료' },
  { key: 'CLOSED', label: '거절·취소' },
];

const EMPTY_TEXT: Record<OrderTab, string> = {
  PENDING: '접수를 기다리는 주문이 없어요',
  ING: '진행중인 주문이 없어요',
  COMPLETED: '오늘 완료된 주문이 없어요',
  CLOSED: '거절·취소된 주문이 없어요',
};

/** 오늘 주문을 상태 탭별로 보여 주고, Realtime 변경이 오면 현재 탭을 다시 읽는다 */
const OrdersScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<MainTabParamList, 'Orders'>>();
  const { store } = useStore();
  const { counts, lastEvent, refreshCounts } = useOrderFeed();

  const [tab, setTab] = useState<OrderTab>('PENDING');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const handledSeq = useRef(0);

  const load = useCallback(async (t: OrderTab, silent = false) => {
    if (!silent) setOrders(null);
    const res = await getTodayOrders(t);
    if (isOk(res) && res.orders) setOrders(res.orders);
    else setOrders([]);
  }, []);

  // 홈에서 특정 탭을 지정해 들어온 경우
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  useFocusEffect(
    useCallback(() => {
      load(tab);
      refreshCounts();
    }, [tab, load, refreshCounts]),
  );

  // Realtime: 새 주문·상태 변경이 오면 조용히 다시 읽는다
  useEffect(() => {
    if (!lastEvent || lastEvent.seq === handledSeq.current) return;
    handledSeq.current = lastEvent.seq;
    load(tab, true);
  }, [lastEvent, tab, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(tab, true), refreshCounts()]);
    setRefreshing(false);
  };

  /** 액션 후 서버가 돌려준 주문으로 목록을 제자리 갱신하고, 잠시 뒤 다시 읽어 다른 탭으로 옮겨간 주문을 뺀다 */
  const handleChanged = (updated: Order) => {
    setOrders((prev) => (prev ?? []).map((o) => (o.id === updated.id ? updated : o)));
    refreshCounts();
    setTimeout(() => load(tab, true), 400);
  };

  return (
    <ScreenWrapper backgroundColor={theme.colors.bg} inTab>
      <View style={styles.header}>
        <Typography mode="caption1" color="gray500">
          {todayKo()}
        </Typography>
        {store?.status === 'PAUSED' && (
          <View style={styles.paused}>
            <MaterialCommunityIcons name="pause-circle-outline" size={14} color={theme.colors.yellow900} />
            <Typography mode="caption1" color="yellow900">
              영업 일시중지 중 — 새 주문이 들어오지 않아요
            </Typography>
          </View>
        )}
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Typography mode="subtitle3" color={active ? 'orange700' : 'gray500'}>
                {t.label}
              </Typography>
              <View
                style={[
                  styles.count,
                  active && styles.countActive,
                  t.key === 'PENDING' && counts.PENDING > 0 && styles.countPending,
                ]}>
                <Typography
                  mode="caption2"
                  color={t.key === 'PENDING' && counts.PENDING > 0 ? 'white' : active ? 'orange700' : 'gray500'}>
                  {counts[t.key]}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </View>

      {orders === null ? (
        <View style={{ padding: 16 }}>
          <SkeletonList rows={3} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onChanged={handleChanged}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="silverware-clean" size={40} color={theme.colors.gray300} />
              <Typography mode="body1" color="gray500">
                {EMPTY_TEXT[tab]}
              </Typography>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: { backgroundColor: theme.colors.white, paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  paused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.yellow50,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  tab: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.colors.primary },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countActive: { backgroundColor: theme.colors.orange50 },
  countPending: { backgroundColor: theme.colors.primary },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 80 },
});

export default OrdersScreen;
