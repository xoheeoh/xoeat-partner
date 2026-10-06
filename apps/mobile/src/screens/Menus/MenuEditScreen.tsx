import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import type { MenuCategory, MenuInput, OptionGroup, SaleStatus } from '@typ/domain';
import { createMenu, getCategories, getMenu, getOptionGroups, updateMenu, uploadMenuImage } from '@apis/menuApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useDialog } from '@contexts/DialogContext';
import { SALE_STATUS } from '@dt/constants';
import { comma, digitsToNumber, won } from '@utils/formatter';
import { loadingController } from '@utils/loadingController';
import {
  Badge,
  BOTTOM_BTN_BOX_HEIGHT,
  BottomBtnBox,
  BottomSheet,
  CheckBox,
  Dropdown,
  KeyboardAwareScrollView,
  PrimaryButton,
  ScreenWrapper,
  TextField,
  Textarea,
  ToggleSwitch,
  Typography,
} from '@components/common';
import { theme } from '@styles';

type Props = NativeStackScreenProps<RootStackParamList, 'MenuEdit'>;

const EMPTY: MenuInput = {
  categoryId: null,
  name: '',
  description: '',
  standard: '',
  price: 0,
  imageUrl: null,
  saleStatus: 'ON_SALE',
  adultOnly: false,
  optionGroupIds: [],
};

const Label: React.FC<{ text: string }> = ({ text }) => (
  <Typography mode="subtitle3" color="gray700" style={{ marginBottom: 8 }}>
    {text}
  </Typography>
);

