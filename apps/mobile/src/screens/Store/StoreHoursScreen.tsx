import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import type { StoreHour } from '@typ/domain';
import { getStoreHours, saveStoreHours } from '@apis/storeApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useDialog } from '@contexts/DialogContext';
import { DAY_LABELS, TIME_OPTIONS } from '@dt/constants';
import { loadingController } from '@utils/loadingController';
import {
  BOTTOM_BTN_BOX_HEIGHT,
  BottomBtnBox,
  CheckBox,
  Dropdown,
  InfoBox,
  ScreenWrapper,
  ToggleSwitch,
  Typography,
} from '@components/common';
import { theme } from '@styles';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreHours'>;

const DEFAULT_HOURS: StoreHour[] = DAY_LABELS.map((_, i) => ({
  dayOfWeek: i,
  enabled: true,
  openTime: '10:00',
  closeTime: '22:00',
  breakFrom: null,
  breakTo: null,
}));

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 요일별 영업시간·휴게시간. 종료가 시작보다 이르면 "다음날 새벽"으로 본다 (예: 17:00 ~ 02:00) */
const StoreHoursScreen: React.FC<Props> = ({ navigation }) => {
  const { store } = useStore();
  const { alert } = useDialog();
  const [hours, setHours] = useState<StoreHour[]>(DEFAULT_HOURS);
  const [original, setOriginal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStoreHours().then((res) => {
      const list = isOk(res) && res.hours?.length === 7 ? res.hours : DEFAULT_HOURS;
      setHours(list);
      setOriginal(JSON.stringify(list));
    });
  }, []);

  const dirty = JSON.stringify(hours) !== original;
  const patch = (i: number, p: Partial<StoreHour>) =>
    setHours((h) => h.map((d, idx) => (idx === i ? { ...d, ...p } : d)));

  /** 월요일 설정을 다른 모든 요일에 복사 */
  const applyMondayToAll = () => {
    const mon = hours[0];
    setHours(hours.map((d) => ({ ...mon, dayOfWeek: d.dayOfWeek })));
    Toast.show({ type: 'success', text1: '월요일 시간을 모든 요일에 적용했어요' });
  };

  const validate = () => {
    const errors: string[] = [];
    hours.forEach((d) => {
      if (!d.enabled) return;
      if (d.breakFrom && d.breakTo) {
        const open = toMin(d.openTime);
        const close = toMin(d.closeTime) <= open ? toMin(d.closeTime) + 1440 : toMin(d.closeTime);
        let bf = toMin(d.breakFrom);
        let bt = toMin(d.breakTo);
        if (bf < open) bf += 1440;
        if (bt < open) bt += 1440;
        if (bt <= bf) errors.push(`${DAY_LABELS[d.dayOfWeek]}요일 휴게시간: 종료가 시작보다 빠를 수 없어요.`);
        else if (bf < open || bt > close) errors.push(`${DAY_LABELS[d.dayOfWeek]}요일 휴게시간이 영업시간 밖이에요.`);
      }
    });
    return errors;
  };

  const save = async () => {
    if (!store || saving) return;
    const errors = validate();
    if (errors.length) {
      await alert({
        title: '시간 설정 확인',
        message1: errors[0],
        message2: errors.length > 1 ? `외 ${errors.length - 1}건` : undefined,
      });
      return;
    }
    setSaving(true);
    loadingController.start();
    const res = await saveStoreHours(store.id, hours);
    loadingController.stop();
    setSaving(false);
    if (!isOk(res)) {
      Toast.show({ type: 'error', text1: '저장하지 못했어요', text2: res.resultMsg });
      return;
    }
    Toast.show({ type: 'success', text1: '영업시간을 저장했어요' });
    navigation.goBack();
  };

  return (
    <ScreenWrapper backgroundColor="white">
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: BOTTOM_BTN_BOX_HEIGHT + 24 }]}>
        <InfoBox>
          영업시간 밖에는 고객 앱에 준비중으로 표시되고 주문을 받지 않아요. 자정을 넘기는 영업은 종료 시간을 새벽
          시간으로 두면 돼요 (예: 17:00 ~ 02:00).
        </InfoBox>
        <Pressable onPress={applyMondayToAll} style={styles.copyBtn}>
          <Typography mode="subtitle4" color="orange700">
            월요일 설정을 모든 요일에 적용
          </Typography>
        </Pressable>

        {hours.map((d, i) => (
          <View key={d.dayOfWeek} style={[styles.day, !d.enabled && styles.dayOff]}>
            <View style={styles.dayHead}>
              <Typography mode="subtitle2" color={d.enabled ? 'gray900' : 'gray400'}>
                {DAY_LABELS[d.dayOfWeek]}요일
              </Typography>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Typography mode="caption1" color={d.enabled ? 'gray600' : 'gray400'}>
                  {d.enabled ? '영업' : '휴무'}
                </Typography>
                <ToggleSwitch value={d.enabled} onValueChange={(v) => patch(i, { enabled: v })} />
              </View>
            </View>

            {d.enabled && (
              <>
                <View style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Dropdown
                      key={`o-${i}-${d.openTime}`}
                      size="md"
                      placeholder={d.openTime}
                      options={TIME_OPTIONS}
                      onSelect={(v) => patch(i, { openTime: v })}
                    />
                  </View>
                  <Typography mode="body2" color="gray500">
                    ~
                  </Typography>
                  <View style={{ flex: 1 }}>
                    <Dropdown
                      key={`c-${i}-${d.closeTime}`}
                      size="md"
                      placeholder={d.closeTime}
                      options={TIME_OPTIONS}
                      onSelect={(v) => patch(i, { closeTime: v })}
                    />
                  </View>
                </View>
                {toMin(d.closeTime) <= toMin(d.openTime) && (
                  <Typography mode="caption1" color="gray500">
                    다음날 {d.closeTime}까지 영업
                  </Typography>
                )}

                <CheckBox
                  isChecked={!!d.breakFrom}
                  setIsChecked={() =>
                    patch(
                      i,
                      d.breakFrom ? { breakFrom: null, breakTo: null } : { breakFrom: '15:00', breakTo: '17:00' },
                    )
                  }
                  labelComponent={
                    <Typography mode="body2" color="gray700">
                      휴게시간 (브레이크 타임)
                    </Typography>
                  }
                />
                {!!d.breakFrom && (
                  <View style={styles.timeRow}>
                    <View style={{ flex: 1 }}>
                      <Dropdown
                        key={`bf-${i}-${d.breakFrom}`}
                        size="md"
                        placeholder={d.breakFrom}
                        options={TIME_OPTIONS}
                        onSelect={(v) => patch(i, { breakFrom: v })}
                      />
                    </View>
                    <Typography mode="body2" color="gray500">
                      ~
                    </Typography>
                    <View style={{ flex: 1 }}>
                      <Dropdown
                        key={`bt-${i}-${d.breakTo}`}
                        size="md"
                        placeholder={d.breakTo ?? ''}
                        options={TIME_OPTIONS}
                        onSelect={(v) => patch(i, { breakTo: v })}
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        ))}
      </ScrollView>

      <BottomBtnBox label="저장" onPress={save} disabled={!dirty || saving} />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  copyBtn: { alignSelf: 'flex-end', paddingVertical: 4 },
  day: { padding: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, gap: 10 },
  dayOff: { backgroundColor: theme.colors.gray50 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default StoreHoursScreen;
