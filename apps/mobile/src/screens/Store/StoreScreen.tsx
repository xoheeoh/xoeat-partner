import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { LinearGradient } from 'expo-linear-gradient';

import type { RootStackParamList } from '@typ/navigation';
import { logout } from '@apis/storeApi';
import { useStore } from '@contexts/StoreContext';
import { useOrderFeed } from '@contexts/OrderFeedContext';
import { useDialog } from '@contexts/DialogContext';
import { categoryLabel } from '@dt/constants';
import { bizNo, phone, won } from '@utils/formatter';
import { goToLogin } from '@utils/navigationHelpers';
import { ScreenWrapper, ToggleSwitch, Typography } from '@components/common';
import { theme } from '@styles';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const OPEN_MS = 220;

/** 헤더의 작은 정보 칩. 유리판 위에 연한 주황 알약. 꺼진 항목은 회색 */
const Chip: React.FC<{ icon: IconName; label: string; off?: boolean }> = ({ icon, label, off = false }) => (
  <View style={[styles.chip, off && styles.chipOff]}>
    <MaterialCommunityIcons name={icon} size={14} color={off ? theme.colors.gray400 : theme.colors.orange700} />
    <Typography mode="caption1" color={off ? 'gray400' : 'orange900'}>
      {label}
    </Typography>
  </View>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Typography mode="body2" color="gray500" style={{ width: 96 }}>
      {label}
    </Typography>
    <Typography mode="body2" color="gray900" style={{ flex: 1 }}>
      {value || '-'}
    </Typography>
  </View>
);

const MenuRow: React.FC<{ icon: IconName; label: string; desc?: string; onPress: () => void }> = ({ icon, label, desc, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: theme.colors.gray50 }]}>
    <MaterialCommunityIcons name={icon} size={22} color={theme.colors.gray700} />
    <View style={{ flex: 1 }}>
      <Typography mode="body1" color="gray900">
        {label}
      </Typography>
      {!!desc && (
        <Typography mode="caption1" color="gray500">
          {desc}
        </Typography>
      )}
    </View>
    <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.gray400} />
  </Pressable>
);

/**
 * 접어 두는 참고 정보 구역. 제목 줄은 고정하고 본문 높이만 0 ↔ 실제 높이로 움직인다 (공지 화면과 같은 방식).
 * 바꿀 수 없고 거의 안 보는 정보라 기본은 접힌 상태.
 */
const CollapsibleSection: React.FC<{ title: string; desc: string; children: React.ReactNode }> = ({ title, desc, children }) => {
  const [open, setOpen] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(open ? bodyHeight : 0, { duration: OPEN_MS });
    opacity.value = withTiming(open ? 1 : 0, { duration: OPEN_MS });
  }, [open, bodyHeight, height, opacity]);

  const bodyStyle = useAnimatedStyle(() => ({ height: height.value, opacity: opacity.value }));

  return (
    <View style={styles.collapsible}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.collapsibleHead}>
        <View style={{ flex: 1 }}>
          <Typography mode="subtitle3" color="gray700">
            {title}
          </Typography>
          <Typography mode="caption1" color="gray500">
            {desc}
          </Typography>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.gray400} />
      </Pressable>
      <Animated.View style={[{ overflow: 'hidden' }, bodyStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <View onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)} style={styles.collapsibleBody}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

