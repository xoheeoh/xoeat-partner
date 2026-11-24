-- ── 주문을 처음부터 올바른 금액으로 저장한다 ──────────────────────────
-- 문제: place_order() 와 _demo_insert_order() 가 주문 줄을 합계 0원으로 먼저 넣고,
--       메뉴를 담은 뒤에 합계를 고쳤다. "새 주문" 알림은 주문 줄이 들어가는 순간 만들어지므로
--       사장님 앱의 토스트와 알림함에 "배달 · 0원" 으로 나왔다. (주문 자체의 금액은 맞게 저장됐다)
--
-- 고침: 두 함수 모두 순서를 바꾼다.
--       ① 담을 메뉴와 금액을 먼저 계산해 모아 두고 → ② 주문 줄을 확정된 금액으로 넣고 → ③ 메뉴 줄을 넣는다.
--       검사 규칙·에러 코드·반환값은 그대로다. 앱 코드는 바꿀 필요가 없다.
--
-- 덤: _demo_insert_order() 는 과거 이력용 주문도 '접수대기'로 넣었다가 상태를 고쳤는데,
--     이제 처음부터 최종 상태로 넣는다. (이력을 채울 때 "새 주문" 토스트가 뜨지 않는다)

-- ── 구매자 주문 생성 ─────────────────────────────────────────────────
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
  v_lines  jsonb := '[]'::jsonb;  -- 검사를 통과한 메뉴 줄을 모아 두었다가 주문 줄 다음에 넣는다
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

  -- ① 메뉴마다 검사하고 금액을 계산한다 (아직 아무것도 저장하지 않는다)
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

    v_lines := v_lines || jsonb_build_object(
      'menu_id', m.id, 'menu_name', m.name, 'quantity', v_qty,
      'unit_price', m.price + v_opt_amt, 'options', v_opts, 'line_amount', v_line);
  end loop;

  if p_order_type = 'DELIVERY' and v_items < s.min_order_amount then
    raise exception 'MIN_ORDER_AMOUNT' using errcode = 'P0001';
  end if;

  -- ② 주문 줄을 확정된 금액으로 넣는다 (이 순간 "새 주문" 알림이 만들어진다)
  insert into public.orders (store_id, customer_id, order_no, order_type, status, customer_name, customer_phone,
                             address, address_detail, request_memo, items_amount, delivery_fee, total_amount,
                             payment_method, card_label)
  values (p_store_id, v_cust.id, public._next_order_no(), p_order_type, 'PENDING', v_cust.name, v_cust.phone,
          case when p_order_type = 'DELIVERY' then a.road_address end,
          case when p_order_type = 'DELIVERY' then a.detail end,
          coalesce(left(p_request_memo, 200), ''), v_items, v_fee, v_items + v_fee,
          'CARD', pm.brand || '카드 ****' || pm.last4)
  returning * into o;

  -- ③ 모아 둔 메뉴 줄을 담은 순서대로 넣는다
  insert into public.order_items (order_id, menu_id, menu_name, quantity, unit_price, options, line_amount)
  select o.id, (l->>'menu_id')::uuid, l->>'menu_name', (l->>'quantity')::int,
         (l->>'unit_price')::int, l->'options', (l->>'line_amount')::int
    from jsonb_array_elements(v_lines) with ordinality as t(l, ord)
   order by ord;

  return o;
end $$;

