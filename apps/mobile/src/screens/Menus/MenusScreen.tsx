import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import type { RootStackParamList } from '@typ/navigation';
import type { Menu, MenuCategory, OptionGroup, SaleStatus } from '@typ/domain';
import { deleteMenu, deleteOptionGroup, getCategories, getMenus, getOptionGroups, setMenuSaleStatus } from '@apis/menuApi';
import { isOk } from '@apis/client';
import { useDialog } from '@contexts/DialogContext';
import { SALE_STATUS } from '@dt/constants';
import { won } from '@utils/formatter';
import { Badge, BottomSheet, PrimaryButton, ScreenWrapper, SkeletonList, TabBar, Typography } from '@components/common';
import { theme } from '@styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── 메뉴 탭 ──────────────────────────────────────────────────── */
const MenuList: React.FC<{ nav: Nav }> = ({ nav }) => {
  const { confirm } = useDialog();
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string | 'ALL' | 'NONE'>('ALL');
  const [statusSheet, setStatusSheet] = useState<Menu | null>(null);

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([getMenus(), getCategories()]);
    setMenus(isOk(m) && m.menus ? m.menus : []);
    setCategories(isOk(c) && c.categories ? c.categories : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // 고객 앱 메뉴판과 같은 순서: 카테고리 순서 → 메뉴 순서. 미분류는 맨 뒤
  const filtered = useMemo(() => {
    if (!menus) return [];
    const catIdx = new Map(categories.map((c, i) => [c.id, i]));
    const sorted = [...menus].sort((a, b) => {
      const ca = a.categoryId ? (catIdx.get(a.categoryId) ?? 999) : 999;
      const cb = b.categoryId ? (catIdx.get(b.categoryId) ?? 999) : 999;
      return ca - cb || a.sortOrder - b.sortOrder;
    });
    if (categoryId === 'ALL') return sorted;
    if (categoryId === 'NONE') return sorted.filter((m) => !m.categoryId);
    return sorted.filter((m) => m.categoryId === categoryId);
  }, [menus, categories, categoryId]);

  const hasUncategorized = useMemo(() => (menus ?? []).some((m) => !m.categoryId), [menus]);

  const changeStatus = async (menu: Menu, status: SaleStatus) => {
    setStatusSheet(null);
    const res = await setMenuSaleStatus(menu.id, status);
    if (isOk(res)) {
      setMenus((prev) => (prev ?? []).map((m) => (m.id === menu.id ? { ...m, saleStatus: status } : m)));
      Toast.show({ type: 'success', text1: `${menu.name} · ${SALE_STATUS[status].label}로 바꿨어요` });
    } else Toast.show({ type: 'error', text1: res.resultMsg });
  };

  const remove = async (menu: Menu) => {
    setStatusSheet(null);
    const yes = await confirm({ title: '메뉴 삭제', message1: `'${menu.name}' 메뉴를 삭제할까요?`, message2: '지난 주문 내역에는 메뉴 이름이 그대로 남습니다.', confirmText: '삭제', cancelText: '취소' });
    if (!yes) return;
    const res = await deleteMenu(menu.id);
    if (isOk(res)) {
      setMenus((prev) => (prev ?? []).filter((m) => m.id !== menu.id));
      Toast.show({ type: 'success', text1: '메뉴를 삭제했어요' });
    } else Toast.show({ type: 'error', text1: res.resultMsg });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 카테고리 칩 */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: 'ALL', name: '전체' }, ...categories, ...(hasUncategorized ? [{ id: 'NONE', name: '미분류' }] : [])].map((c) => (
            <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.chip, categoryId === c.id && styles.chipActive]}>
              <Typography mode="subtitle4" color={categoryId === c.id ? 'white' : 'gray700'}>
                {c.name}
              </Typography>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => nav.navigate('CategoryManage')} style={styles.chipManage} hitSlop={6}>
          <MaterialCommunityIcons name="tune" size={18} color={theme.colors.gray600} />
        </Pressable>
      </View>

      {menus === null ? (
        <View style={{ padding: 16 }}>
          <SkeletonList rows={5} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable style={styles.menuRow} onPress={() => nav.navigate('MenuEdit', { menuId: item.id })}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <MaterialCommunityIcons name="image-outline" size={22} color={theme.colors.gray300} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Typography mode="subtitle2" color={item.saleStatus === 'HIDDEN' ? 'gray400' : 'gray900'} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {item.name}
                  </Typography>
                  {item.adultOnly && <Badge label="19" tone="red" />}
                </View>
                <Typography mode="caption1" color="gray500" numberOfLines={1}>
                  {[item.categoryName ?? '미분류', item.standard].filter(Boolean).join(' · ')}
                  {item.optionGroupIds.length ? ` · 옵션 ${item.optionGroupIds.length}그룹` : ''}
                </Typography>
                <Typography mode="subtitle3" color="gray900">
                  {won(item.price)}
                </Typography>
              </View>
              <Pressable onPress={() => setStatusSheet(item)} hitSlop={8} style={styles.statusBtn}>
                <Badge label={SALE_STATUS[item.saleStatus].label} tone={SALE_STATUS[item.saleStatus].tone} size="medium" />
                <MaterialCommunityIcons name="chevron-down" size={16} color={theme.colors.gray500} />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="food-off" size={40} color={theme.colors.gray300} />
              <Typography mode="body1" color="gray500">
                등록된 메뉴가 없어요
              </Typography>
            </View>
          }
        />
      )}

      <View style={styles.fabWrap}>
        <PrimaryButton label="+ 메뉴 등록" onPress={() => nav.navigate('MenuEdit')} size="md" style={styles.fab} />
      </View>

      {/* 판매 상태 변경 */}
      <BottomSheet
        visible={!!statusSheet}
        setVisible={(v) => !v && setStatusSheet(null)}
        title={statusSheet?.name ?? ''}
        content={
          statusSheet && (
            <View style={{ gap: 8 }}>
              {(Object.keys(SALE_STATUS) as SaleStatus[]).map((s) => (
                <Pressable key={s} onPress={() => changeStatus(statusSheet, s)} style={[styles.choice, statusSheet.saleStatus === s && styles.choiceActive]}>
                  <Badge label={SALE_STATUS[s].label} tone={SALE_STATUS[s].tone} size="medium" />
                  <Typography mode="body2" color="gray600" style={{ flex: 1 }}>
                    {s === 'ON_SALE' ? '고객 앱에 보이고 주문할 수 있어요' : s === 'SOLD_OUT' ? '보이지만 주문은 막혀요 (오늘만 품절 등)' : '고객 앱에서 아예 보이지 않아요'}
                  </Typography>
                  {statusSheet.saleStatus === s && <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />}
                </Pressable>
              ))}
              <Pressable onPress={() => remove(statusSheet)} style={[styles.choice, { marginTop: 8 }]}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.red500} />
                <Typography mode="body2" color="red600">
                  메뉴 삭제
                </Typography>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
};

