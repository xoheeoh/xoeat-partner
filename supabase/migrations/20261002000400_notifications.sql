-- =====================================================================
-- 사장님 알림함 (notifications)
--
-- "나에게 일어난 일"을 가게별로 쌓는다. 운영사의 공통 안내인 공지(notices)와는 다른 것.
-- 앱이 직접 쓰지 않고 서버 트리거가 만든다:
--   · 새 주문이 들어오면           → NEW_ORDER      (orders INSERT)
--   · 고객이 접수대기 주문을 취소하면 → ORDER_CANCELED (orders UPDATE, 호출자가 구매자일 때만)
--   · 공지가 등록되면              → NOTICE         (notices INSERT, 모든 가게에 한 건씩)
-- 읽음 처리는 mark_notifications_read() RPC 로만 한다. Realtime 에 올려 홈의 종 뱃지가 바로 바뀐다.
-- =====================================================================

create table public.notifications (
  id         bigint generated always as identity primary key,
  store_id   uuid not null references public.stores(id) on delete cascade,
  kind       text not null check (kind in ('NEW_ORDER', 'ORDER_CANCELED', 'NOTICE')),
  title      text not null,
  body       text not null default '',
  order_id   uuid references public.orders(id) on delete set null,     -- 누르면 갈 주문
  notice_id  bigint references public.notices(id) on delete cascade,   -- 누르면 갈 공지
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_store_created_idx on public.notifications(store_id, created_at desc);
create index notifications_store_unread_idx  on public.notifications(store_id) where read_at is null;

-- ── RLS: 내 가게 알림만 읽는다. 쓰기는 트리거(security definer)와 RPC 만 ──
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated using (store_id = public.my_store_id());

-- ── 트리거: 새 주문 ───────────────────────────────────────────────────
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (store_id, kind, title, body, order_id)
  values (
    new.store_id,
    'NEW_ORDER',
    '새 주문이 들어왔어요',
    format('%s · %s원 · %s',
           case new.order_type when 'DELIVERY' then '배달' else '포장' end,
           to_char(new.total_amount, 'FM999,999,999'),
           new.customer_name),
    new.id
  );
  return new;
end $$;

create trigger orders_notify_new after insert on public.orders
  for each row execute function public.notify_new_order();

-- ── 트리거: 고객 취소 ─────────────────────────────────────────────────
-- 사장님이 직접 취소한 건 본인이 한 일이라 알리지 않는다. 호출자가 구매자(is_customer)일 때만 만든다.
create or replace function public.notify_order_canceled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'CANCELED' and old.status <> 'CANCELED' and public.is_customer() then
    insert into public.notifications (store_id, kind, title, body, order_id)
    values (
      new.store_id,
      'ORDER_CANCELED',
      '고객이 주문을 취소했어요',
      format('%s · %s원 · %s',
             case new.order_type when 'DELIVERY' then '배달' else '포장' end,
             to_char(new.total_amount, 'FM999,999,999'),
             new.customer_name),
      new.id
    );
  end if;
  return new;
end $$;

create trigger orders_notify_canceled after update of status on public.orders
  for each row execute function public.notify_order_canceled();

-- ── 트리거: 새 공지 → 모든 가게 ──────────────────────────────────────
create or replace function public.notify_new_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (store_id, kind, title, body, notice_id)
  select s.id, 'NOTICE', '새 공지사항이 등록됐어요', new.title, new.id
    from public.stores s;
  return new;
end $$;

create trigger notices_notify_new after insert on public.notices
  for each row execute function public.notify_new_notice();

-- ── 읽음 처리 ────────────────────────────────────────────────────────
-- p_ids 가 null 이면 내 가게의 안 읽은 알림 전부. 처리한 건수를 돌려준다.
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.my_store_id();
  v_count integer;
begin
  if v_store is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  update public.notifications
     set read_at = now()
   where store_id = v_store
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────
-- postgres_changes 는 RLS 를 지키므로 앱은 필터 없이 구독해도 내 가게 알림만 받는다.
alter publication supabase_realtime add table public.notifications;