-- ── 가짜 고객 주문 생성 (내부) ───────────────────────────────────────
-- p_at: 주문 시각. p_status: 만들 상태(과거 이력용). 기본은 지금·접수대기.
create or replace function public._demo_insert_order(
  p_store_id uuid,
  p_at       timestamptz default now(),
  p_status   public.order_status default 'PENDING',
  p_type     public.order_type default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.stores;
  o          public.orders;
  v_type     public.order_type;
  v_items    integer := 0;
  v_fee      integer := 0;
  v_cnt      integer;
  m          record;
  v_opts     jsonb;
  v_opt_amt  integer;
  v_qty      integer;
  v_lines    jsonb := '[]'::jsonb;  -- 담을 메뉴 줄 [{ menu_id, menu_name, quantity, unit_price, options }]
  v_unit     integer;
  v_add      integer;
  names      text[] := array['김민준','이서연','박지호','최수아','정도윤','강하은','조예준','윤지우','임시우','한서준','오하린','서지안'];
  memos      text[] := array['', '', '문 앞에 놓아주세요', '벨 누르지 말아주세요', '수저는 빼주세요', '맵지 않게 해주세요', '빨리 와주세요 🙏', '일회용품 안 주셔도 돼요'];
  addrs      text[] := array['서울 마포구 연남로 12', '서울 마포구 성미산로 45', '서울 서대문구 연희로 8', '서울 마포구 월드컵북로 23', '서울 마포구 동교로 112'];
  details    text[] := array['101동 1203호', '2층', '302호', '5층 502호', 'B동 804호'];
  v_name     text;
  v_phone    text;
begin
  select * into s from public.stores where id = p_store_id;
  if not found then
    raise exception 'STORE_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_type := coalesce(p_type, (case when random() < 0.7 then 'DELIVERY' else 'PICKUP' end)::public.order_type);
  if v_type = 'DELIVERY' and not s.delivery_enabled then v_type := 'PICKUP'; end if;
  if v_type = 'PICKUP'   and not s.pickup_enabled   then v_type := 'DELIVERY'; end if;

  v_name  := names[1 + floor(random() * array_length(names, 1))::int];
  v_phone := '010-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0') || '-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
  v_fee   := case when v_type = 'DELIVERY' then s.delivery_fee else 0 end;

  -- ① 메뉴 1~3개를 무작위로 고르고 금액을 계산한다 (판매중인 것만. 아직 저장하지 않는다)
  v_cnt := 1 + floor(random() * 3)::int;
  for m in
    select mn.id, mn.name, mn.price
      from public.menus mn
     where mn.store_id = p_store_id and mn.sale_status = 'ON_SALE'
     order by random()
     limit v_cnt
  loop
    v_qty := case when random() < 0.75 then 1 else 2 end;
    v_opts := '[]'::jsonb;
    v_opt_amt := 0;

    -- 연결된 옵션 그룹마다: 필수면 1개, 선택이면 50% 확률로 1개 고른다
    select coalesce(jsonb_agg(jsonb_build_object('groupName', g.name, 'name', op.name, 'price', op.price)), '[]'::jsonb),
           coalesce(sum(op.price), 0)
      into v_opts, v_opt_amt
      from public.menu_option_groups mog
      join public.option_groups g on g.id = mog.group_id
      join lateral (
        select * from public.options x
         where x.group_id = g.id and not x.sold_out
         order by random() limit 1
      ) op on true
     where mog.menu_id = m.id
       and (g.required or random() < 0.5);

    v_items := v_items + (m.price + v_opt_amt) * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'menu_id', m.id, 'menu_name', m.name, 'quantity', v_qty,
      'unit_price', m.price + v_opt_amt, 'options', v_opts);
  end loop;

  if v_items = 0 then
    raise exception 'NO_MENU_ON_SALE' using errcode = 'P0001';
  end if;

  -- 최소 주문금액을 못 채우면 첫 메뉴 수량을 늘린다 (고객 앱이 막아 주는 부분)
  if v_items < s.min_order_amount then
    v_unit  := (v_lines->0->>'unit_price')::int;
    v_add   := ceil((s.min_order_amount - v_items)::numeric / v_unit)::int;
    v_lines := jsonb_set(v_lines, '{0,quantity}', to_jsonb((v_lines->0->>'quantity')::int + v_add));
    v_items := v_items + v_unit * v_add;
  end if;

  -- ② 주문 줄을 확정된 금액·상태로 넣는다 (이 순간 "새 주문" 알림이 만들어진다)
  insert into public.orders (store_id, order_no, order_type, status, customer_name, customer_phone,
                             address, address_detail, request_memo, items_amount, delivery_fee, total_amount, created_at,
                             cooking_minutes, accepted_at, ready_at, delivering_at, completed_at, canceled_at, reject_reason)
  values (p_store_id, public._next_order_no(p_at), v_type, p_status, v_name, v_phone,
          case when v_type = 'DELIVERY' then addrs[1 + floor(random() * array_length(addrs, 1))::int] end,
          case when v_type = 'DELIVERY' then details[1 + floor(random() * array_length(details, 1))::int] end,
          memos[1 + floor(random() * array_length(memos, 1))::int],
          v_items, v_fee, v_items + v_fee, p_at,
          case when p_status in ('ACCEPTED','DELIVERING','COMPLETED') and v_type = 'DELIVERY' then (array[10,20,30,40])[1 + floor(random()*4)::int] end,
          case when p_status in ('ACCEPTED','READY','DELIVERING','COMPLETED','CANCELED') then p_at + interval '2 minutes' end,
          case when p_status in ('READY','COMPLETED') and v_type = 'PICKUP' then p_at + interval '17 minutes' end,
          case when p_status in ('DELIVERING','COMPLETED') and v_type = 'DELIVERY' then p_at + interval '22 minutes' end,
          case when p_status = 'COMPLETED' then p_at + interval '41 minutes' end,
          case when p_status in ('REJECTED','CANCELED') then p_at + interval '3 minutes' end,
          case when p_status = 'REJECTED' then (array['재료 소진','주문 폭주','영업 조기 마감'])[1 + floor(random()*3)::int]
               when p_status = 'CANCELED' then '고객 요청' end)
  returning * into o;

  -- ③ 모아 둔 메뉴 줄을 넣는다
  insert into public.order_items (order_id, menu_id, menu_name, quantity, unit_price, options, line_amount)
  select o.id, (l->>'menu_id')::uuid, l->>'menu_name', (l->>'quantity')::int,
         (l->>'unit_price')::int, l->'options', (l->>'unit_price')::int * (l->>'quantity')::int
    from jsonb_array_elements(v_lines) with ordinality as t(l, ord)
   order by ord;

  return o;
end $$;

-- ── 이미 "0원"으로 저장된 새 주문 알림 문구를 실제 주문 내용으로 고친다 ──
update public.notifications n
   set body = format('%s · %s원 · %s',
                     case o.order_type when 'DELIVERY' then '배달' else '포장' end,
                     to_char(o.total_amount, 'FM999,999,999'),
                     o.customer_name)
  from public.orders o
 where n.order_id = o.id
   and n.kind = 'NEW_ORDER'
   and n.body like '%· 0원 ·%';
