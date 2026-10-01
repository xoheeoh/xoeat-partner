-- =====================================================================
-- Xoeat Customer — 구매자(회원) 측 모델
--
-- 같은 Supabase 프로젝트를 사장님 앱(xoeat-partner)과 구매자 앱(xoeat-customer)이 공유한다.
--   · 사장님: stores.owner_id = auth.uid()  → 기존 RLS 그대로
--   · 구매자: customers.id   = auth.uid()  → 가게·메뉴는 읽기만, 주문은 place_order() 로만 생성
-- 구매자 앱이 만든 주문은 사장님 앱에 Realtime 으로 바로 뜬다 (같은 orders 테이블).
-- =====================================================================

-- ── 회원 ────────────────────────────────────────────────────────────
create table public.customers (
  id         uuid primary key references auth.users(id) on delete cascade,
  login_id   text not null unique,
  name       text not null,
  phone      text not null default '',
  created_at timestamptz not null default now()
);

-- 회원가입(auth.signUp) 시 user_metadata.role = 'customer' 이면 프로필을 만든다.
-- 사장님 계정은 seed-demo.mjs 가 서비스 롤로 만들고 metadata 가 없으므로 영향 없다.
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', '') = 'customer' then
    insert into public.customers (id, login_id, name, phone)
    values (
      new.id,
      lower(coalesce(new.raw_user_meta_data->>'login_id', split_part(new.email, '@', 1))),
      coalesce(new.raw_user_meta_data->>'name', '회원'),
      coalesce(new.raw_user_meta_data->>'phone', '')
    );
  end if;
  return new;
end $$;

create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function public.handle_new_customer();

create or replace function public.is_customer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.customers c where c.id = auth.uid())
$$;
grant execute on function public.is_customer() to authenticated;

-- ── 배송지 ──────────────────────────────────────────────────────────
create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  label        text not null default '',          -- 집, 회사 …
  road_address text not null check (length(road_address) between 2 and 200),
  detail       text not null default '',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_customer_idx on public.addresses(customer_id, created_at desc);

-- ── 결제수단 (가상 카드) ─────────────────────────────────────────────
-- 실제 PG 토큰 대신 카드사·끝 4자리·유효기간만 저장한다. 실제 카드번호는 서버에 오지 않는다.
create table public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  brand       text not null,                      -- 신한, 국민, 현대 …
  last4       text not null check (last4 ~ '^[0-9]{4}$'),
  expiry      text not null check (expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  alias       text not null default '',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index payment_methods_customer_idx on public.payment_methods(customer_id, created_at desc);

-- 기본 배송지·기본 결제수단은 회원당 1개
create unique index addresses_one_default on public.addresses(customer_id) where is_default;
create unique index payment_methods_one_default on public.payment_methods(customer_id) where is_default;

-- ── 찜한 가게 ────────────────────────────────────────────────────────
create table public.favorites (
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id    uuid not null references public.stores(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, store_id)
);

-- ── 가게 목록용 컬럼 ─────────────────────────────────────────────────
alter table public.stores
  add column delivery_minutes_min integer not null default 30,
  add column delivery_minutes_max integer not null default 45,
  add column region text not null default '마포구';   -- 데모는 지역 고정

-- ── 주문에 구매자 연결 ───────────────────────────────────────────────
alter table public.orders
  add column customer_id uuid references public.customers(id) on delete set null,
  add column card_label  text;                    -- '신한카드 ****1234'
create index orders_customer_idx on public.orders(customer_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.customers       enable row level security;
alter table public.addresses       enable row level security;
alter table public.payment_methods enable row level security;
alter table public.favorites       enable row level security;

grant select, update (name, phone) on public.customers to authenticated;
grant select, insert, update, delete on public.addresses, public.payment_methods, public.favorites to authenticated;

create policy customers_select_self on public.customers
  for select to authenticated using (id = (select auth.uid()));
create policy customers_update_self on public.customers
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy addresses_all_self on public.addresses
  for all to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy payment_methods_all_self on public.payment_methods
  for all to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy favorites_all_self on public.favorites
  for all to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));