/* ── 옵션 탭 ──────────────────────────────────────────────────── */
const OptionGroupList: React.FC<{ nav: Nav }> = ({ nav }) => {
  const { confirm } = useDialog();
  const [groups, setGroups] = useState<OptionGroup[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      getOptionGroups().then((res) => setGroups(isOk(res) && res.groups ? res.groups : []));
    }, []),
  );

  const remove = async (g: OptionGroup) => {
    const yes = await confirm({
      title: '옵션 그룹 삭제',
      message1: `'${g.name}' 그룹을 삭제할까요?`,
      message2: g.menuCount ? `연결된 메뉴 ${g.menuCount}개에서 이 옵션이 사라집니다.` : undefined,
      confirmText: '삭제',
      cancelText: '취소',
    });
    if (!yes) return;
    const res = await deleteOptionGroup(g.id);
    if (isOk(res)) {
      setGroups((prev) => (prev ?? []).filter((x) => x.id !== g.id));
      Toast.show({ type: 'success', text1: '옵션 그룹을 삭제했어요' });
    } else Toast.show({ type: 'error', text1: res.resultMsg });
  };

  return (
    <View style={{ flex: 1 }}>
      {groups === null ? (
        <View style={{ padding: 16 }}>
          <SkeletonList rows={4} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable style={styles.groupRow} onPress={() => nav.navigate('OptionGroupEdit', { groupId: item.id })} onLongPress={() => remove(item)}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Typography mode="subtitle2" color="gray900">
                    {item.name}
                  </Typography>
                  <Badge label={item.required ? '필수' : '선택'} tone={item.required ? 'orange' : 'gray'} />
                </View>
                <Typography mode="caption1" color="gray500">
                  {item.required ? `${item.minSelect}~${item.maxSelect}개 선택` : `최대 ${item.maxSelect}개`} · 연결 메뉴 {item.menuCount}개
                </Typography>
                <Typography mode="body2" color="gray600" numberOfLines={2}>
                  {item.options.map((o) => `${o.name}${o.price ? ` +${won(o.price)}` : ''}${o.soldOut ? '(품절)' : ''}`).join(', ')}
                </Typography>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.gray400} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="format-list-checks" size={40} color={theme.colors.gray300} />
              <Typography mode="body1" color="gray500">
                등록된 옵션 그룹이 없어요
              </Typography>
            </View>
          }
          ListFooterComponent={
            groups.length ? (
              <Typography mode="caption1" color="gray400" style={{ textAlign: 'center', paddingVertical: 16 }}>
                길게 누르면 삭제할 수 있어요
              </Typography>
            ) : null
          }
        />
      )}
      <View style={styles.fabWrap}>
        <PrimaryButton label="+ 옵션 그룹 등록" onPress={() => nav.navigate('OptionGroupEdit')} size="md" style={styles.fab} />
      </View>
    </View>
  );
};

/** 메뉴 관리: 메뉴 탭 / 옵션 탭 */
const MenusScreen = () => {
  const nav = useNavigation<Nav>();
  const [tab, setTab] = useState<1 | 2>(1);

  return (
    <ScreenWrapper backgroundColor="white" inTab>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TabBar active={tab} label1="메뉴" label2="옵션 그룹" onPress1={() => setTab(1)} onPress2={() => setTab(2)} />
      </View>
      {tab === 1 ? <MenuList nav={nav} /> : <OptionGroupList nav={nav} />}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  chipBar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 12, height: 32, borderRadius: theme.radius.pill, backgroundColor: theme.colors.gray100, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: theme.colors.gray900 },
  chipManage: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: theme.colors.line },
  list: { paddingBottom: 90, flexGrow: 1 },
  sep: { height: 1, backgroundColor: theme.colors.gray100, marginLeft: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  thumb: { width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: theme.colors.gray100 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 80 },
  fabWrap: { position: 'absolute', right: 16, bottom: 16 },
  fab: { boxShadow: theme.shadow.primary, borderRadius: theme.radius.pill },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line },
  choiceActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.orange50 },
});

export default MenusScreen;
