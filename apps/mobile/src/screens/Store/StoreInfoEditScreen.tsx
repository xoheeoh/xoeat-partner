import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import type { StoreEditable } from '@typ/domain';
import { updateStore } from '@apis/storeApi';
import { uploadMenuImage } from '@apis/menuApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useDialog } from '@contexts/DialogContext';
import { STORE_CATEGORIES, categoryLabel } from '@dt/constants';
import { comma, digitsToNumber } from '@utils/formatter';
import { loadingController } from '@utils/loadingController';
import { BOTTOM_BTN_BOX_HEIGHT, BottomBtnBox, Dropdown, KeyboardAwareScrollView, ScreenWrapper, TextField, Textarea, ToggleSwitch, Typography } from '@components/common';
import { theme } from '@styles';

type Props = NativeStackScreenProps<RootStackParamList, 'StoreInfoEdit'>;

const Label: React.FC<{ text: string; hint?: string }> = ({ text, hint }) => (
  <View style={{ marginBottom: 8 }}>
    <Typography mode="subtitle3" color="gray700">
      {text}
    </Typography>
    {!!hint && (
      <Typography mode="caption1" color="gray500">
        {hint}
      </Typography>
    )}
  </View>
);

/** 가게 정보 수정: 고객 앱에 보이는 소개·원산지·대표 이미지와 주문 조건(최소주문·배달비·자체배달) */
const StoreInfoEditScreen: React.FC<Props> = ({ navigation }) => {
  const { store, setStore } = useStore();
  const { alert, confirm } = useDialog();
  const [form, setForm] = useState<StoreEditable>({
    name: store?.name ?? '',
    categoryCd: store?.categoryCd ?? 'KOREAN_FOOD',
    intro: store?.intro ?? '',
    originInfo: store?.originInfo ?? '',
    phone: store?.phone ?? '',
    imageUrl: store?.imageUrl ?? null,
    minOrderAmount: store?.minOrderAmount ?? 0,
    deliveryFee: store?.deliveryFee ?? 0,
    deliveryEnabled: store?.deliveryEnabled ?? true,
    pickupEnabled: store?.pickupEnabled ?? true,
    selfDelivery: store?.selfDelivery ?? false,
  });
  const [minText, setMinText] = useState(store?.minOrderAmount ? comma(store.minOrderAmount) : '');
  const [feeText, setFeeText] = useState(store?.deliveryFee ? comma(store.deliveryFee) : '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof StoreEditable>(k: K, v: StoreEditable[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pickImage = async () => {
    if (!store) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      await alert({ title: '사진 권한', message1: '대표 사진을 고르려면 사진 보관함 접근 권한이 필요해요.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    const res = await uploadMenuImage(store.id, result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
    setUploading(false);
    if (isOk(res) && res.imageUrl) set('imageUrl', res.imageUrl);
    else Toast.show({ type: 'error', text1: '이미지를 올리지 못했어요', text2: res.resultMsg });
  };

  const toggleSelfDelivery = async (v: boolean) => {
    if (v) {
      const yes = await confirm({
        title: '자체 배달 사용',
        message1: '배달 주문을 수락할 때 "자체 배달" 선택지가 생겨요.',
        message2: '자체 배달로 수락한 주문은 배달 기사가 호출되지 않고, 가게에서 직접 배달 시작·완료를 눌러 처리합니다.',
        confirmText: '사용',
        cancelText: '취소',
      });
      if (!yes) return;
    }
    set('selfDelivery', v);
  };

  const valid = form.name.trim().length > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    loadingController.start();
    const res = await updateStore(form);
    loadingController.stop();
    setSaving(false);
    if (!isOk(res) || !res.store) {
      await alert({ title: '가게 정보', message1: res.resultMsg });
      return;
    }
    setStore(res.store);
    Toast.show({ type: 'success', text1: '가게 정보를 저장했어요' });
    navigation.goBack();
  };

  return (
    <ScreenWrapper backgroundColor="white" keyboardBottomInset={BOTTOM_BTN_BOX_HEIGHT}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardAccessoryHeight={BOTTOM_BTN_BOX_HEIGHT}>
        {/* 대표 이미지 */}
        <View style={styles.imageRow}>
          <Pressable onPress={pickImage} style={styles.imageBox} disabled={uploading}>
            {form.imageUrl ? (
              <Image source={{ uri: form.imageUrl }} style={styles.image} />
            ) : (
              <View style={styles.imageEmpty}>
                <MaterialCommunityIcons name="camera-plus-outline" size={28} color={theme.colors.gray400} />
                <Typography mode="caption1" color="gray500">
                  {uploading ? '올리는 중…' : '대표 사진'}
                </Typography>
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <Typography mode="caption1" color="gray500">
              고객 앱의 가게 목록과 상단에 보이는 사진이에요.
            </Typography>
            {!!form.imageUrl && (
              <Pressable onPress={() => set('imageUrl', null)}>
                <Typography mode="caption1" color="red600">
                  사진 지우기
                </Typography>
              </Pressable>
            )}
          </View>
        </View>

        <TextField id="storeName" inputMode="text" label="가게 이름 *" placeholder="가게 이름" value={form.name} onChangeText={(v) => set('name', v)} maxLength={40} />

        <View>
          <Label text="업종" />
          <Dropdown
            key={form.categoryCd}
            placeholder={categoryLabel(form.categoryCd)}
            options={STORE_CATEGORIES.map((c) => c.label)}
            onSelect={(label) => set('categoryCd', STORE_CATEGORIES.find((c) => c.label === label)?.code ?? form.categoryCd)}
          />
        </View>

        <TextField id="phone" inputMode="tel" label="가게 전화번호" placeholder="02-000-0000" value={form.phone} onChangeText={(v) => set('phone', v)} maxLength={20} />

        <View>
          <Label text="가게 소개" hint="고객 앱 가게 상단에 보여요. 300자까지" />
          <Textarea value={form.intro} setValue={(v) => set('intro', v.slice(0, 300))} height={100} />
        </View>

        <View>
          <Label text="원산지 정보" hint="식품위생법에 따라 주요 재료의 원산지를 표시해요" />
          <Textarea value={form.originInfo} setValue={(v) => set('originInfo', v.slice(0, 500))} height={80} />
        </View>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <TextField
              id="minOrder"
              inputMode="numeric"
              label="최소 주문금액(원)"
              placeholder="0"
              value={minText}
              onChangeText={(v) => {
                const n = digitsToNumber(v);
                setMinText(n ? comma(n) : '');
                set('minOrderAmount', n);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              id="deliveryFee"
              inputMode="numeric"
              label="배달비(원)"
              placeholder="0"
              value={feeText}
              onChangeText={(v) => {
                const n = digitsToNumber(v);
                setFeeText(n ? comma(n) : '');
                set('deliveryFee', n);
              }}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Typography mode="subtitle3" color="gray900">
              자체 배달 사용
            </Typography>
            <Typography mode="caption1" color="gray500">
              배달 기사 호출 없이 가게에서 직접 배달하는 주문을 받을 때
            </Typography>
          </View>
          <ToggleSwitch value={form.selfDelivery} onValueChange={toggleSelfDelivery} />
        </View>
      </KeyboardAwareScrollView>

      <BottomBtnBox label="저장" onPress={save} disabled={!valid || saving || uploading} />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20 },
  imageRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  imageBox: { width: 96, height: 96, borderRadius: theme.radius.md, overflow: 'hidden', backgroundColor: theme.colors.gray50, borderWidth: 1, borderColor: theme.colors.line },
  image: { width: '100%', height: '100%' },
  imageEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  twoCol: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.gray50 },
});

export default StoreInfoEditScreen;
