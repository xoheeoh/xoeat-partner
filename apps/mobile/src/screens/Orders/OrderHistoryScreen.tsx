import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { RootStackParamList } from '@typ/navigation';
import type { Order, OrderStatus } from '@typ/domain';
import { getOrderHistory } from '@apis/orderApi';
import { isOk, toYmd } from '@apis/client';
import { dateKo, won } from '@utils/formatter';
import { OrderCard } from '@components/order';
import { ScreenWrapper, SkeletonList, Typography } from '@components/common';
import { theme } from '@styles';

const PERIODS = [
  { key: 7, label: '최근 7일' },
  { key: 30, label: '최근 30일' },
  { key: 90, label: '최근 3개월' },
] as const;

const STATUS_FILTERS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'COMPLETED', label: '완료', statuses: ['COMPLETED'] },
  { key: 'CLOSED', label: '거절·취소', statuses: ['REJECTED', 'CANCELED'] },
];

/** 기간·상태로 지난 주문을 날짜별로 묶어 보여 준다. 처리 버튼은 없고 상세로만 이동한다 */
const OrderHistoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>(7);
  const [statusKey, setStatusKey] = useState('ALL');
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    setOrders(null);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (period - 1));
    const statuses = STATUS_FILTERS.find((s) => s.key === statusKey)?.statuses;
    getOrderHistory(toYmd(from), toYmd(to), statuses).then((res) =>
      setOrders(isOk(res) && res.orders ? res.orders : []),
    );
  }, [period, statusKey]);

  // 날짜별 묶기 (FlatList 에 헤더 행을 섞어 넣는다)
  const rows = useMemo(() => {
    if (!orders) return [];
    const out: (
      | { type: 'header'; key: string; date: string; count: number; sales: number }
      | { type: 'order'; key: string; order: Order }
    )[] = [];
    let cur = '';
    orders.forEach((o) => {
      const d = toYmd(new Date(o.createdAt));
      if (d !== cur) {
        cur = d;
        const dayOrders = orders.filter((x) => toYmd(new Date(x.createdAt)) === d);
        out.push({
          type: 'header',
          key: `h-${d}`,
          date: d,
          count: dayOrders.length,
          sales: dayOrders.filter((x) => x.status === 'COMPLETED').reduce((s, x) => s + x.totalAmount, 0),
        });
      }
      out.push({ type: 'order', key: o.id, order: o });
    });
    return out;
  }, [orders]);

  return (
    <ScreenWrapper backgroundColor={theme.colors.bg}>
      {/* 기간은 "설정"이라 뱃지로, 상태는 "분류"라 주문 현황 화면과 같은 밑줄 탭으로. 모양을 달리해 두 선택이 섞여 보이지 않게 한다 */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[styles.chip, period === p.key && styles.chipActive]}>
            <Typography mode="subtitle4" color={period === p.key ? 'white' : 'gray700'}>
              {p.label}
            </Typography>
          </Pressable>
        ))}
      </View>
      <View style={styles.tabs}>
        {STATUS_FILTERS.map((s) => {
          const active = statusKey === s.key;
          return (
            <Pressable key={s.key} onPress={() => setStatusKey(s.key)} style={[styles.tab, active && styles.tabActive]}>
              <Typography mode="subtitle3" color={active ? 'orange700' : 'gray500'}>
                {s.label}
              </Typography>
            </Pressable>
          );
        })}
      </View>

      {orders === null ? (
        <View style={{ padding: 16 }}>
          <SkeletonList rows={4} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <View style={styles.dayHeader}>
                <Typography mode="subtitle3" color="gray900">
                  {dateKo(item.date)}
                </Typography>
                <Typography mode="caption1" color="gray500">
                  {item.count}건 · 매출 {won(item.sales)}
                </Typography>
              </View>
            ) : (
              <OrderCard
                order={item.order}
                readonly
                onChanged={() => {}}
                onPress={() => navigation.navigate('OrderDetail', { orderId: item.order.id })}
              />
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="history" size={40} color={theme.colors.gray300} />
              <Typography mode="body1" color="gray500">
                조회된 주문이 없어요
              </Typography>
            </View>
          }
          ListFooterComponent={
            orders.length >= 200 ? (
              <Typography mode="caption1" color="gray400" style={{ textAlign: 'center', paddingVertical: 12 }}>
                최근 200건까지만 표시됩니다
              </Typography>
            ) : null
          }
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: theme.colors.gray900 },
  // 주문 현황(OrdersScreen) 탭과 같은 모양
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  tab: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.colors.primary },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 8,
    paddingBottom: 2,
    paddingHorizontal: 4,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 80 },
});

export default OrderHistoryScreen;
