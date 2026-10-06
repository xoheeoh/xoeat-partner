import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import { getCategories, saveCategories } from '@apis/menuApi';
import { isOk } from '@apis/client';
import { useStore } from '@contexts/StoreContext';
import { useDialog } from '@contexts/DialogContext';
import { loadingController } from '@utils/loadingController';
import {
  Badge,
  BOTTOM_BTN_BOX_HEIGHT,
  BottomBtnBox,
  BottomSheet,
  InfoBox,
  KeyboardAwareScrollView,
  PrimaryButton,
  ScreenWrapper,
  SortableList,
  TextField,
  Typography,
} from '@components/common';
import { theme } from '@styles';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryManage'>;
type Item = { id?: string; name: string; key: string };

/** 드래그 위치 계산을 위해 모든 줄의 높이를 같게 둔다 */
const ROW_HEIGHT = 56;

/**
 * 카테고리 추가·이름 변경·순서 변경·삭제를 화면에서 모아 두었다가 저장 버튼 한 번에 반영한다.
 * 순서는 왼쪽 손잡이(≡)를 잡고 끌어서 바꾼다 (SortableList).
 */
const CategoryManageScreen: React.FC<Props> = ({ navigation }) => {
  const { store } = useStore();
  const { confirm } = useDialog();
  const [items, setItems] = useState<Item[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [original, setOriginal] = useState<string>('');
  const [editing, setEditing] = useState<{ index: number | null; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // 드래그 중에는 화면 스크롤을 잠가 손가락이 줄과 화면을 동시에 움직이지 않게 한다
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    getCategories().then((res) => {
      const list = (isOk(res) && res.categories ? res.categories : []).map((c) => ({
        id: c.id,
        name: c.name,
        key: c.id,
      }));
      setItems(list);
      setOriginal(JSON.stringify(list));
    });
  }, []);

  const dirty = JSON.stringify(items) !== original || removed.length > 0;

  /** from 번째 줄을 빼서 to 번째에 끼워 넣는다 */
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  };

  const remove = async (i: number) => {
    const yes = await confirm({
      title: '카테고리 삭제',
      message1: `'${items[i].name}' 카테고리를 삭제할까요?`,
      message2: '이 카테고리의 메뉴는 삭제되지 않고 "미분류"로 남습니다.',
      confirmText: '삭제',
      cancelText: '취소',
    });
    if (!yes) return;
    const target = items[i];
    if (target.id) setRemoved((r) => [...r, target.id!]);
    setItems(items.filter((_, idx) => idx !== i));
  };

  const commitEdit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    if (editing.index === null) setItems([...items, { name, key: `new-${Date.now()}` }]);
    else setItems(items.map((it, idx) => (idx === editing.index ? { ...it, name } : it)));
    setEditing(null);
  };

  const save = async () => {
    if (!store || saving) return;
    setSaving(true);
    loadingController.start();
    const res = await saveCategories(store.id, items, removed);
    loadingController.stop();
    setSaving(false);
    if (!isOk(res)) {
      Toast.show({ type: 'error', text1: '저장하지 못했어요', text2: res.resultMsg });
      return;
    }
    Toast.show({ type: 'success', text1: '카테고리를 저장했어요' });
    navigation.goBack();
  };

  return (
    <ScreenWrapper backgroundColor="white" keyboardBottomInset={BOTTOM_BTN_BOX_HEIGHT}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardAccessoryHeight={BOTTOM_BTN_BOX_HEIGHT}
        scrollEnabled={!dragging}>
        <InfoBox>
          고객 앱의 메뉴판은 이 순서대로 보여요. 왼쪽 손잡이를 잡고 끌어 순서를 바꾸고 저장을 눌러 주세요.
        </InfoBox>

        <View>
          <SortableList
            data={items}
            keyOf={(it) => it.key}
            rowHeight={ROW_HEIGHT}
            onReorder={reorder}
            onDragChange={setDragging}
            renderItem={(it, i, handle) => (
              <View style={styles.row}>
                {handle}
                <Pressable style={styles.nameArea} onPress={() => setEditing({ index: i, name: it.name })}>
                  <Typography mode="subtitle2" color="gray900" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {it.name}
                  </Typography>
                  {/* 줄 높이를 같게 유지하려고 두 번째 줄 대신 배지로 표시한다 */}
                  {!it.id && <Badge label="저장 전" tone="orange" size="small" />}
                </Pressable>
                <Pressable onPress={() => setEditing({ index: i, name: it.name })} hitSlop={8} style={styles.iconBtn}>
                  <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.gray500} />
                </Pressable>
                <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.iconBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.red500} />
                </Pressable>
              </View>
            )}
          />
          {items.length === 0 && (
            <Typography mode="body2" color="gray500" style={{ textAlign: 'center', paddingVertical: 24 }}>
              카테고리가 없어요
            </Typography>
          )}
        </View>

        <PrimaryButton
          label="+ 카테고리 추가"
          size="md"
          buttonColor={theme.colors.white}
          onPress={() => setEditing({ index: null, name: '' })}
        />
      </KeyboardAwareScrollView>

      <BottomBtnBox label="저장" onPress={save} disabled={!dirty || saving} />

      <BottomSheet
        visible={!!editing}
        setVisible={(v) => !v && setEditing(null)}
        title={editing?.index === null ? '카테고리 추가' : '카테고리 이름 변경'}
        content={
          editing && (
            <View style={{ gap: 12 }}>
              <TextField
                id="categoryName"
                inputMode="text"
                label="카테고리명"
                placeholder="예) 대표 메뉴"
                value={editing.name}
                onChangeText={(v) => setEditing({ ...editing, name: v })}
                maxLength={30}
              />
              <PrimaryButton label="확인" onPress={commitEdit} disabled={!editing.name.trim()} />
            </View>
          )
        }
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 0, gap: 16 },
  // 줄 높이는 SortableList 가 ROW_HEIGHT 로 고정한다. 여기서는 가로 배치와 구분선만
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  nameArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});

export default CategoryManageScreen;
