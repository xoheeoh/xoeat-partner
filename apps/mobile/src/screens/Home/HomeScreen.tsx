import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import type { DailySales, DashboardSummary } from '@typ/domain';
import { getDashboard } from '@apis/storeApi';
import { createDemoOrder } from '@apis/orderApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useOrderFeed } from '@contexts/OrderFeedContext';
import { useNotifications } from '@contexts/NotificationContext';
import { useDialog } from '@contexts/DialogContext';
import { loadingController } from '@utils/loadingController';
import { todayKo, won } from '@utils/formatter';
import { MonthSalesChart } from '@components/home';
import { PrimaryButton, ScreenWrapper, Skeleton, Typography } from '@components/common';
import { theme } from '@styles';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const QUICK_MENUS: { label: string; icon: IconName; route: keyof RootStackParamList }[] = [
  { label: '주문 내역', icon: 'history', route: 'OrderHistory' },
  { label: '정산', icon: 'cash-multiple', route: 'Settlement' },
  { label: '영업시간', icon: 'clock-outline', route: 'StoreHours' },
  { label: '운영 설정', icon: 'tune-variant', route: 'OperationSetting' },
];

/** 서버 마이그레이션(monthDays) 반영 전의 옛 응답(week: 최근 7일)도 이번 달 날짜만 골라 쓴다. 반영 후 제거 */
const monthDaysOf = (summary: DashboardSummary): DailySales[] => {
  if (summary.monthDays) return summary.monthDays;
  const month = new Date().getMonth();
  return (summary.week ?? []).filter((d) => new Date(`${d.date}T00:00:00`).getMonth() === month);
};

/** 홈 상단 "지금 할 일" 카드. hot 이면 브랜드색으로 채워 눈에 띄게 한다 */
const TodoCard: React.FC<{
  icon: IconName;
  label: string;
  count: number;
  hint: string;
  hot?: boolean;
  onPress: () => void;
}> = ({ icon, label, count, hint, hot = false, onPress }) => (
  <Pressable
    style={({ pressed }) => [styles.stat, hot && styles.statHot, pressed && styles.statPressed]}
    onPress={onPress}>
    <View style={styles.statHead}>
      <View style={[styles.statIcon, hot && styles.statIconHot]}>
        <MaterialCommunityIcons name={icon} size={18} color={hot ? theme.colors.white : theme.colors.orange600} />
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={hot ? 'rgba(255,255,255,0.7)' : theme.colors.gray300}
      />
    </View>
    <Typography mode="caption1" color={hot ? 'white' : 'gray500'}>
      {label}
    </Typography>
    <Typography mode="heading1" color={hot ? 'white' : 'gray900'}>
      {count}
      <Typography mode="subtitle3" color={hot ? 'white' : 'gray500'}>
        {' '}
        건
      </Typography>
    </Typography>
    <Typography mode="caption2" color={hot ? 'white' : 'gray400'} numberOfLines={1}>
      {hint}
    </Typography>
  </Pressable>
);

