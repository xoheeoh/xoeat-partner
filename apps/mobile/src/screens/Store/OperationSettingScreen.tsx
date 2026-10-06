import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import { updateStore } from '@apis/storeApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useDialog } from '@contexts/DialogContext';
import { loadingController } from '@utils/loadingController';
import {
  BOTTOM_BTN_BOX_HEIGHT,
  BottomBtnBox,
  InfoBox,
  PrimaryButton,
  ScreenWrapper,
  ToggleSwitch,
  Typography,
} from '@components/common';
import { theme } from '@styles';

type Props = NativeStackScreenProps<RootStackParamList, 'OperationSetting'>;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const SwitchCard: React.FC<{
  icon: IconName;
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, title, desc, value, onChange }) => (
  <View style={[styles.card, !value && styles.cardOff]}>
    <View style={[styles.iconWrap, { backgroundColor: value ? theme.colors.orange50 : theme.colors.gray100 }]}>
      <MaterialCommunityIcons name={icon} size={22} color={value ? theme.colors.orange600 : theme.colors.gray400} />
    </View>
    <View style={{ flex: 1 }}>
      <Typography mode="subtitle2" color="gray900">
        {title}
      </Typography>
      <Typography mode="caption1" color={value ? 'green900' : 'gray500'}>
        {value ? '운영중' : '중단'} · {desc}
      </Typography>
    </View>
    <ToggleSwitch value={value} onValueChange={onChange} />
  </View>
);

/** 배달/포장 주문 받기 여부와 영업 일시중지를 한 화면에서 */
const OperationSettingScreen: React.FC<Props> = ({ navigation }) => {
  const { store, setStore, setStatus } = useStore();
  const { confirm } = useDialog();
  const [delivery, setDelivery] = useState(store?.deliveryEnabled ?? true);
  const [pickup, setPickup] = useState(store?.pickupEnabled ?? true);
  const [saving, setSaving] = useState(false);

  const dirty = delivery !== store?.deliveryEnabled || pickup !== store?.pickupEnabled;
  const paused = store?.status === 'PAUSED';

  const save = async () => {
    if (saving) return;
    if (!delivery && !pickup) {
      const yes = await confirm({
        title: '주문 중단',
        message1: '배달과 포장을 모두 끄면 주문을 전혀 받지 않아요.',
        message2: '잠시 쉬려면 "영업 일시중지"가 더 알맞아요. 그래도 저장할까요?',
        confirmText: '저장',
        cancelText: '취소',
      });
      if (!yes) return;
    }
    setSaving(true);
    loadingController.start();
    const res = await updateStore({ deliveryEnabled: delivery, pickupEnabled: pickup });
    loadingController.stop();
    setSaving(false);
    if (!isOk(res) || !res.store) {
      Toast.show({ type: 'error', text1: '저장하지 못했어요', text2: res.resultMsg });
      return;
    }
    setStore(res.store);
    Toast.show({ type: 'success', text1: '운영 설정을 저장했어요' });
    navigation.goBack();
  };

  const togglePause = async () => {
    const yes = await confirm(
      paused
        ? { title: '영업 재개', message1: '영업을 다시 시작할까요?', confirmText: '영업 재개', cancelText: '닫기' }
        : {
            title: '영업 일시중지',
            message1: '영업을 잠시 멈출까요?',
            message2: '멈춘 동안 새 주문이 들어오지 않아요. 진행중인 주문은 계속 처리할 수 있어요.',
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

  return (
    <ScreenWrapper backgroundColor="white">
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: BOTTOM_BTN_BOX_HEIGHT + 24 }]}>
        <Typography mode="subtitle3" color="gray500">
          주문 방식
        </Typography>
        <SwitchCard
          icon="moped-outline"
          title="배달 주문"
          desc="배달 기사가 음식을 가져가요"
          value={delivery}
          onChange={setDelivery}
        />
        <SwitchCard
          icon="shopping-outline"
          title="포장 주문"
          desc="고객이 가게에 방문해 픽업"
          value={pickup}
          onChange={setPickup}
        />
        <InfoBox>
          재료가 떨어졌거나 배달 기사 배차가 어려울 때 한 가지만 끌 수 있어요. 바꾼 설정은 바로 고객 앱에 반영돼요.
        </InfoBox>

        <Typography mode="subtitle3" color="gray500" style={{ marginTop: 12 }}>
          영업 상태
        </Typography>
        <View style={[styles.pauseCard, paused && styles.pauseCardOn]}>
          <View style={{ flex: 1 }}>
            <Typography mode="subtitle2" color={paused ? 'yellow900' : 'gray900'}>
              {paused ? '영업 일시중지 중' : '영업중'}
            </Typography>
            <Typography mode="caption1" color="gray500">
              {paused
                ? '고객 앱에 "잠시 주문을 받지 않아요"로 표시돼요'
                : '영업시간 안에서 정상적으로 주문을 받고 있어요'}
            </Typography>
          </View>
          <PrimaryButton
            label={paused ? '영업 재개' : '일시중지'}
            size="md"
            onPress={togglePause}
            buttonColor={paused ? theme.colors.primary : theme.colors.white}
          />
        </View>
      </ScrollView>

      <BottomBtnBox label="저장" onPress={save} disabled={!dirty || saving} />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  cardOff: { backgroundColor: theme.colors.gray50 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pauseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  pauseCardOn: { backgroundColor: theme.colors.yellow50, borderColor: theme.colors.yellow200 },
});

export default OperationSettingScreen;
