-- =====================================================================
-- Xoeat Partner Demo — 도메인 함수 (주문 상태 전이 · 영업 상태 · 대시보드 · 정산)
--
-- 주문 상태 전이
--   PENDING ──accept──▶ ACCEPTED ──(포장) ready──▶ READY ──complete──▶ COMPLETED
--      │                   │
--      │                   └──(배달) start_delivery──▶ DELIVERING ──complete──▶ COMPLETED
--      │                   └──cancel──▶ CANCELED
--      └──reject──▶ REJECTED
--
-- 실패는 오류 코드 문자열(ORDER_NOT_FOUND, INVALID_TRANSITION …)로 raise 한다.
-- 앱의 svc/apis/client.ts 가 코드를 화면 문구로 바꾼다.
-- =====================================================================

-- ── 공통: 내 가게의 주문을 잠그고 가져온다 ──────────────────────────
create or replace function public._lock_my_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders;
begin
  select * into v from public.orders
   where id = p_order_id and store_id = public.my_store_id()
   for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v;
end $$;
revoke all on function public._lock_my_order(uuid) from public, anon, authenticated;

-- ── 주문 수락 ────────────────────────────────────────────────────────
-- p_cooking_minutes: 배달 주문의 예상 조리시간(분). 포장 주문은 null.
-- p_self_delivery : true 면 배달 호출 없이 가게가 직접 배달한다 (stores.self_delivery 가 켜진 가게만).
create or replace function public.accept_order(
  p_order_id        uuid,
  p_cooking_minutes integer default null,
  p_self_delivery   boolean default false
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders;
  s public.stores;
begin
  v := public._lock_my_order(p_order_id);
  if v.status <> 'PENDING' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  select * into s from public.stores where id = v.store_id;
  if p_self_delivery and not s.self_delivery then
    raise exception 'SELF_DELIVERY_NOT_ENABLED' using errcode = 'P0001';
  end if;
  if v.order_type = 'DELIVERY' and not p_self_delivery and p_cooking_minutes is null then
    raise exception 'COOKING_MINUTES_REQUIRED' using errcode = 'P0001';
  end if;

  update public.orders
     set status = 'ACCEPTED',
         cooking_minutes = case when p_self_delivery then null else p_cooking_minutes end,
         self_delivery = p_self_delivery,
         accepted_at = now()
   where id = p_order_id
  returning * into v;
  return v;
end $$;

-- ── 주문 거절 (접수대기 → 거절) ──────────────────────────────────────
create or replace function public.reject_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  v := public._lock_my_order(p_order_id);
  if v.status <> 'PENDING' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  update public.orders
     set status = 'REJECTED', reject_reason = trim(p_reason), canceled_at = now()
   where id = p_order_id
  returning * into v;
  return v;
end $$;

-- ── 주문 취소 (수락 이후 → 취소) ─────────────────────────────────────
create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  v := public._lock_my_order(p_order_id);
  if v.status not in ('ACCEPTED', 'READY') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  update public.orders
     set status = 'CANCELED', reject_reason = trim(p_reason), canceled_at = now()
   where id = p_order_id
  returning * into v;
  return v;
end $$;

-- ── 다음 단계로 진행 ─────────────────────────────────────────────────
-- 포장: ACCEPTED → READY → COMPLETED
-- 배달: ACCEPTED → DELIVERING → COMPLETED
create or replace function public.advance_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.orders;
  nxt public.order_status;
begin
  v := public._lock_my_order(p_order_id);

  nxt := case
    when v.status = 'ACCEPTED'   and v.order_type = 'PICKUP'   then 'READY'
    when v.status = 'ACCEPTED'   and v.order_type = 'DELIVERY' then 'DELIVERING'
    when v.status = 'READY'                                    then 'COMPLETED'
    when v.status = 'DELIVERING'                               then 'COMPLETED'
    else null
  end;
  if nxt is null then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  update public.orders
     set status = nxt,
         ready_at      = case when nxt = 'READY'      then now() else ready_at end,
         delivering_at = case when nxt = 'DELIVERING' then now() else delivering_at end,
         completed_at  = case when nxt = 'COMPLETED'  then now() else completed_at end
   where id = p_order_id
  returning * into v;
  return v;
end $$;

-- ── 영업 상태 ────────────────────────────────────────────────────────
create or replace function public.set_store_status(p_status public.store_status)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.stores;
begin
  update public.stores set status = p_status where id = public.my_store_id() returning * into s;
  if not found then
    raise exception 'STORE_NOT_FOUND' using errcode = 'P0001';
  end if;
  return s;
end $$;

-- ── 상태별 주문 수 (오늘) ────────────────────────────────────────────
create or replace function public.order_counts()
returns table (status public.order_status, cnt bigint)
language sql
stable
security definer
set search_path = public
as $$
  select o.status, count(*)
    from public.orders o
   where o.store_id = public.my_store_id()
     and o.created_at >= date_trunc('day', now())
   group by o.status
$$;

-- ── 홈 대시보드 요약 ─────────────────────────────────────────────────
-- 매출은 COMPLETED 주문의 total_amount 합. 날짜는 서버 로컬(Asia/Seoul 로 고정) 기준.
create or replace function public.dashboard_summary()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store uuid := public.my_store_id();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_result json;
begin
  select json_build_object(
    'today', (
      select json_build_object(
        'sales',      coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0),
        'orderCount', count(*) filter (where status not in ('REJECTED', 'CANCELED')),
        'pending',    count(*) filter (where status = 'PENDING'),
        'inProgress', count(*) filter (where status in ('ACCEPTED', 'READY', 'DELIVERING'))
      )
      from public.orders
      where store_id = v_store and (created_at at time zone 'Asia/Seoul')::date = v_today
    ),
    'month', (
      select json_build_object(
        'sales',      coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0),
        'orderCount', count(*) filter (where status = 'COMPLETED')
      )
      from public.orders
      where store_id = v_store and date_trunc('month', created_at at time zone 'Asia/Seoul') = date_trunc('month', v_today::timestamp)
    ),
    'week', (
      select coalesce(json_agg(json_build_object('date', d.day::date, 'sales', coalesce(t.sales, 0), 'orderCount', coalesce(t.cnt, 0)) order by d.day), '[]'::json)
      from generate_series(v_today - 6, v_today, interval '1 day') as d(day)
      left join (
        select (created_at at time zone 'Asia/Seoul')::date as day,
               sum(total_amount) filter (where status = 'COMPLETED') as sales,
               count(*) filter (where status = 'COMPLETED') as cnt
          from public.orders
         where store_id = v_store and created_at >= (v_today - 6)::timestamp at time zone 'Asia/Seoul'
         group by 1
      ) t on t.day = d.day::date
    )
  ) into v_result;
  return v_result;
