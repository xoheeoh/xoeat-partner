import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';

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

/** 가게 탭: 사업자·정산 정보 조회, 설정 화면 진입, 알림음, 로그아웃 */
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

  return (
    <ScreenWrapper backgroundColor={theme.colors.bg} inTab>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 가게 요약 */}
        <View style={styles.card}>
          <View style={styles.storeHead}>
            {store.imageUrl ? (
              <Image source={{ uri: store.imageUrl }} style={styles.storeImg} />
            ) : (
              <View style={[styles.storeImg, styles.storeImgEmpty]}>
                <MaterialCommunityIcons name="storefront-outline" size={26} color={theme.colors.orange400} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Typography mode="subtitle1" color="gray900">
                {store.name}
              </Typography>
              <Typography mode="caption1" color="gray500">
                {categoryLabel(store.categoryCd)} · 최소주문 {won(store.minOrderAmount)} · 배달비 {won(store.deliveryFee)}
              </Typography>
            </View>
          </View>
          {!!store.intro && (
            <Typography mode="body2" color="gray600" style={{ marginTop: 12 }}>
              {store.intro}
            </Typography>
          )}
        </View>

        <View style={styles.card}>
          <MenuRow icon="store-edit-outline" label="가게 정보 관리" desc="소개, 원산지, 최소주문금액, 배달비, 자체 배달" onPress={() => navigation.navigate('StoreInfoEdit')} />
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

        {/* 사업자 정보 */}
        <View style={styles.card}>
          <Typography mode="subtitle3" color="gray500" style={{ marginBottom: 12 }}>
            사업자 정보
          </Typography>
          <View style={{ gap: 8 }}>
            <Row label="상호명" value={store.name} />
            <Row label="사업자등록번호" value={bizNo(store.bizNo)} />
            <Row label="대표자" value={store.repName} />
            <Row label="사업장 주소" value={store.address} />
            <Row label="연락처" value={phone(store.phone)} />
          </View>
        </View>

        {/* 정산 정보 */}
        <View style={styles.card}>
          <Typography mode="subtitle3" color="gray500" style={{ marginBottom: 12 }}>
            정산 정보
          </Typography>
          <View style={{ gap: 8 }}>
            <Row label="정산 은행" value={store.bankName} />
            <Row label="계좌번호" value={store.accountNo} />
            <Row label="예금주" value={store.accountHolder} />
            <Row label="플랫폼 수수료" value={`${store.feeRate}% (VAT 별도)`} />
            <Row label="정산 주기" value="매출 발생일 기준 D+2 영업일" />
          </View>
          <Typography mode="caption1" color="gray400" style={{ marginTop: 12 }}>
            사업자·정산 정보 변경은 고객센터(1588-0000)로 문의해 주세요.
          </Typography>
        </View>

        <Pressable onPress={handleLogout} style={styles.logout}>
          <Typography mode="body2" color="gray500">
            로그아웃
          </Typography>
        </Pressable>
        <Typography mode="caption1" color="gray400" style={{ textAlign: 'center' }}>
          Xoeat 사장님 v{Application.nativeApplicationVersion ?? '0.1.0'} · 아이디 {store.loginId}
        </Typography>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, padding: 16, boxShadow: theme.shadow.card },
  storeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeImg: { width: 56, height: 56, borderRadius: 14 },
  storeImgEmpty: { backgroundColor: theme.colors.orange50, alignItems: 'center', justifyContent: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginHorizontal: -16, paddingHorizontal: 16 },
  sep: { height: 1, backgroundColor: theme.colors.gray100 },
  infoRow: { flexDirection: 'row', gap: 8 },
  logout: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
});

export default StoreScreen;