/** 홈: 영업 상태, 지금 할 일(접수대기·진행중), 오늘·이번 달 매출(주 단위 추이), 바로가기, 데모 주문 버튼 */
const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { store, setStatus, refresh } = useStore();
  const { counts, lastEvent, refreshCounts } = useOrderFeed();
  const { unreadCount } = useNotifications();
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
        ? {
            title: '영업 재개',
            message1: '영업을 다시 시작할까요?',
            message2: '고객 앱에 가게가 다시 노출되고 주문을 받습니다.',
            confirmText: '영업 재개',
            cancelText: '닫기',
          }
        : {
            title: '영업 일시중지',
            message1: '영업을 잠시 멈출까요?',
            message2: '멈춘 동안에는 새 주문이 들어오지 않습니다. 진행중인 주문은 계속 처리할 수 있어요.',
            confirmText: '일시중지',
            cancelText: '닫기',
          },
    );
    if (!yes) return;
    loadingController.start();
    const ok = await setStatus(paused ? 'OPEN' : 'PAUSED');
    loadingController.stop();
    Toast.show(
      ok
        ? { type: 'success', text1: paused ? '영업을 재개했어요' : '영업을 일시중지했어요' }
        : { type: 'error', text1: '상태를 바꾸지 못했어요' },
    );
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }>
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
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: paused ? theme.colors.yellow600 : theme.colors.green500 },
                    ]}
                  />
                  <Typography mode="caption2" color={paused ? 'yellow900' : 'green900'}>
                    {paused ? '일시중지' : '영업중'}
                  </Typography>
                </View>
              )}
            </View>
          </View>
          {/* 종 = 알림함(나에게 일어난 일). 공지사항은 가게 탭에 있다 */}
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={8}
            style={styles.bell}
            accessibilityLabel={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={theme.colors.gray700} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {/* 영업 상태 토글 */}
        {paused ? (
          <View style={styles.pausedBox}>
            {/* 제목 + 설명 두 줄. 운영 설정 화면의 영업 상태 카드와 같은 구성이라 버튼(44px) 높이와도 균형이 맞는다 */}
            <View style={{ flex: 1, gap: 2 }}>
              <Typography mode="subtitle2" color="yellow900">
                영업 일시중지 중
              </Typography>
              <Typography mode="caption1" color="yellow900">
                새 주문이 들어오지 않아요
              </Typography>
            </View>
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
        {/* 지금 할 일: 접수대기(수락 필요) · 진행중(조리·배달). 완료 건수는 행동이 필요 없어 홈에서는 매출 옆에만 작게 둔다 */}
        <View style={styles.statsRow}>
          <TodoCard
            icon="bell-ring-outline"
            label="접수대기"
            count={counts.PENDING}
            hint={counts.PENDING > 0 ? '수락이 필요해요' : '새 주문이 없어요'}
            hot={counts.PENDING > 0}
            onPress={() => navigation.navigate('Main', { screen: 'Orders', params: { tab: 'PENDING' } })}
          />
          <TodoCard
            icon="chef-hat"
            label="진행중"
            count={counts.ING}
            hint={counts.ING > 0 ? '조리·배달 중이에요' : '진행중인 주문이 없어요'}
            onPress={() => navigation.navigate('Main', { screen: 'Orders', params: { tab: 'ING' } })}
          />
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
              {/* 오늘: 금액 크게 + 완료 건수 작게 */}
              <View>
                <Typography mode="caption1" color="gray500">
                  오늘
                </Typography>
                <View style={styles.monthAmountRow}>
                  <Typography mode="heading2" color="orange600">
                    {won(summary.today.sales)}
                  </Typography>
                  <Typography mode="caption1" color="gray500">
                    완료 {counts.COMPLETED}건
                  </Typography>
                </View>
              </View>

              <View style={styles.divider} />

              {/* 이번 달: 금액 + 주 단위 추이 */}
              <View style={styles.monthHead}>
                <Typography mode="caption1" color="gray500">
                  이번 달
                </Typography>
                <View style={styles.monthAmountRow}>
                  <Typography mode="heading3" color="gray900">
                    {won(summary.month.sales)}
                  </Typography>
                  <Typography mode="caption1" color="gray500">
                    완료 {summary.month.orderCount}건
                  </Typography>
                </View>
              </View>
              <MonthSalesChart days={monthDaysOf(summary)} />
            </>
          ) : (
            <View style={{ gap: 10 }}>
              <Skeleton width="50%" height={32} />
              <Skeleton width="60%" height={28} />
              <Skeleton width="100%" height={100} />
            </View>
          )}
        </View>

        {/* 바로가기 */}
        <View style={styles.quickRow}>
          {QUICK_MENUS.map((m) => (
            <Pressable
              key={m.route}
              style={({ pressed }) => [styles.quick, pressed && styles.quickPressed]}
              onPress={() => navigation.navigate(m.route as never)}>
              <View style={styles.quickIcon}>
                <MaterialCommunityIcons name={m.icon} size={22} color={theme.colors.orange600} />
              </View>
              <Typography mode="caption1" color="gray800">
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
  // 안 읽은 알림 표시. 종 오른쪽 위에 흰 테두리를 둘러 아이콘 선과 겹쳐도 또렷하다
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.red500,
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: theme.radius.pill,
  },
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
  stat: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 2,
    boxShadow: theme.shadow.card,
  },
  statHot: { backgroundColor: theme.colors.primary, boxShadow: theme.shadow.primary },
  statPressed: { opacity: 0.85 },
  statHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.orange50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconHot: { backgroundColor: 'rgba(255,255,255,0.22)' },
  // 매출 카드는 키가 커서 그림자 번짐이 과해 보이므로 그림자 없이 흰 배경만으로 구분한다
  card: { backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, padding: 16, gap: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  more: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, backgroundColor: theme.colors.line },
  monthHead: { gap: 2 },
  monthAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  quickRow: { flexDirection: 'row', gap: 8 },
  // 바로가기는 위의 정보 카드(흰 배경+그림자)와 구분되도록 연한 주황 배경 + 테두리로 "눌리는 버튼" 느낌을 준다
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: theme.colors.orange50,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.orange100,
  },
  quickPressed: { backgroundColor: theme.colors.orange100, borderColor: theme.colors.orange200 },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
