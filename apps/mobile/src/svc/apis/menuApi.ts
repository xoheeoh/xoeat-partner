/**
 * 메뉴 · 카테고리 · 옵션 그룹 · 이미지 어댑터
 */
import { Platform } from 'react-native';
import { run, supabase, unwrap } from './client';
import type { Menu, MenuCategory, MenuInput, Option, OptionGroup, OptionGroupInput, SaleStatus } from '@typ/domain';

/* ── 카테고리 ──────────────────────────────────────────────────── */
type CategoryRow = { id: string; name: string; sort_order: number };

export const getCategories = () =>
  run(async () => {
    const rows = unwrap(await supabase.from('menu_categories').select('id, name, sort_order').order('sort_order')) as CategoryRow[];
    const categories: MenuCategory[] = rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order }));
    return { categories };
  });

/**
 * 카테고리 일괄 저장: 순서는 배열 순서대로, id 가 없으면 새로 만들고, removedIds 는 지운다.
 * (지워진 카테고리의 메뉴는 "카테고리 없음"이 된다. 서버 FK on delete set null)
 */
export const saveCategories = (storeId: string, items: Array<{ id?: string; name: string }>, removedIds: string[]) =>
  run(async () => {
    if (removedIds.length) unwrap(await supabase.from('menu_categories').delete().in('id', removedIds));
    const existing = items.filter((c) => c.id).map((c, i) => ({ id: c.id!, store_id: storeId, name: c.name, sort_order: items.indexOf(c) }));
    const created = items.filter((c) => !c.id).map((c) => ({ store_id: storeId, name: c.name, sort_order: items.indexOf(c) }));
    if (existing.length) unwrap(await supabase.from('menu_categories').upsert(existing));
    if (created.length) unwrap(await supabase.from('menu_categories').insert(created));
    return {};
  });

/* ── 메뉴 ──────────────────────────────────────────────────────── */
type MenuRow = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  standard: string;
  price: number;
  image_url: string | null;
  sale_status: SaleStatus;
  adult_only: boolean;
  sort_order: number;
  updated_at: string;
  menu_categories: { name: string } | null;
  menu_option_groups: { group_id: string }[];
};

const MENU_SELECT = 'id, category_id, name, description, standard, price, image_url, sale_status, adult_only, sort_order, updated_at, menu_categories(name), menu_option_groups(group_id)';

const toMenu = (r: MenuRow): Menu => ({
  id: r.id,
  categoryId: r.category_id,
  categoryName: r.menu_categories?.name ?? null,
  name: r.name,
  description: r.description,
  standard: r.standard,
  price: r.price,
  imageUrl: r.image_url,
  saleStatus: r.sale_status,
  adultOnly: r.adult_only,
  sortOrder: r.sort_order,
  optionGroupIds: (r.menu_option_groups ?? []).map((g) => g.group_id),
  updatedAt: r.updated_at,
});

export const getMenus = () =>
  run(async () => {
    const rows = unwrap(await supabase.from('menus').select(MENU_SELECT).order('sort_order').order('created_at')) as unknown as MenuRow[];
    return { menus: rows.map(toMenu) };
  });

export const getMenu = (menuId: string) =>
  run(async () => {
    const row = unwrap(await supabase.from('menus').select(MENU_SELECT).eq('id', menuId).single()) as unknown as MenuRow;
    return { menu: toMenu(row) };
  });

const menuPayload = (storeId: string, input: MenuInput) => ({
  store_id: storeId,
  category_id: input.categoryId,
  name: input.name.trim(),
  description: input.description.trim(),
  standard: input.standard.trim(),
  price: input.price,
  image_url: input.imageUrl,
  sale_status: input.saleStatus,
  adult_only: input.adultOnly,
});

const syncMenuGroups = async (menuId: string, groupIds: string[]) => {
  unwrap(await supabase.from('menu_option_groups').delete().eq('menu_id', menuId));
  if (groupIds.length) {
    unwrap(await supabase.from('menu_option_groups').insert(groupIds.map((group_id, i) => ({ menu_id: menuId, group_id, sort_order: i }))));
  }
};

export const createMenu = (storeId: string, input: MenuInput) =>
  run(async () => {
    // 새 메뉴는 목록 맨 뒤에
    const last = unwrap(await supabase.from('menus').select('sort_order').order('sort_order', { ascending: false }).limit(1)) as { sort_order: number }[];
    const row = unwrap(
      await supabase
        .from('menus')
        .insert({ ...menuPayload(storeId, input), sort_order: (last[0]?.sort_order ?? -1) + 1 })
        .select('id')
        .single<{ id: string }>(),
    );
    await syncMenuGroups(row.id, input.optionGroupIds);
    return { menuId: row.id };
  });

export const updateMenu = (storeId: string, menuId: string, input: MenuInput) =>
  run(async () => {
    unwrap(await supabase.from('menus').update(menuPayload(storeId, input)).eq('id', menuId));
    await syncMenuGroups(menuId, input.optionGroupIds);
    return { menuId };
  });

export const setMenuSaleStatus = (menuId: string, saleStatus: SaleStatus) =>
  run(async () => {
    unwrap(await supabase.from('menus').update({ sale_status: saleStatus }).eq('id', menuId));
    return {};
  });

export const deleteMenu = (menuId: string) =>
  run(async () => {
    unwrap(await supabase.from('menus').delete().eq('id', menuId));
    return {};
  });

