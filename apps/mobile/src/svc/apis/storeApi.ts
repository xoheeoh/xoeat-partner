/**
 * 가게 · 인증 · 대시보드 · 정산 · 공지 어댑터
 */
import { emailFor, run, supabase, unwrap } from './client';
import type { DashboardSummary, Notice, Settlement, Store, StoreEditable, StoreHour, StoreStatus } from '@typ/domain';

/* ── 행 변환 ───────────────────────────────────────────────────── */
type StoreRow = {
  id: string;
  login_id: string;
  name: string;
  category_cd: string;
  intro: string;
  origin_info: string;
  phone: string;
  address: string;
  biz_no: string;
  rep_name: string;
  image_url: string | null;
  min_order_amount: number;
  delivery_fee: number;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  status: StoreStatus;
  bank_name: string;
  account_no: string;
  account_holder: string;
  fee_rate: number | string;
};

const toStore = (r: StoreRow): Store => ({
  id: r.id,
  loginId: r.login_id,
  name: r.name,
  categoryCd: r.category_cd,
  intro: r.intro,
  originInfo: r.origin_info,
  phone: r.phone,
  address: r.address,
  bizNo: r.biz_no,
  repName: r.rep_name,
  imageUrl: r.image_url,
  minOrderAmount: r.min_order_amount,
  deliveryFee: r.delivery_fee,
  deliveryEnabled: r.delivery_enabled,
  pickupEnabled: r.pickup_enabled,
  status: r.status,
  bankName: r.bank_name,
  accountNo: r.account_no,
  accountHolder: r.account_holder,
  feeRate: Number(r.fee_rate),
});

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/* ── 인증 ──────────────────────────────────────────────────────── */
export const login = (loginId: string, password: string) =>
  run(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailFor(loginId), password });
    if (error) {
      const e = new Error(error.message) as Error & { code?: string };
      e.code = error.code ?? error.message;
      throw e;
    }
    return {};
  });

export const logout = () =>
  run(async () => {
    await supabase.auth.signOut();
    return {};
  });

/* ── 가게 ──────────────────────────────────────────────────────── */
export const getMyStore = () =>
  run(async () => {
    const row = unwrap(await supabase.from('stores').select('*').single<StoreRow>());
    return { store: toStore(row) };
  });

export const updateStore = (patch: Partial<StoreEditable>) =>
  run(async () => {
    // 서버(PostgREST)는 조건 없는 UPDATE 를 거부한다("UPDATE requires a WHERE clause").
    // RLS 가 내 가게만 허용하더라도 조건은 명시해야 하므로 로그인한 사장님(owner_id)으로 좁힌다.
    const ownerId = (await supabase.auth.getSession()).data.session?.user.id;
    if (!ownerId) throw Object.assign(new Error('UNAUTHENTICATED'), { code: 'UNAUTHENTICATED' });
    const row = unwrap(
      await supabase
        .from('stores')
        .update({
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.categoryCd !== undefined && { category_cd: patch.categoryCd }),
          ...(patch.intro !== undefined && { intro: patch.intro }),
          ...(patch.originInfo !== undefined && { origin_info: patch.originInfo }),
          ...(patch.phone !== undefined && { phone: patch.phone }),
          ...(patch.imageUrl !== undefined && { image_url: patch.imageUrl }),
          ...(patch.minOrderAmount !== undefined && { min_order_amount: patch.minOrderAmount }),
          ...(patch.deliveryFee !== undefined && { delivery_fee: patch.deliveryFee }),
          ...(patch.deliveryEnabled !== undefined && { delivery_enabled: patch.deliveryEnabled }),
          ...(patch.pickupEnabled !== undefined && { pickup_enabled: patch.pickupEnabled }),
        })
        .eq('owner_id', ownerId)
        .select('*')
        .single<StoreRow>(),
    );
    return { store: toStore(row) };
  });

export const setStoreStatus = (status: StoreStatus) =>
  run(async () => {
    const row = unwrap(await supabase.rpc('set_store_status', { p_status: status }).single<StoreRow>());
    return { store: toStore(row) };
  });

/* ── 영업시간 ──────────────────────────────────────────────────── */
type HourRow = {
  day_of_week: number;
  enabled: boolean;
  open_time: string;
  close_time: string;
  break_from: string | null;
  break_to: string | null;
};

export const getStoreHours = () =>
  run(async () => {
    const rows = unwrap(await supabase.from('store_hours').select('*').order('day_of_week')) as HourRow[];
    const hours: StoreHour[] = rows.map((r) => ({
      dayOfWeek: r.day_of_week,
      enabled: r.enabled,
      openTime: hhmm(r.open_time) ?? '10:00',
      closeTime: hhmm(r.close_time) ?? '22:00',
      breakFrom: hhmm(r.break_from),
      breakTo: hhmm(r.break_to),
    }));
    return { hours };
  });

export const saveStoreHours = (storeId: string, hours: StoreHour[]) =>
  run(async () => {
    unwrap(
      await supabase.from('store_hours').upsert(
        hours.map((h) => ({
          store_id: storeId,
          day_of_week: h.dayOfWeek,
          enabled: h.enabled,
          open_time: h.openTime,
          close_time: h.closeTime,
          break_from: h.breakFrom,
          break_to: h.breakTo,
        })),
        { onConflict: 'store_id,day_of_week' },
      ),
    );
    return {};
  });

/* ── 대시보드 ──────────────────────────────────────────────────── */
export const getDashboard = () =>
  run(async () => {
    const summary = unwrap(await supabase.rpc('dashboard_summary')) as DashboardSummary;
    return { summary };
  });

/* ── 정산 ──────────────────────────────────────────────────────── */
type SettlementRow = {
  settle_date: string;
  order_count: number;
  sales_amount: number;
  fee: number;
  vat: number;
  payout_amount: number;
  payout_date: string;
  status: 'SCHEDULED' | 'PAID';
};

/** 해당 월(yyyy-MM)의 일별 정산 */
export const getSettlements = (month: string) =>
  run(async () => {
    const [y, m] = month.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const next = new Date(y, m, 1); // 다음 달 1일
    const to = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
    const rows = unwrap(
      await supabase
        .from('settlements')
        .select('*')
        .gte('settle_date', from)
        .lt('settle_date', to)
        .order('settle_date', { ascending: false }),
    ) as SettlementRow[];
    const settlements: Settlement[] = rows.map((r) => ({
      settleDate: r.settle_date,
      orderCount: r.order_count,
      salesAmount: r.sales_amount,
      fee: r.fee,
      vat: r.vat,
      payoutAmount: r.payout_amount,
      payoutDate: r.payout_date,
      status: r.status,
    }));
    return { settlements };
  });

/* ── 공지 ──────────────────────────────────────────────────────── */
export const getNotices = () =>
  run(async () => {
    const rows = unwrap(await supabase.from('notices').select('*').order('created_at', { ascending: false })) as {
      id: number;
      kind: Notice['kind'];
      title: string;
      body: string;
      created_at: string;
    }[];
    const notices: Notice[] = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      createdAt: r.created_at,
    }));
    return { notices };
  });
