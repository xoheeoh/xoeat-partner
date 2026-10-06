/**
 * 주문 어댑터. 조회는 PostgREST, 상태 변경은 RPC.
 */
import { dayEndIso, dayStartIso, run, supabase, toYmd, unwrap } from './client';
import type { Order, OrderItem, OrderStatus, OrderTab, OrderType } from '@typ/domain';

/* ── 행 변환 ───────────────────────────────────────────────────── */
type ItemRow = {
  id: string;
  menu_name: string;
  quantity: number;
  unit_price: number;
  options: OrderItem['options'];
  line_amount: number;
};
export type OrderRow = {
  id: string;
  order_no: string;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  address_detail: string | null;
  request_memo: string;
  items_amount: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: string;
  cooking_minutes: number | null;
  reject_reason: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  delivering_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  created_at: string;
  order_items?: ItemRow[];
};

const ORDER_SELECT = '*, order_items(id, menu_name, quantity, unit_price, options, line_amount)';

export const toOrder = (r: OrderRow): Order => ({
  id: r.id,
  orderNo: r.order_no,
  orderType: r.order_type,
  status: r.status,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  address: r.address,
  addressDetail: r.address_detail,
  requestMemo: r.request_memo,
  itemsAmount: r.items_amount,
  deliveryFee: r.delivery_fee,
  totalAmount: r.total_amount,
  paymentMethod: r.payment_method,
  cookingMinutes: r.cooking_minutes,
  rejectReason: r.reject_reason,
  acceptedAt: r.accepted_at,
  readyAt: r.ready_at,
  deliveringAt: r.delivering_at,
  completedAt: r.completed_at,
  canceledAt: r.canceled_at,
  createdAt: r.created_at,
  items: (r.order_items ?? []).map((i) => ({
    id: i.id,
    menuName: i.menu_name,
    quantity: i.quantity,
    unitPrice: i.unit_price,
    options: i.options ?? [],
    lineAmount: i.line_amount,
  })),
});

/** 탭 → 상태 집합 */
export const TAB_STATUSES: Record<OrderTab, OrderStatus[]> = {
  PENDING: ['PENDING'],
  ING: ['ACCEPTED', 'READY', 'DELIVERING'],
  COMPLETED: ['COMPLETED'],
  CLOSED: ['REJECTED', 'CANCELED'],
};

export const tabOf = (status: OrderStatus): OrderTab =>
  (Object.keys(TAB_STATUSES) as OrderTab[]).find((t) => TAB_STATUSES[t].includes(status)) ?? 'CLOSED';

/* ── 조회 ──────────────────────────────────────────────────────── */
/** 오늘 주문 (탭별). 접수대기는 오래된 순, 나머지는 최신순 */
export const getTodayOrders = (tab: OrderTab) =>
  run(async () => {
    const today = toYmd(new Date());
    const rows = unwrap(
      await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .in('status', TAB_STATUSES[tab])
        .gte('created_at', dayStartIso(today))
        .lte('created_at', dayEndIso(today))
        .order('created_at', { ascending: tab === 'PENDING' }),
    ) as unknown as OrderRow[];
    return { orders: rows.map(toOrder) };
  });

/** 오늘 상태별 건수 */
export const getTodayCounts = () =>
  run(async () => {
    const rows = unwrap(await supabase.rpc('order_counts')) as { status: OrderStatus; cnt: number }[];
    const counts: Record<OrderTab, number> = { PENDING: 0, ING: 0, COMPLETED: 0, CLOSED: 0 };
    rows.forEach((r) => {
      counts[tabOf(r.status)] += Number(r.cnt);
    });
    return { counts };
  });

export const getOrder = (orderId: string) =>
  run(async () => {
    const row = unwrap(await supabase.from('orders').select(ORDER_SELECT).eq('id', orderId).single()) as unknown as OrderRow;
    return { order: toOrder(row) };
  });

/** 기간·상태로 지난 주문 조회 (최신순, 최대 200건) */
export const getOrderHistory = (fromYmd: string, toYmdStr: string, statuses?: OrderStatus[]) =>
  run(async () => {
    let q = supabase.from('orders').select(ORDER_SELECT).gte('created_at', dayStartIso(fromYmd)).lte('created_at', dayEndIso(toYmdStr));
    if (statuses?.length) q = q.in('status', statuses);
    const rows = unwrap(await q.order('created_at', { ascending: false }).limit(200)) as unknown as OrderRow[];
    return { orders: rows.map(toOrder) };
  });

/* ── 상태 변경 (RPC) ───────────────────────────────────────────── */
const rpcOrder = (fn: string, args: Record<string, unknown>) =>
  run(async () => {
    const row = unwrap(await supabase.rpc(fn, args).single()) as unknown as OrderRow;
    // RPC 는 항목을 돌려주지 않으므로 다시 읽는다
    const full = unwrap(await supabase.from('orders').select(ORDER_SELECT).eq('id', row.id).single()) as unknown as OrderRow;
    return { order: toOrder(full) };
  });

/** 수락. 배달 주문이면 cookingMinutes 가 있어야 한다 */
export const acceptOrder = (orderId: string, opts: { cookingMinutes?: number } = {}) =>
  rpcOrder('accept_order', {
    p_order_id: orderId,
    p_cooking_minutes: opts.cookingMinutes ?? null,
  });

export const rejectOrder = (orderId: string, reason: string) => rpcOrder('reject_order', { p_order_id: orderId, p_reason: reason });
export const cancelOrder = (orderId: string, reason: string) => rpcOrder('cancel_order', { p_order_id: orderId, p_reason: reason });
/** 다음 단계로 (포장: 준비완료→픽업완료 / 배달: 배달시작→배달완료) */
export const advanceOrder = (orderId: string) => rpcOrder('advance_order', { p_order_id: orderId });

/* ── 데모 ──────────────────────────────────────────────────────── */
/** 고객 앱 대신 가짜 주문을 1건 넣는다 ("데모 주문 받기") */
export const createDemoOrder = (type?: OrderType) => rpcOrder('demo_create_order', { p_type: type ?? null });

/* ── Realtime ──────────────────────────────────────────────────── */
/**
 * 내 가게 주문 변경 구독. INSERT(새 주문)·UPDATE(상태 변경)를 알려 준다.
 * RLS 가 적용되므로 필터 없이 구독해도 내 가게 행만 온다.
 */
export const subscribeOrders = (onChange: (e: { type: 'INSERT' | 'UPDATE'; order: Order }) => void) => {
  const channel = supabase
    .channel('orders-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      onChange({ type: 'INSERT', order: toOrder(payload.new as OrderRow) });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
      onChange({ type: 'UPDATE', order: toOrder(payload.new as OrderRow) });
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};