/** 메뉴 순서 저장 (id 배열 순서대로) */
export const reorderMenus = (storeId: string, menuIds: string[]) =>
  run(async () => {
    // upsert 는 not null 컬럼이 모두 필요하므로 한 건씩 update 한다 (메뉴 수가 많지 않다)
    await Promise.all(menuIds.map((id, i) => supabase.from('menus').update({ sort_order: i }).eq('id', id).eq('store_id', storeId)));
    return {};
  });

/* ── 옵션 그룹 ─────────────────────────────────────────────────── */
type OptionRow = { id: string; name: string; price: number; sold_out: boolean; sort_order: number };
type GroupRow = {
  id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
  options: OptionRow[];
  menu_option_groups: { menu_id: string }[];
};

const GROUP_SELECT = 'id, name, required, min_select, max_select, sort_order, options(id, name, price, sold_out, sort_order), menu_option_groups(menu_id)';

const toGroup = (r: GroupRow): OptionGroup & { menuIds: string[] } => ({
  id: r.id,
  name: r.name,
  required: r.required,
  minSelect: r.min_select,
  maxSelect: r.max_select,
  sortOrder: r.sort_order,
  options: [...(r.options ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map<Option>((o) => ({ id: o.id, name: o.name, price: o.price, soldOut: o.sold_out, sortOrder: o.sort_order })),
  menuCount: (r.menu_option_groups ?? []).length,
  menuIds: (r.menu_option_groups ?? []).map((m) => m.menu_id),
});

export const getOptionGroups = () =>
  run(async () => {
    const rows = unwrap(await supabase.from('option_groups').select(GROUP_SELECT).order('sort_order').order('created_at')) as unknown as GroupRow[];
    return { groups: rows.map(toGroup) };
  });

export const getOptionGroup = (groupId: string) =>
  run(async () => {
    const row = unwrap(await supabase.from('option_groups').select(GROUP_SELECT).eq('id', groupId).single()) as unknown as GroupRow;
    return { group: toGroup(row) };
  });

const syncOptions = async (groupId: string, options: OptionGroupInput['options']) => {
  const keepIds = options.filter((o) => o.id).map((o) => o.id!);
  // 화면에서 지운 옵션 삭제
  const q = supabase.from('options').delete().eq('group_id', groupId);
  unwrap(await (keepIds.length ? q.not('id', 'in', `(${keepIds.join(',')})`) : q));
  const existing = options.filter((o) => o.id).map((o) => ({ id: o.id!, group_id: groupId, name: o.name.trim(), price: o.price, sold_out: o.soldOut, sort_order: options.indexOf(o) }));
  const created = options.filter((o) => !o.id).map((o) => ({ group_id: groupId, name: o.name.trim(), price: o.price, sold_out: o.soldOut, sort_order: options.indexOf(o) }));
  if (existing.length) unwrap(await supabase.from('options').upsert(existing));
  if (created.length) unwrap(await supabase.from('options').insert(created));
};

const syncGroupMenus = async (groupId: string, menuIds: string[]) => {
  unwrap(await supabase.from('menu_option_groups').delete().eq('group_id', groupId));
  if (menuIds.length) {
    unwrap(await supabase.from('menu_option_groups').insert(menuIds.map((menu_id) => ({ menu_id, group_id: groupId, sort_order: 99 }))));
  }
};

export const createOptionGroup = (storeId: string, input: OptionGroupInput) =>
  run(async () => {
    const row = unwrap(
      await supabase
        .from('option_groups')
        .insert({ store_id: storeId, name: input.name.trim(), required: input.required, min_select: input.minSelect, max_select: input.maxSelect })
        .select('id')
        .single<{ id: string }>(),
    );
    await syncOptions(row.id, input.options);
    await syncGroupMenus(row.id, input.menuIds);
    return { groupId: row.id };
  });

export const updateOptionGroup = (groupId: string, input: OptionGroupInput) =>
  run(async () => {
    unwrap(
      await supabase
        .from('option_groups')
        .update({ name: input.name.trim(), required: input.required, min_select: input.minSelect, max_select: input.maxSelect })
        .eq('id', groupId),
    );
    await syncOptions(groupId, input.options);
    await syncGroupMenus(groupId, input.menuIds);
    return { groupId };
  });

export const deleteOptionGroup = (groupId: string) =>
  run(async () => {
    unwrap(await supabase.from('option_groups').delete().eq('id', groupId));
    return {};
  });

export const setOptionSoldOut = (optionId: string, soldOut: boolean) =>
  run(async () => {
    unwrap(await supabase.from('options').update({ sold_out: soldOut }).eq('id', optionId));
    return {};
  });

/* ── 이미지 ────────────────────────────────────────────────────── */
/**
 * 메뉴 이미지 업로드. 경로는 `${storeId}/${timestamp}.jpg` (Storage 정책이 내 가게 폴더만 허용한다).
 * expo-image-picker 가 준 로컬 URI 를 fetch 해 Blob 으로 올린다 (웹·네이티브 공통).
 */
export const uploadMenuImage = (storeId: string, localUri: string, mimeType = 'image/jpeg') =>
  run(async () => {
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${storeId}/${Date.now()}.${ext}`;
    const res = await fetch(localUri);
    const body = Platform.OS === 'web' ? await res.blob() : await res.arrayBuffer();
    unwrap(await supabase.storage.from('menu-images').upload(path, body, { contentType: mimeType, upsert: false }));
    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
    return { imageUrl: data.publicUrl };
  });
