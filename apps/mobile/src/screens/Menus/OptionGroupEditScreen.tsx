import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import type { Menu, OptionGroupInput } from '@typ/domain';
import { createOptionGroup, getMenus, getOptionGroup, updateOptionGroup } from '@apis/menuApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useDialog } from '@contexts/DialogContext';
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
  Radio,
  ScreenWrapper,
  TextField,
  ToggleSwitch,
  Typography,
} from '@components/common';
import { theme } from '@styles';

type Props = NativeStackScreenProps<RootStackParamList, 'OptionGroupEdit'>;
type OptionDraft = OptionGroupInput['options'][number] & { key: string };

const COUNT_OPTIONS = ['1', '2', '3', '4', '5'];

/** 옵션 그룹 등록·수정: 이름, 필수/선택, 선택 개수, 옵션 목록, 연결 메뉴 */
const OptionGroupEditScreen: React.FC<Props> = ({ navigation, route }) => {
  const groupId = route.params?.groupId;
  const { store } = useStore();
  const { alert } = useDialog();

  const [name, setName] = useState('');
  const [required, setRequired] = useState(true);
  const [minSelect, setMinSelect] = useState(1);
  const [maxSelect, setMaxSelect] = useState(1);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [menuIds, setMenuIds] = useState<string[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loaded, setLoaded] = useState(!groupId);
  const [saving, setSaving] = useState(false);

  const [optSheet, setOptSheet] = useState<{ key: string | null; name: string; priceText: string } | null>(null);
  const [menuSheet, setMenuSheet] = useState(false);

  useEffect(() => {
    (async () => {
      const m = await getMenus();
      setMenus(isOk(m) && m.menus ? m.menus : []);
      if (groupId) {
        const res = await getOptionGroup(groupId);
        if (isOk(res) && res.group) {
          const g = res.group;
          setName(g.name);
          setRequired(g.required);
          setMinSelect(g.minSelect);
          setMaxSelect(g.maxSelect);
          setOptions(g.options.map((o) => ({ id: o.id, key: o.id, name: o.name, price: o.price, soldOut: o.soldOut })));
          setMenuIds(g.menuIds);
        }
        setLoaded(true);
      }
    })();
  }, [groupId]);

  // 필수 ↔ 선택 전환 시 최소 선택 수 보정
  const setRequiredAndFix = (r: boolean) => {
    setRequired(r);
    if (r && minSelect < 1) setMinSelect(1);
    if (!r) setMinSelect(0);
  };

  const commitOption = () => {
    if (!optSheet || !optSheet.name.trim()) return;
    const price = digitsToNumber(optSheet.priceText);
    if (optSheet.key === null) setOptions([...options, { key: `new-${Date.now()}`, name: optSheet.name.trim(), price, soldOut: false }]);
    else setOptions(options.map((o) => (o.key === optSheet.key ? { ...o, name: optSheet.name.trim(), price } : o)));
    setOptSheet(null);
  };

  const valid = name.trim().length > 0 && options.length > 0 && minSelect <= maxSelect && maxSelect <= options.length;

  const save = async () => {
    if (!store || !valid || saving) return;
    const input: OptionGroupInput = { name, required, minSelect, maxSelect, options: options.map(({ key: _k, ...o }) => o), menuIds };
    setSaving(true);
    loadingController.start();
    const res = groupId ? await updateOptionGroup(groupId, input) : await createOptionGroup(store.id, input);
    loadingController.stop();
    setSaving(false);
    if (!isOk(res)) {
      await alert({ title: '옵션 그룹', message1: res.resultMsg });
      return;
    }
    Toast.show({ type: 'success', text1: groupId ? '옵션 그룹을 수정했어요' : '옵션 그룹을 등록했어요' });
    navigation.goBack();
  };

  if (!loaded) return <ScreenWrapper backgroundColor="white"><View /></ScreenWrapper>;

  const linkedMenus = menus.filter((m) => menuIds.includes(m.id));

  return (
    <ScreenWrapper backgroundColor="white" keyboardBottomInset={BOTTOM_BTN_BOX_HEIGHT}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} keyboardAccessoryHeight={BOTTOM_BTN_BOX_HEIGHT}>
        <TextField id="groupName" inputMode="text" label="옵션 그룹명 *" placeholder="예) 맵기 선택" value={name} onChangeText={setName} maxLength={40} />

        {/* 필수/선택 */}
        <View>
          <Typography mode="subtitle3" color="gray700" style={{ marginBottom: 4 }}>
            선택 방식
          </Typography>
          <Radio
            selectedId={required ? 'req' : 'opt'}
            setSelectedId={(id) => setRequiredAndFix(id === 'req')}
            radioButtons={[
              { id: 'req', label: '필수 옵션 — 고객이 반드시 골라야 해요', value: 'req' },
              { id: 'opt', label: '선택 옵션 — 고르지 않아도 주문돼요', value: 'opt' },
            ]}
          />
        </View>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Typography mode="subtitle3" color="gray700" style={{ marginBottom: 8 }}>
              최소 선택
            </Typography>
            <Dropdown
              key={`min-${minSelect}-${required}`}
              placeholder={`${minSelect}개`}
              options={(required ? COUNT_OPTIONS : ['0', ...COUNT_OPTIONS]).map((n) => `${n}개`)}
              onSelect={(v) => setMinSelect(Number(v.replace('개', '')))}
              size="md"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Typography mode="subtitle3" color="gray700" style={{ marginBottom: 8 }}>
              최대 선택
            </Typography>
            <Dropdown
              key={`max-${maxSelect}`}
              placeholder={`${maxSelect}개`}
              options={COUNT_OPTIONS.map((n) => `${n}개`)}
              onSelect={(v) => setMaxSelect(Number(v.replace('개', '')))}
              size="md"
            />
          </View>
        </View>
        {minSelect > maxSelect && (
          <Typography mode="caption1" color="red600">
            최소 선택 수가 최대 선택 수보다 클 수 없어요.
          </Typography>
        )}
        {options.length > 0 && maxSelect > options.length && (
          <Typography mode="caption1" color="red600">
            최대 선택 수가 옵션 개수({options.length}개)보다 클 수 없어요.
          </Typography>
        )}

        {/* 옵션 목록 */}
        <View>
          <View style={styles.rowBetween}>
            <Typography mode="subtitle3" color="gray700">
              옵션 *
            </Typography>
            <Typography mode="caption1" color="gray500">
              {options.length}개
            </Typography>
          </View>
          <View style={{ gap: 8, marginTop: 8 }}>
            {options.map((o, i) => (
              <View key={o.key} style={styles.optRow}>
                <Pressable style={{ flex: 1 }} onPress={() => setOptSheet({ key: o.key, name: o.name, priceText: o.price ? comma(o.price) : '' })}>
                  <Typography mode="subtitle3" color={o.soldOut ? 'gray400' : 'gray900'}>
                    {o.name}
                  </Typography>
                  <Typography mode="caption1" color="gray500">
                    {o.price ? `+${won(o.price)}` : '추가 금액 없음'}
                  </Typography>
                </Pressable>
                <View style={styles.optCtl}>
                  <Typography mode="caption1" color="gray500">
                    품절
                  </Typography>
                  <ToggleSwitch value={o.soldOut} onValueChange={(v) => setOptions(options.map((x, j) => (j === i ? { ...x, soldOut: v } : x)))} />
                </View>
                <Pressable onPress={() => setOptions(options.filter((_, j) => j !== i))} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={18} color={theme.colors.gray400} />
                </Pressable>
              </View>
            ))}
            <PrimaryButton label="+ 옵션 추가" size="md" buttonColor={theme.colors.white} onPress={() => setOptSheet({ key: null, name: '', priceText: '' })} />
          </View>
        </View>

        {/* 연결 메뉴 */}
        <View>
          <View style={styles.rowBetween}>
            <Typography mode="subtitle3" color="gray700">
              연결된 메뉴
            </Typography>
            <Pressable onPress={() => setMenuSheet(true)} style={styles.linkBtn}>
              <Typography mode="subtitle4" color="orange700">
                메뉴 선택
              </Typography>
              <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.orange700} />
            </Pressable>
          </View>
          <View style={styles.menuChips}>
            {linkedMenus.length ? (
              linkedMenus.map((m) => <Badge key={m.id} label={m.name} tone="gray" size="medium" />)
            ) : (
              <Typography mode="body2" color="gray500">
                아직 연결된 메뉴가 없어요. 메뉴 수정 화면에서 연결할 수도 있어요.
              </Typography>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>

      <BottomBtnBox label={groupId ? '수정 완료' : '등록하기'} onPress={save} disabled={!valid || saving} />

      {/* 옵션 추가/수정 */}
      <BottomSheet
        visible={!!optSheet}
        setVisible={(v) => !v && setOptSheet(null)}
        title={optSheet?.key === null ? '옵션 추가' : '옵션 수정'}
        content={
          optSheet && (
            <View style={{ gap: 12 }}>
              <TextField id="optName" inputMode="text" label="옵션명" placeholder="예) 곱빼기" value={optSheet.name} onChangeText={(v) => setOptSheet({ ...optSheet, name: v })} maxLength={40} />
              <TextField
                id="optPrice"
                inputMode="numeric"
                label="추가 금액(원)"
                placeholder="0"
                value={optSheet.priceText}
                onChangeText={(v) => {
                  const n = digitsToNumber(v);
                  setOptSheet({ ...optSheet, priceText: n ? comma(n) : '' });
                }}
              />
              <PrimaryButton label="확인" onPress={commitOption} disabled={!optSheet.name.trim()} />
            </View>
          )
        }
      />

      {/* 메뉴 연결 */}
      <BottomSheet
        visible={menuSheet}
        setVisible={setMenuSheet}
        title="메뉴 연결"
        content={
          <View style={{ gap: 4 }}>
            {menus.map((m) => (
              <CheckBox
                key={m.id}
                isChecked={menuIds.includes(m.id)}
                setIsChecked={() => setMenuIds(menuIds.includes(m.id) ? menuIds.filter((id) => id !== m.id) : [...menuIds, m.id])}
                labelComponent={
                  <Typography mode="body2" color="gray900">
                    {m.name}{' '}
                    <Typography mode="caption1" color="gray500">
                      {m.categoryName ?? '미분류'}
                    </Typography>
                  </Typography>
                }
              />
            ))}
            {menus.length === 0 && (
              <Typography mode="body2" color="gray500">
                등록된 메뉴가 없어요.
              </Typography>
            )}
          </View>
        }
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20 },
  twoCol: { flexDirection: 'row', gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line },
  optCtl: { alignItems: 'center', gap: 2 },
  linkBtn: { flexDirection: 'row', alignItems: 'center' },
  menuChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
});

export default OptionGroupEditScreen;