/** 메뉴 등록·수정. 이미지는 Supabase Storage 에 올리고 URL 만 저장한다 */
const MenuEditScreen: React.FC<Props> = ({ navigation, route }) => {
  const menuId = route.params?.menuId;
  const { store } = useStore();
  const { alert } = useDialog();

  const [form, setForm] = useState<MenuInput>(EMPTY);
  const [priceText, setPriceText] = useState('');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [loaded, setLoaded] = useState(!menuId);
  const [groupSheet, setGroupSheet] = useState(false);
  // 시트 안에서 고르는 임시 선택. "N개 선택 완료"를 눌러야 form 에 반영되고, X·끌어내리기로 닫으면 버려진다
  const [groupDraft, setGroupDraft] = useState<string[]>([]);
  const openGroupSheet = () => {
    setGroupDraft(form.optionGroupIds);
    setGroupSheet(true);
  };
  const applyGroupDraft = () => {
    set('optionGroupIds', groupDraft);
    setGroupSheet(false);
  };
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof MenuInput>(k: K, v: MenuInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      const [c, g] = await Promise.all([getCategories(), getOptionGroups()]);
      setCategories(isOk(c) && c.categories ? c.categories : []);
      setGroups(isOk(g) && g.groups ? g.groups : []);
      if (menuId) {
        const res = await getMenu(menuId);
        if (isOk(res) && res.menu) {
          const m = res.menu;
          setForm({
            categoryId: m.categoryId,
            name: m.name,
            description: m.description,
            standard: m.standard,
            price: m.price,
            imageUrl: m.imageUrl,
            saleStatus: m.saleStatus,
            adultOnly: m.adultOnly,
            optionGroupIds: m.optionGroupIds,
          });
          setPriceText(comma(m.price));
        }
        setLoaded(true);
      }
    })();
  }, [menuId]);

  /* ── 이미지 ─────────────────────────────────────── */
  const pickImage = async () => {
    if (!store) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      await alert({ title: '사진 권한', message1: '메뉴 사진을 고르려면 사진 보관함 접근 권한이 필요해요.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const res = await uploadMenuImage(store.id, asset.uri, asset.mimeType ?? 'image/jpeg');
    setUploading(false);
    if (isOk(res) && res.imageUrl) set('imageUrl', res.imageUrl);
    else Toast.show({ type: 'error', text1: '이미지를 올리지 못했어요', text2: res.resultMsg });
  };

  /* ── 저장 ───────────────────────────────────────── */
  const valid = form.name.trim().length > 0 && form.price > 0;

  const save = async () => {
    if (!store || !valid || saving) return;
    setSaving(true);
    loadingController.start();
    const res = menuId ? await updateMenu(store.id, menuId, form) : await createMenu(store.id, form);
    loadingController.stop();
    setSaving(false);
    if (!isOk(res)) {
      await alert({ title: menuId ? '메뉴 수정' : '메뉴 등록', message1: res.resultMsg });
      return;
    }
    Toast.show({ type: 'success', text1: menuId ? '메뉴를 수정했어요' : '메뉴를 등록했어요' });
    navigation.goBack();
  };

  const categoryNames = ['카테고리 없음', ...categories.map((c) => c.name)];
  const selectedCategoryName = categories.find((c) => c.id === form.categoryId)?.name ?? '카테고리 없음';
  const selectedGroups = groups.filter((g) => form.optionGroupIds.includes(g.id));

  if (!loaded) return <ScreenWrapper backgroundColor="white"><View /></ScreenWrapper>;

  return (
    <ScreenWrapper backgroundColor="white" keyboardBottomInset={BOTTOM_BTN_BOX_HEIGHT}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardAccessoryHeight={BOTTOM_BTN_BOX_HEIGHT}>
        {/* 이미지 */}
        <View style={styles.imageRow}>
          <Pressable onPress={pickImage} style={styles.imageBox} disabled={uploading}>
            {form.imageUrl ? (
              <Image source={{ uri: form.imageUrl }} style={styles.image} />
            ) : (
              <View style={styles.imageEmpty}>
                <MaterialCommunityIcons name="camera-plus-outline" size={28} color={theme.colors.gray400} />
                <Typography mode="caption1" color="gray500">
                  {uploading ? '올리는 중…' : '사진 추가'}
                </Typography>
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 8 }}>
            <Typography mode="caption1" color="gray500">
              정사각형으로 잘려 고객 앱 메뉴 목록에 보여요. 5MB 이하 JPG·PNG.
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

        <TextField id="name" inputMode="text" label="메뉴명 *" placeholder="예) 소반 김치찌개" value={form.name} onChangeText={(v) => set('name', v)} maxLength={60} />

        <View>
          <Label text="카테고리" />
          <Dropdown
            key={selectedCategoryName}
            placeholder={selectedCategoryName}
            options={categoryNames}
            onSelect={(name) => set('categoryId', categories.find((c) => c.name === name)?.id ?? null)}
          />
        </View>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <TextField
              id="price"
              inputMode="numeric"
              label="가격(원) *"
              placeholder="0"
              value={priceText}
              onChangeText={(v) => {
                const n = digitsToNumber(v);
                setPriceText(n ? comma(n) : '');
                set('price', n);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField id="standard" inputMode="text" label="규격" placeholder="예) 1인분, 600ml" value={form.standard} onChangeText={(v) => set('standard', v)} maxLength={20} />
          </View>
        </View>

        <View>
          <Label text="메뉴 설명" />
          <Textarea value={form.description} setValue={(v) => set('description', v)} height={96} />
        </View>

        <View>
          <Label text="판매 상태" />
          <View style={styles.statusRow}>
            {(Object.keys(SALE_STATUS) as SaleStatus[]).map((s) => (
              <Pressable key={s} onPress={() => set('saleStatus', s)} style={[styles.statusChip, form.saleStatus === s && styles.statusChipActive]}>
                <Typography mode="subtitle3" color={form.saleStatus === s ? 'orange700' : 'gray600'}>
                  {SALE_STATUS[s].label}
                </Typography>
              </Pressable>
            ))}
          </View>
        </View>

        <CheckBox
          isChecked={form.adultOnly}
          setIsChecked={(v) => set('adultOnly', typeof v === 'function' ? v(form.adultOnly) : v)}
          labelComponent={
            <Typography mode="body2" color="gray700">
              미성년자에게 판매할 수 없는 메뉴 (주류 등)
            </Typography>
          }
        />

        {/* 옵션 그룹 */}
        <View>
          <View style={styles.rowBetween}>
            <Label text="옵션 그룹" />
            <Pressable onPress={openGroupSheet} style={styles.linkBtn}>
              <Typography mode="subtitle4" color="orange700">
                연결 관리
              </Typography>
              <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.orange700} />
            </Pressable>
          </View>
          {selectedGroups.length ? (
            <View style={{ gap: 8 }}>
              {selectedGroups.map((g) => (
                <View key={g.id} style={styles.groupCard}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Typography mode="subtitle3" color="gray900">
                        {g.name}
                      </Typography>
                      <Badge label={g.required ? '필수' : '선택'} tone={g.required ? 'orange' : 'gray'} />
                    </View>
                    <Typography mode="caption1" color="gray500" numberOfLines={1}>
                      {g.options.map((o) => `${o.name}${o.price ? ` +${won(o.price)}` : ''}`).join(', ')}
                    </Typography>
                  </View>
                  <Pressable onPress={() => set('optionGroupIds', form.optionGroupIds.filter((id) => id !== g.id))} hitSlop={8}>
                    <MaterialCommunityIcons name="close" size={18} color={theme.colors.gray400} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Pressable onPress={openGroupSheet} style={styles.groupEmpty}>
              <Typography mode="body2" color="gray500">
                연결된 옵션 그룹이 없어요. 맵기·사이즈 같은 선택지를 붙여 보세요.
              </Typography>
            </Pressable>
          )}
        </View>
      </KeyboardAwareScrollView>

      <BottomBtnBox label={menuId ? '수정 완료' : '등록하기'} onPress={save} disabled={!valid || saving || uploading} />

      {/* 옵션 그룹 선택 */}
      <BottomSheet
        visible={groupSheet}
        setVisible={setGroupSheet}
        title="옵션 그룹 연결"
        content={
          <View style={{ gap: 8 }}>
            {groups.length === 0 && (
              <Typography mode="body2" color="gray500">
                등록된 옵션 그룹이 없어요. 메뉴 관리 › 옵션 그룹 탭에서 먼저 만들어 주세요.
              </Typography>
            )}
            {groups.map((g) => {
              const on = groupDraft.includes(g.id);
              // 상자 어디를 눌러도, 스위치를 직접 눌러도 같은 토글이 일어나야 한다. 스위치가 터치를 먼저 가져가므로 둘 다 연결한다
              const toggle = () => setGroupDraft(on ? groupDraft.filter((id) => id !== g.id) : [...groupDraft, g.id]);
              return (
                <Pressable key={g.id} onPress={toggle} style={[styles.groupCard, on && styles.groupCardOn]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Typography mode="subtitle3" color="gray900">
                        {g.name}
                      </Typography>
                      <Badge label={g.required ? '필수' : '선택'} tone={g.required ? 'orange' : 'gray'} />
                    </View>
                    <Typography mode="caption1" color="gray500" numberOfLines={1}>
                      {g.options.map((o) => o.name).join(', ')}
                    </Typography>
                  </View>
                  <ToggleSwitch value={on} onValueChange={toggle} />
                </Pressable>
              );
            })}
            {/* 이 버튼을 눌러야 임시 선택이 form 에 반영된다. X·끌어내리기로 닫으면 바뀌지 않는다 */}
            {groups.length > 0 && (
              <PrimaryButton
                label={groupDraft.length > 0 ? `${groupDraft.length}개 선택 완료` : '선택 완료'}
                size="lg"
                onPress={applyGroupDraft}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
        }
      />
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
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { flex: 1, height: 44, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  statusChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.orange50 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  linkBtn: { flexDirection: 'row', alignItems: 'center' },
  groupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line },
  groupCardOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.orange50 },
  groupEmpty: { padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.gray50, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.line },
});

export default MenuEditScreen;