/** 가게 탭: 가게 헤더(얼굴) → 운영 메뉴 → 접힌 참고 정보 → 꼬리말 순으로 위계를 둔다 */
const StoreScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { store } = useStore();
  const { soundOn, setSoundOn } = useOrderFeed();
  const { confirm } = useDialog();

  const handleLogout = async () => {
    const yes = await confirm({ title: '로그아웃', message1: '로그아웃 할까요?', message2: '로그아웃 중에는 새 주문 알림을 받을 수 없어요.', confirmText: '로그아웃', cancelText: '취소' });
    if (!yes) return;
    await logout();
    goToLogin(navigation);
  };

  if (!store) return <ScreenWrapper backgroundColor={theme.colors.bg} inTab><View /></ScreenWrapper>;

  const paused = store.status === 'PAUSED';

  return (
    <ScreenWrapper backgroundColor={theme.colors.gray700} inTab>
      <ScrollView style={{ backgroundColor: theme.colors.bg }} contentContainerStyle={styles.container}>
        {/*
          1. 가게 프로필: SNS 프로필처럼 위에 낮은 띠(배너), 가게 사진이 띠와 카드 경계에 걸치고,
             그 아래 흰 카드에 이름·상태·소개·정보 칩. 사진이 있으면 배너에 사진을 깔고, 없으면 웜 차콜 + 주황 원 패턴.
        */}
        <View style={styles.banner}>
          {store.imageUrl ? (
            <>
              <Image source={{ uri: store.imageUrl }} style={StyleSheet.absoluteFill} blurRadius={6} />
              <LinearGradient colors={['rgba(28,25,23,0.15)', 'rgba(28,25,23,0.6)']} style={StyleSheet.absoluteFill} />
            </>
          ) : (
            <>
              <View pointerEvents="none" style={[styles.blob, styles.blob1]} />
              <View pointerEvents="none" style={[styles.blob, styles.blob2]} />
            </>
          )}
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            {store.imageUrl ? (
              <Image source={{ uri: store.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <MaterialCommunityIcons name="storefront-outline" size={34} color={theme.colors.orange500} />
              </View>
            )}
            <View style={styles.profileName}>
              <View style={styles.nameRow}>
                <Typography mode="heading3" color="gray900" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {store.name}
                </Typography>
                <View style={[styles.statusPill, paused ? styles.statusPaused : styles.statusOpen]}>
                  <View style={[styles.statusDot, { backgroundColor: paused ? theme.colors.yellow600 : theme.colors.green500 }]} />
                  <Typography mode="caption2" color={paused ? 'yellow900' : 'green900'}>
                    {paused ? '일시중지' : '영업중'}
                  </Typography>
                </View>
              </View>
              <Typography mode="caption1" color="gray500">
                {categoryLabel(store.categoryCd)} · 아이디 {store.loginId}
              </Typography>
            </View>
          </View>
          {!!store.intro && (
            <Typography mode="body2" color="gray700" style={{ marginTop: 12 }}>
              {store.intro}
            </Typography>
          )}
          <View style={styles.chips}>
            <Chip icon="cash" label={`최소주문 ${won(store.minOrderAmount)}`} />
            <Chip icon="moped-outline" label={store.deliveryEnabled ? `배달비 ${won(store.deliveryFee)}` : '배달 중단'} off={!store.deliveryEnabled} />
            <Chip icon="shopping-outline" label={store.pickupEnabled ? '포장 가능' : '포장 중단'} off={!store.pickupEnabled} />
          </View>
        </View>

        <View style={styles.body}>
          {/* 2. 운영 메뉴: 눌러서 들어가는 목록 */}
          <Typography mode="subtitle3" color="gray500" style={styles.sectionTitle}>
            가게 운영
          </Typography>
          <View style={styles.menuCard}>
            <MenuRow icon="store-edit-outline" label="가게 정보 관리" desc="소개, 원산지, 최소주문금액, 배달비" onPress={() => navigation.navigate('StoreInfoEdit')} />
            <View style={styles.sep} />
            <MenuRow icon="clock-outline" label="영업시간 설정" desc="요일별 영업·휴게 시간" onPress={() => navigation.navigate('StoreHours')} />
            <View style={styles.sep} />
            <MenuRow
              icon="tune-variant"
              label="배달/포장 운영 설정"
              desc={`배달 ${store.deliveryEnabled ? '운영중' : '중단'} · 포장 ${store.pickupEnabled ? '운영중' : '중단'}`}
              onPress={() => navigation.navigate('OperationSetting')}
            />
            <View style={styles.sep} />
            <MenuRow icon="cash-multiple" label="정산 내역" onPress={() => navigation.navigate('Settlement')} />
            <View style={styles.sep} />
            <MenuRow icon="bullhorn-outline" label="공지사항" desc="운영사 안내 · 점검 · 이벤트" onPress={() => navigation.navigate('Notice')} />
            <View style={styles.sep} />
            <View style={styles.menuRow}>
              <MaterialCommunityIcons name="volume-high" size={22} color={theme.colors.gray700} />
              <View style={{ flex: 1 }}>
                <Typography mode="body1" color="gray900">
                  새 주문 알림음
                </Typography>
                <Typography mode="caption1" color="gray500">
                  접수대기 주문이 들어오면 소리로 알려요
                </Typography>
              </View>
              <ToggleSwitch value={soundOn} onValueChange={setSoundOn} />
            </View>
          </View>

          {/* 3. 참고 정보: 바꿀 수 없고 드물게 보므로 납작하게, 접어서 */}
          <CollapsibleSection title="사업자·정산 정보" desc="변경은 고객센터(1588-0000)로 문의해 주세요">
            <Typography mode="caption1" color="gray500" style={styles.infoTitle}>
              사업자 정보
            </Typography>
            <View style={{ gap: 8 }}>
              <Row label="상호명" value={store.name} />
              <Row label="사업자등록번호" value={bizNo(store.bizNo)} />
              <Row label="대표자" value={store.repName} />
              <Row label="사업장 주소" value={store.address} />
              <Row label="연락처" value={phone(store.phone)} />
            </View>
            <View style={styles.infoSep} />
            <Typography mode="caption1" color="gray500" style={styles.infoTitle}>
              정산 정보
            </Typography>
            <View style={{ gap: 8 }}>
              <Row label="정산 은행" value={store.bankName} />
              <Row label="계좌번호" value={store.accountNo} />
              <Row label="예금주" value={store.accountHolder} />
              <Row label="플랫폼 수수료" value={`${store.feeRate}% (VAT 별도)`} />
              <Row label="정산 주기" value="매출 발생일 기준 D+2 영업일" />
            </View>
          </CollapsibleSection>

          {/* 4. 꼬리말 */}
          <Pressable onPress={handleLogout} style={styles.logout}>
            <Typography mode="body2" color="gray500">
              로그아웃
            </Typography>
          </Pressable>
          <Typography mode="caption1" color="gray400" style={{ textAlign: 'center' }}>
            Xoeat 사장님 v{Application.nativeApplicationVersion ?? '0.1.0'}
          </Typography>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  // 헤더
  // 배너: 사진이 없으면 웜 차콜 바탕에 주황 원 패턴
  banner: { height: 104, backgroundColor: theme.colors.gray700, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: theme.colors.primary },
  blob1: { width: 220, height: 220, top: -120, right: -50, opacity: 0.35 },
  blob2: { width: 120, height: 120, bottom: -60, left: 24, opacity: 0.2 },
  // 프로필 카드: 배너 위로 올라타고, 사진은 카드 위 가장자리 밖으로 반쯤 나간다
  profileCard: { marginHorizontal: 16, marginTop: -28, backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, padding: 16, paddingTop: 0, boxShadow: theme.shadow.card },
  // 사진은 위 끝에 고정해 띠에 걸치는 정도(30)를 유지하고, 글은 카드 안쪽 여백(16)에서 시작한다. 카드 아래 여백과 같은 값
  profileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 76, height: 76, borderRadius: 22, marginTop: -30, borderWidth: 3, borderColor: theme.colors.white, backgroundColor: theme.colors.white },
  avatarEmpty: { backgroundColor: theme.colors.orange50, alignItems: 'center', justifyContent: 'center' },
  profileName: { flex: 1, gap: 2, paddingTop: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: theme.radius.pill },
  statusOpen: { backgroundColor: theme.colors.green50 },
  statusPaused: { backgroundColor: theme.colors.yellow50 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: theme.radius.pill, backgroundColor: theme.colors.orange50 },
  chipOff: { backgroundColor: theme.colors.gray100 },
  // 본문
  body: { padding: 16, gap: 12 },
  sectionTitle: { marginTop: 4, marginLeft: 4, marginBottom: -4 },
  // 메뉴 줄마다 위아래 여백(12)이 있으므로 카드의 위아래 여백은 뺀다. 줄은 좌우로 카드 끝까지 닿는다
  menuCard: { backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, paddingHorizontal: 16, boxShadow: theme.shadow.card, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginHorizontal: -16, paddingHorizontal: 16 },
  sep: { height: 1, backgroundColor: theme.colors.gray100 },
  // 접힌 참고 정보: 그림자 없이 납작하게, 테두리로만 구분
  collapsible: { backgroundColor: theme.colors.gray100, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.line },
  collapsibleHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  collapsibleBody: { paddingHorizontal: 16, paddingBottom: 16 },
  infoTitle: { marginBottom: 8 },
  infoRow: { flexDirection: 'row', gap: 8 },
  infoSep: { height: 1, backgroundColor: theme.colors.line, marginVertical: 14 },
  logout: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 8 },
});

export default StoreScreen;
