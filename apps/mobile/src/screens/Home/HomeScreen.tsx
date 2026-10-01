import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import type { DashboardSummary } from '@typ/domain';
import { getDashboard } from '@apis/storeApi';
import { createDemoOrder } from '@apis/orderApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useOrderFeed } from '@contexts/OrderFeedContext';
import { useDialog } from '@contexts/DialogContext';
import { loadingController } from '@utils/loadingController';
import { todayKo, won } from '@utils/formatter';
import { WeekSalesChart } from '@components/home';
import { PrimaryButton, ScreenWrapper, Skeleton, Typography } from '@components/common';
import { theme } from '@styles';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const QUICK_MENUS: { label: string; icon: IconName; route: keyof RootStackParamList }[] = [
  { label: '주문 내역', icon: 'history', route: 'OrderHistory' },
  { label: '정산', icon: 'cash-multiple', route: 'Settlement' },
  { label: '영업시간', icon: 'clock-outline', route: 'StoreHours' },
  { label: '운영 설정', icon: 'tune-variant', route: 'OperationSetting' },
];

/** 홈: 영업 상태, 오늘 주문 현황, 7일 매출 추이, 바로가기, 데모 주문 버튼 */
const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { store, setStatus, refresh } = useStore();
  const { counts, lastEvent, refreshCounts } = useOrderFeed();
  const { confirm } = useDialog();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const handledSeq = useRef(0);

  const loadSummary = useCallback(async () => {
    const res = await getDashboard();
    if (isOk(res) && res.summary) setSummary(res.summary);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
      refreshCounts();
    }, [loadSummary, refreshCounts]),
  );

  // 주문이 바뀌면 매출 숫자도 바뀐다
  useEffect(() => {
    if (!lastEvent || lastEvent.seq === handledSeq.current) return;
    handledSeq.current = lastEvent.seq;
    loadSummary();
  }, [lastEvent, loadSummary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), refreshCounts(), refresh()]);
    setRefreshing(false);
  };

  const paused = store?.status === 'PAUSED';

  const toggleStatus = async () => {
    const yes = await confirm(
      paused
        ? { title: '영업 재개', message1: '영업을 다시 시작할까요?', message2: '고객 앱에 가게가 다시 노출되고 주문을 받습니다.', confirmText: '영업 재개', cancelText: '닫기' }
        : { title: '영업 일시중지', message1: '영업을 잠시 멈출까요?', message2: '멈춘 동안에는 새 주문이 들어오지 않습니다. 진행중인 주문은 계속 처리할 수 있어요.', confirmText: '일시중지', cancelText: '닫기' },
    );
    if (!yes) return;
    loadingController.start();
    const ok = await setStatus(paused ? 'OPEN' : 'PAUSED');
    loadingController.stop();
    Toast.show(ok ? { type: 'success', text1: paused ? '영업을 재개했어요' : '영업을 일시중지했어요' } : { type: 'error', text1: '상태를 바꾸지 못했어요' });
  };

  const handleDemoOrder = async () => {
    if (creating) return;
    setCreating(true);
    const res = await createDemoOrder();
    setCreating(false);
    if (!isOk(res)) Toast.show({ type: 'error', text1: '주문을 만들지 못했어요', text2: res.resultMsg });
    // 성공 토스트와 알림음은 Realtime 이벤트(OrderFeedProvider)가 띄운다
  };

  return (
    <ScreenWrapper hasHeader={false} backgroundColor={theme.colors.bg} inTab>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}>
        {/* 상단: 가게명 · 영업 상태 · 공지 */}
        <View style={styles.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Typography mode="caption1" color="gray500">
              {todayKo()}
            </Typography>
            <View style={styles.nameRow}>
              <Typography mode="heading3" color="gray900" numberOfLines={1} style={{ flexShrink: 1 }}>
                {store?.name ?? ' '}
              </Typography>
              {store && (
                <View style={[styles.statusPill, paused ? styles.statusPaused : styles.statusOpen]}>
                  <View style={[styles.statusDot, { backgroundColor: paused ? theme.colors.yellow600 : theme.colors.green500 }]} />
                  <Typography mode="caption2" color={paused ? 'yellow900' : 'green900'}>
                    {paused ? '일시중지' : '영업중'}
                  </Typography>
                </View>
              )}
            </View>
          </View>
          <Pressable onPress={() => navigation.navigate('Notice')} hitSlop={8} style={styles.bell}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={theme.colors.gray700} />
          </Pressable>
        </View>

        {/* 영업 상태 토글 */}
        {paused ? (
          <View style={styles.pausedBox}>
            <Typography mode="body2" color="yellow900" style={{ flex: 1 }}>
              영업 일시중지 상태예요. 새 주문이 들어오지 않습니다.
            </Typography>
            <PrimaryButton label="영업 재개" size="md" onPress={toggleStatus} />
          </View>
        ) : (
          <Pressable onPress={toggleStatus} style={styles.pauseLink}>
            <MaterialCommunityIcons name="pause-circle-outline" size={18} color={theme.colors.gray600} />
            <Typography mode="body2" color="gray600">
              잠시 주문을 멈추고 싶다면 영업 일시중지
            </Typography>
          </Pressable>
        )}

        {/* 오늘 주문 현황 */}
        <View style={styles.statsRow}>
          <Pressable
            style={[styles.stat, counts.PENDING > 0 && styles.statHot]}
            onPress={() => navigation.navigate('Main', { screen: 'Orders', params: { tab: 'PENDING' } })}>
            <Typography mode="caption1" color={counts.PENDING > 0 ? 'white' : 'gray500'}>
              접수대기
            </Typography>
            <Typography mode="heading2" color={counts.PENDING > 0 ? 'white' : 'gray900'}>
              {counts.PENDING}
              <Typography mode="subtitle3" color={counts.PENDING > 0 ? 'white' : 'gray500'}>
                {' '}건
              </Typography>
            </Typography>
          </Pressable>
          <Pressable style={styles.stat} onPress={() => navigation.navigate('Main', { screen: 'Orders', params: { tab: 'ING' } })}>
            <Typography mode="caption1" color="gray500">
              진행중
            </Typography>
            <Typography mode="heading2" color="gray900">
              {counts.ING}
              <Typography mode="subtitle3" color="gray500">
                {' '}건
              </Typography>
            </Typography>
          </Pressable>
          <Pressable style={styles.stat} onPress={() => navigation.navigate('Main', { screen: 'Orders', params: { tab: 'COMPLETED' } })}>
            <Typography mode="caption1" color="gray500">
              완료
            </Typography>
            <Typography mode="heading2" color="gray900">
              {counts.COMPLETED}
              <Typography mode="subtitle3" color="gray500">
                {' '}건
              </Typography>
            </Typography>
          </Pressable>
        </View>

        {/* 매출 */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Typography mode="subtitle2" color="gray900">
              매출
            </Typography>
            <Pressable onPress={() => navigation.navigate('Settlement')} style={styles.more}>
              <Typography mode="caption1" color="gray500">
                정산 보기
              </Typography>
              <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.gray500} />
            </Pressable>
          </View>
          {summary ? (
            <>
              <View style={styles.salesRow}>
                <View style={{ flex: 1 }}>
                  <Typography mode="caption1" color="gray500">
                    오늘
                  </Typography>
                  <Typography mode="heading3" color="orange600">
                    {won(summary.today.sales)}
                  </Typography>
                </View>
                <View style={{ flex: 1 }}>
                  <Typography mode="caption1" color="gray500">
                    이번 달
                  </Typography>
                  <Typography mode="heading3" color="gray900">
                    {won(summary.month.sales)}
                  </Typography>
                  <Typography mode="caption1" color="gray500">
                    완료 {summary.month.orderCount}건
                  </Typography>
                </View>
              </View>
              <WeekSalesChart data={summary.week} />
            </>
          ) : (
            <View style={{ gap: 10 }}>
              <Skeleton width="60%" height={28} />
              <Skeleton width="100%" height={120} />
            </View>
          )}
        </View>

        {/* 바로가기 */}
        <View style={styles.quickRow}>
          {QUICK_MENUS.map((m) => (
            <Pressable key={m.route} style={styles.quick} onPress={() => navigation.navigate(m.route as never)}>
              <View style={styles.quickIcon}>
                <MaterialCommunityIcons name={m.icon} size={22} color={theme.colors.orange600} />
              </View>
              <Typography mode="caption1" color="gray700">
                {m.label}
              </Typography>
            </Pressable>
          ))}
        </View>

        {/* 데모 */}
        <View style={styles.demoBox}>
          <View style={{ flex: 1 }}>
            <Typography mode="subtitle3" color="gray900">
              데모 주문 받아 보기
            </Typography>
            <Typography mode="caption1" color="gray500" style={{ marginTop: 2 }}>
              고객 앱 대신 가짜 주문을 1건 넣습니다. 알림음과 함께 접수대기에 나타나요.
            </Typography>
          </View>
          <PrimaryButton label="주문 넣기" size="md" onPress={handleDemoOrder} disabled={creating || paused} />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 12, gap: 16, paddingBottom: 32 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: theme.radius.pill },
  statusOpen: { backgroundColor: theme.colors.green50 },
  statusPaused: { backgroundColor: theme.colors.yellow50 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  pausedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.yellow50,
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.yellow200,
  },
  pauseLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, padding: 14, gap: 2, boxShadow: theme.shadow.card },
  statHot: { backgroundColor: theme.colors.primary },
  card: { backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, padding: 16, gap: 14, boxShadow: theme.shadow.card },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  more: { flexDirection: 'row', alignItems: 'center' },
  salesRow: { flexDirection: 'row', gap: 12 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quick: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, boxShadow: theme.shadow.card },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.orange50, alignItems: 'center', justifyContent: 'center' },
  demoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.orange300,
  },
});

export default HomeScreen;
