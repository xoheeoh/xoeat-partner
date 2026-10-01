import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { Settlement } from '@typ/domain';
import { getSettlements } from '@apis/storeApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { dateDot, dateKo, won } from '@utils/formatter';
import { Badge, BottomSheet, ScreenWrapper, SkeletonList, Typography } from '@components/common';
import { theme } from '@styles';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${y}년 ${Number(m)}월`;
};

const Row: React.FC<{ label: string; value: string; strong?: boolean; minus?: boolean }> = ({ label, value, strong, minus }) => (
  <View style={styles.row}>
    <Typography mode={strong ? 'subtitle2' : 'body2'} color={strong ? 'gray900' : 'gray600'}>
      {label}
    </Typography>
    <Typography mode={strong ? 'subtitle1' : 'body2'} color={strong ? 'orange600' : minus ? 'red600' : 'gray900'}>
      {minus ? '-' : ''}
      {value}
    </Typography>
  </View>
);

/** 월별 정산: 일 단위로 매출·수수료·입금액을 보여 주고, 누르면 상세 시트 */
const SettlementScreen = () => {
  const { store } = useStore();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [list, setList] = useState<Settlement[] | null>(null);
  const [detail, setDetail] = useState<Settlement | null>(null);

  useEffect(() => {
    setList(null);
    getSettlements(month).then((res) => setList(isOk(res) && res.settlements ? res.settlements : []));
  }, [month]);

  const total = useMemo(() => {
    const t = { sales: 0, fee: 0, vat: 0, payout: 0, scheduled: 0, orders: 0 };
    (list ?? []).forEach((s) => {
      t.sales += s.salesAmount;
      t.fee += s.fee;
      t.vat += s.vat;
      t.payout += s.payoutAmount;
      t.orders += s.orderCount;
      if (s.status === 'SCHEDULED') t.scheduled += s.payoutAmount;
    });
    return t;
  }, [list]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  };
  const isCurrent = month === monthKey(new Date());

  return (
    <ScreenWrapper backgroundColor={theme.colors.bg}>
      {/* 월 선택 + 요약 */}
      <View style={styles.summary}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.monthBtn}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.gray700} />
          </Pressable>
          <Typography mode="subtitle1" color="gray900">
            {monthLabel(month)}
          </Typography>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={styles.monthBtn} disabled={isCurrent}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={isCurrent ? theme.colors.gray200 : theme.colors.gray700} />
          </Pressable>
        </View>
        <View style={styles.totalBox}>
          <View style={{ flex: 1 }}>
            <Typography mode="caption1" color="gray500">
              입금 합계
            </Typography>
            <Typography mode="heading2" color="gray900">
              {won(total.payout)}
            </Typography>
            <Typography mode="caption1" color="gray500">
              매출 {won(total.sales)} · {total.orders}건
            </Typography>
          </View>
          <View style={{ gap: 4, alignItems: 'flex-end' }}>
            <Typography mode="caption1" color="gray500">
              입금 예정
            </Typography>
            <Typography mode="subtitle2" color="orange600">
              {won(total.scheduled)}
            </Typography>
            <Typography mode="caption1" color="gray400">
              수수료+VAT {won(total.fee + total.vat)}
            </Typography>
          </View>
        </View>
      </View>

      {list === null ? (
        <View style={{ padding: 16 }}>
          <SkeletonList rows={5} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(s) => s.settleDate}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => setDetail(item)} style={styles.item}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Typography mode="subtitle3" color="gray900">
                    {dateKo(item.settleDate)}
                  </Typography>
                  <Badge label={item.status === 'PAID' ? '입금완료' : '입금예정'} tone={item.status === 'PAID' ? 'green' : 'orange'} />
                </View>
                <Typography mode="caption1" color="gray500">
                  주문 {item.orderCount}건 · 매출 {won(item.salesAmount)} · {dateDot(item.payoutDate)} 입금
                </Typography>
              </View>
              <Typography mode="subtitle2" color="gray900">
                {won(item.payoutAmount)}
              </Typography>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.gray400} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="cash-remove" size={40} color={theme.colors.gray300} />
              <Typography mode="body1" color="gray500">
                이 달에는 정산 내역이 없어요
              </Typography>
            </View>
          }
          ListFooterComponent={
            <Typography mode="caption1" color="gray400" style={{ textAlign: 'center', paddingVertical: 16 }}>
              완료된 주문 금액에서 플랫폼 수수료({store?.feeRate ?? 0}%)와 수수료 VAT(10%)를 뺀 금액이 완료일 기준 2일 뒤 입금됩니다.
            </Typography>
          }
        />
      )}

      <BottomSheet
        visible={!!detail}
        setVisible={(v) => !v && setDetail(null)}
        title={detail ? `${dateKo(detail.settleDate)} 정산` : ''}
        content={
          detail && (
            <View style={{ gap: 12 }}>
              <Row label={`매출 (${detail.orderCount}건)`} value={won(detail.salesAmount)} />
              <Row label={`플랫폼 수수료 ${store?.feeRate ?? 0}%`} value={won(detail.fee)} minus />
              <Row label="수수료 VAT 10%" value={won(detail.vat)} minus />
              <View style={styles.divider} />
              <Row label="입금액" value={won(detail.payoutAmount)} strong />
              <View style={[styles.payoutBox, detail.status === 'PAID' ? styles.payoutPaid : styles.payoutScheduled]}>
                <MaterialCommunityIcons name={detail.status === 'PAID' ? 'check-circle-outline' : 'clock-outline'} size={18} color={detail.status === 'PAID' ? theme.colors.green700 : theme.colors.orange700} />
                <Typography mode="body2" color={detail.status === 'PAID' ? 'green900' : 'orange700'}>
                  {dateDot(detail.payoutDate)} {detail.status === 'PAID' ? '입금 완료' : '입금 예정'} · {store?.bankName} {store?.accountNo}
                </Typography>
              </View>
            </View>
          )
        }
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  summary: { backgroundColor: theme.colors.white, padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  monthBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  totalBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, backgroundColor: theme.colors.gray50, borderRadius: theme.radius.md, padding: 14 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.white, borderRadius: theme.radius.md, padding: 14, boxShadow: theme.shadow.card },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 80 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  divider: { height: 1, backgroundColor: theme.colors.line },
  payoutBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: theme.radius.sm, marginTop: 4 },
  payoutPaid: { backgroundColor: theme.colors.green50 },
  payoutScheduled: { backgroundColor: theme.colors.orange50 },
});

export default SettlementScreen;