end $$;

-- ── 정산 (일 단위 집계 뷰) ───────────────────────────────────────────
-- 완료 주문의 합계에서 수수료(가게 fee_rate)와 VAT(수수료의 10%)를 뺀 금액이 입금액.
-- 완료일 기준 D+2 영업일에 입금된다고 가정한다. 뷰는 security_invoker 라 orders 의 RLS 가 그대로 적용된다.
create or replace view public.settlements
with (security_invoker = true)
as
select
  o.store_id,
  (o.completed_at at time zone 'Asia/Seoul')::date                                     as settle_date,
  count(*)::integer                                                                     as order_count,
  sum(o.total_amount)::integer                                                          as sales_amount,
  round(sum(o.total_amount) * s.fee_rate / 100)::integer                                as fee,
  round(sum(o.total_amount) * s.fee_rate / 100 * 0.1)::integer                          as vat,
  (sum(o.total_amount) - round(sum(o.total_amount) * s.fee_rate / 100)
                       - round(sum(o.total_amount) * s.fee_rate / 100 * 0.1))::integer  as payout_amount,
  ((o.completed_at at time zone 'Asia/Seoul')::date + 2)                                as payout_date,
  case when (o.completed_at at time zone 'Asia/Seoul')::date + 2 <= (now() at time zone 'Asia/Seoul')::date
       then 'PAID' else 'SCHEDULED' end                                                 as status
from public.orders o
join public.stores s on s.id = o.store_id
where o.status = 'COMPLETED'
group by o.store_id, s.fee_rate, (o.completed_at at time zone 'Asia/Seoul')::date;

grant select on public.settlements to authenticated;

-- ── 권한 ─────────────────────────────────────────────────────────────
grant execute on function public.accept_order(uuid, integer, boolean) to authenticated;
grant execute on function public.reject_order(uuid, text)             to authenticated;
grant execute on function public.cancel_order(uuid, text)             to authenticated;
grant execute on function public.advance_order(uuid)                  to authenticated;
grant execute on function public.set_store_status(public.store_status) to authenticated;
grant execute on function public.order_counts()                        to authenticated;
grant execute on function public.dashboard_summary()                   to authenticated;