-- 구매자는 모든 가게·메뉴를 읽을 수 있다 (숨김 메뉴 제외). 사장님은 is_customer() 가 false 라 기존 정책만 적용된다.
create policy stores_select_customer on public.stores
  for select to authenticated using (public.is_customer());
create policy store_hours_select_customer on public.store_hours
  for select to authenticated using (public.is_customer());
create policy menu_categories_select_customer on public.menu_categories
  for select to authenticated using (public.is_customer());
create policy menus_select_customer on public.menus
  for select to authenticated using (public.is_customer() and sale_status <> 'HIDDEN');
create policy option_groups_select_customer on public.option_groups
  for select to authenticated using (public.is_customer());
create policy options_select_customer on public.options
  for select to authenticated using (public.is_customer());
create policy menu_option_groups_select_customer on public.menu_option_groups
  for select to authenticated using (public.is_customer());

-- 구매자는 자기 주문만
create policy orders_select_customer on public.orders
  for select to authenticated using (customer_id = (select auth.uid()));
create policy order_items_select_customer on public.order_items
  for select to authenticated
  using (order_id in (select o.id from public.orders o where o.customer_id = (select auth.uid())));

-- ── 주문 생성 ───────────────────────────────────────────────────────
-- 장바구니(p_items)를 서버가 다시 계산해 orders / order_items 를 만든다.
-- p_items: [{ "menuId": uuid, "quantity": int, "optionIds": [uuid, ...] }]
-- 가격·옵션 규칙·최소주문금액·영업 상태는 모두 서버가 검사한다 (앱의 금액은 표시용일 뿐).
create or replace function public.place_order(
  p_store_id          uuid,
  p_order_type        public.order_type,
  p_items             jsonb,
  p_address_id        uuid default null,
  p_payment_method_id uuid default null,
  p_request_memo      text default ''
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cust   public.customers;
  s        public.stores;
  a        public.addresses;
  pm       public.payment_methods;
  o        public.orders;
  it       jsonb;
  m        public.menus;
  v_qty    integer;
  v_opt_ids uuid[];
  v_opts   jsonb;
  v_opt_amt integer;
  v_line   integer;
  v_items  integer := 0;
  v_fee    integer := 0;
  g        record;
  v_cnt    integer;
begin
  select * into v_cust from public.customers where id = auth.uid();
  if not found then raise exception 'NOT_A_CUSTOMER' using errcode = 'P0001'; end if;

  select * into s from public.stores where id = p_store_id;
  if not found then raise exception 'STORE_NOT_FOUND' using errcode = 'P0001'; end if;
  if s.status = 'PAUSED' then raise exception 'STORE_PAUSED' using errcode = 'P0001'; end if;
  if p_order_type = 'DELIVERY' and not s.delivery_enabled then raise exception 'DELIVERY_NOT_AVAILABLE' using errcode = 'P0001'; end if;
  if p_order_type = 'PICKUP' and not s.pickup_enabled then raise exception 'PICKUP_NOT_AVAILABLE' using errcode = 'P0001'; end if;

  if p_order_type = 'DELIVERY' then
    select * into a from public.addresses where id = p_address_id and customer_id = v_cust.id;
    if not found then raise exception 'ADDRESS_REQUIRED' using errcode = 'P0001'; end if;
    v_fee := s.delivery_fee;
  end if;

  select * into pm from public.payment_methods where id = p_payment_method_id and customer_id = v_cust.id;
  if not found then raise exception 'PAYMENT_METHOD_REQUIRED' using errcode = 'P0001'; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  insert into public.orders (store_id, customer_id, order_no, order_type, status, customer_name, customer_phone,
                             address, address_detail, request_memo, items_amount, delivery_fee, total_amount,
                             payment_method, card_label)
  values (p_store_id, v_cust.id, public._next_order_no(), p_order_type, 'PENDING', v_cust.name, v_cust.phone,
          case when p_order_type = 'DELIVERY' then a.road_address end,
          case when p_order_type = 'DELIVERY' then a.detail end,
          coalesce(left(p_request_memo, 200), ''), 0, v_fee, 0,
          'CARD', pm.brand || '카드 ****' || pm.last4)
  returning * into o;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into m from public.menus where id = (it->>'menuId')::uuid and store_id = p_store_id;
    if not found then raise exception 'MENU_NOT_FOUND' using errcode = 'P0001'; end if;
    if m.sale_status <> 'ON_SALE' then raise exception 'MENU_SOLD_OUT' using errcode = 'P0001'; end if;

    v_qty := coalesce((it->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > 99 then raise exception 'INVALID_QUANTITY' using errcode = 'P0001'; end if;

    select coalesce(array_agg(x::uuid), '{}') into v_opt_ids
      from jsonb_array_elements_text(coalesce(it->'optionIds', '[]'::jsonb)) x;

    -- 옵션은 이 메뉴에 연결된 그룹의 것만, 품절 아닌 것만
    if exists (
      select 1 from unnest(v_opt_ids) oid
      where not exists (
        select 1 from public.options op
        join public.menu_option_groups mog on mog.group_id = op.group_id and mog.menu_id = m.id
        where op.id = oid and not op.sold_out)
    ) then
      raise exception 'INVALID_OPTION' using errcode = 'P0001';
    end if;

    -- 그룹별 선택 개수 규칙 (필수 min~max, 선택 0~max)
    for g in
      select og.id, og.name, og.required, og.min_select, og.max_select
        from public.menu_option_groups mog join public.option_groups og on og.id = mog.group_id
       where mog.menu_id = m.id
    loop
      select count(*) into v_cnt from public.options op where op.group_id = g.id and op.id = any(v_opt_ids);
      if g.required and v_cnt < g.min_select then raise exception 'OPTION_REQUIRED' using errcode = 'P0001'; end if;
      if v_cnt > g.max_select then raise exception 'OPTION_TOO_MANY' using errcode = 'P0001'; end if;
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object('groupName', og.name, 'name', op.name, 'price', op.price) order by og.sort_order, op.sort_order), '[]'::jsonb),
           coalesce(sum(op.price), 0)
      into v_opts, v_opt_amt
      from public.options op join public.option_groups og on og.id = op.group_id
     where op.id = any(v_opt_ids);

    v_line := (m.price + v_opt_amt) * v_qty;
    v_items := v_items + v_line;

    insert into public.order_items (order_id, menu_id, menu_name, quantity, unit_price, options, line_amount)
    values (o.id, m.id, m.name, v_qty, m.price + v_opt_amt, v_opts, v_line);
  end loop;

  if p_order_type = 'DELIVERY' and v_items < s.min_order_amount then
    raise exception 'MIN_ORDER_AMOUNT' using errcode = 'P0001';
  end if;

  update public.orders set items_amount = v_items, total_amount = v_items + v_fee where id = o.id returning * into o;
  return o;
end $$;
grant execute on function public.place_order(uuid, public.order_type, jsonb, uuid, uuid, text) to authenticated;

-- ── 구매자 주문 취소 (접수대기 중에만) ──────────────────────────────
create or replace function public.cancel_my_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001'; end if;
  if o.status <> 'PENDING' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  update public.orders set status = 'CANCELED', reject_reason = '고객 요청', canceled_at = now()
   where id = p_order_id returning * into o;
  return o;
end $$;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- ── 기본 배송지/결제수단 지정 (하나만 default 가 되도록 한 트랜잭션에서) ──
create or replace function public.set_default_address(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.addresses set is_default = false where customer_id = auth.uid() and is_default;
  update public.addresses set is_default = true where id = p_id and customer_id = auth.uid();
end $$;
create or replace function public.set_default_payment_method(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payment_methods set is_default = false where customer_id = auth.uid() and is_default;
  update public.payment_methods set is_default = true where id = p_id and customer_id = auth.uid();
end $$;
grant execute on function public.set_default_address(uuid) to authenticated;
grant execute on function public.set_default_payment_method(uuid) to authenticated;
