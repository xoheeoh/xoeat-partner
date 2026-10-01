-- =====================================================================
-- Xoeat Partner Demo — 데모 전용 함수
--
-- 이 데모에는 고객 앱이 없다. 그래서 "주문이 들어오는" 경험을 보여 주기 위해
--   · demo_create_order()  : 로그인한 사장님 가게에 가짜 고객 주문 1건을 넣는다 (앱의 "데모 주문 받기" 버튼)
--   · demo_bootstrap()     : 데모 계정의 가게·메뉴·지난 30일 주문을 만든다 (scripts/seed-demo.mjs 가 서비스 롤로 호출)
-- =====================================================================

-- ── 주문번호 ─────────────────────────────────────────────────────────
create or replace function public._next_order_no(p_at timestamptz default now())
returns text
language sql
volatile
set search_path = public
as $$
  select 'X' || to_char(p_at at time zone 'Asia/Seoul', 'YYMMDD') || '-' || lpad(nextval('public.order_no_seq')::text, 4, '0')
$$;
revoke all on function public._next_order_no(timestamptz) from public, anon, authenticated;

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
  v_line     integer;
  v_qty      integer;
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

  insert into public.orders (store_id, order_no, order_type, status, customer_name, customer_phone,
                             address, address_detail, request_memo, items_amount, delivery_fee, total_amount, created_at)
  values (p_store_id, public._next_order_no(p_at), v_type, 'PENDING', v_name, v_phone,
          case when v_type = 'DELIVERY' then addrs[1 + floor(random() * array_length(addrs, 1))::int] end,
          case when v_type = 'DELIVERY' then details[1 + floor(random() * array_length(details, 1))::int] end,
          memos[1 + floor(random() * array_length(memos, 1))::int],
          0, v_fee, 0, p_at)
  returning * into o;

  -- 메뉴 1~3개를 무작위로 담는다 (판매중인 것만)
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

    v_line := (m.price + v_opt_amt) * v_qty;
    v_items := v_items + v_line;

    insert into public.order_items (order_id, menu_id, menu_name, quantity, unit_price, options, line_amount)
    values (o.id, m.id, m.name, v_qty, m.price + v_opt_amt, v_opts, v_line);
  end loop;

  if v_items = 0 then
    delete from public.orders where id = o.id;
    raise exception 'NO_MENU_ON_SALE' using errcode = 'P0001';
  end if;

  -- 최소 주문금액을 못 채우면 첫 메뉴 수량을 늘린다 (고객 앱이 막아 주는 부분)
  if v_items < s.min_order_amount then
    update public.order_items
       set quantity = quantity + ceil((s.min_order_amount - v_items)::numeric / unit_price)::int,
           line_amount = unit_price * (quantity + ceil((s.min_order_amount - v_items)::numeric / unit_price)::int)
     where id = (select id from public.order_items where order_id = o.id limit 1);
    select sum(line_amount) into v_items from public.order_items where order_id = o.id;
  end if;

  -- 과거 이력용 상태 반영
  update public.orders
     set items_amount  = v_items,
         total_amount  = v_items + v_fee,
         status        = p_status,
         cooking_minutes = case when p_status in ('ACCEPTED','DELIVERING','COMPLETED') and v_type = 'DELIVERY' then (array[10,20,30,40])[1 + floor(random()*4)::int] end,
         accepted_at   = case when p_status in ('ACCEPTED','READY','DELIVERING','COMPLETED','CANCELED') then p_at + interval '2 minutes' end,
         ready_at      = case when p_status in ('READY','COMPLETED') and v_type = 'PICKUP' then p_at + interval '17 minutes' end,
         delivering_at = case when p_status in ('DELIVERING','COMPLETED') and v_type = 'DELIVERY' then p_at + interval '22 minutes' end,
         completed_at  = case when p_status = 'COMPLETED' then p_at + interval '41 minutes' end,
         canceled_at   = case when p_status in ('REJECTED','CANCELED') then p_at + interval '3 minutes' end,
         reject_reason = case when p_status = 'REJECTED' then (array['재료 소진','주문 폭주','영업 조기 마감'])[1 + floor(random()*3)::int]
                              when p_status = 'CANCELED' then '고객 요청' end
   where id = o.id
  returning * into o;

  return o;
end $$;
revoke all on function public._demo_insert_order(uuid, timestamptz, public.order_status, public.order_type) from public, anon, authenticated;

-- ── 앱에서 누르는 "데모 주문 받기" ──────────────────────────────────
-- 1분에 10건까지만. 영업 일시중지 상태면 고객 앱이 주문을 막는 것처럼 거부한다.
create or replace function public.demo_create_order(p_type public.order_type default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.my_store_id();
  s public.stores;
  v_recent integer;
begin
  if v_store is null then
    raise exception 'STORE_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into s from public.stores where id = v_store;
  if s.status = 'PAUSED' then
    raise exception 'STORE_PAUSED' using errcode = 'P0001';
  end if;
  select count(*) into v_recent from public.orders
   where store_id = v_store and created_at > now() - interval '1 minute';
  if v_recent >= 10 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  return public._demo_insert_order(v_store, now(), 'PENDING', p_type);
end $$;
grant execute on function public.demo_create_order(public.order_type) to authenticated;

-- ── 데모 계정 부트스트랩 (서비스 롤 전용) ───────────────────────────
create or replace function public.demo_bootstrap(
  p_user_id    uuid,
  p_login_id   text,
  p_store_name text default '연남 소반'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store   uuid;
  c_main    uuid; c_side uuid; c_drink uuid; c_set uuid;
  g_spicy   uuid; g_size uuid; g_topping uuid; g_rice uuid;
  m         uuid;
  d         integer;
  i         integer;
  n_orders  integer;
  v_at      timestamptz;
  v_status  public.order_status;
  v_count   integer := 0;
begin
  -- 가게
  insert into public.stores (owner_id, login_id, name, category_cd, intro, origin_info, phone, address, biz_no, rep_name,
                             min_order_amount, delivery_fee, delivery_enabled, pickup_enabled, self_delivery,
                             bank_name, account_no, account_holder, fee_rate)
  values (p_user_id, lower(p_login_id), p_store_name, 'KOREAN_FOOD',
          '매일 아침 직접 끓이는 국과 갓 지은 밥으로 차리는 한 상. 든든한 집밥이 필요한 날, 연남 소반이 배달해 드립니다.',
          '쌀: 국내산 / 돼지고기: 국내산 / 김치(배추, 고춧가루): 국내산 / 두부(콩): 외국산(미국)',
          '02-333-1200', '서울 마포구 연남로 27 1층', '123-45-67890', '김소희',
          12000, 3000, true, true, true,
          '국민은행', '123456-01-123456', '김소희', 3.30)
  returning id into v_store;

  -- 영업시간 (월~토 11:00~21:30, 브레이크 15:00~17:00 / 일 휴무)
  for d in 0..6 loop
    insert into public.store_hours (store_id, day_of_week, enabled, open_time, close_time, break_from, break_to)
    values (v_store, d, d <> 6, '11:00', '21:30',
            case when d < 5 then time '15:00' end, case when d < 5 then time '17:00' end);
  end loop;

  -- 카테고리
  insert into public.menu_categories (store_id, name, sort_order) values (v_store, '대표 메뉴', 0) returning id into c_main;
  insert into public.menu_categories (store_id, name, sort_order) values (v_store, '세트', 1) returning id into c_set;
  insert into public.menu_categories (store_id, name, sort_order) values (v_store, '사이드', 2) returning id into c_side;
  insert into public.menu_categories (store_id, name, sort_order) values (v_store, '음료', 3) returning id into c_drink;

  -- 옵션 그룹
  insert into public.option_groups (store_id, name, required, min_select, max_select, sort_order)
  values (v_store, '맵기 선택', true, 1, 1, 0) returning id into g_spicy;
  insert into public.options (group_id, name, price, sort_order) values
    (g_spicy, '순한맛', 0, 0), (g_spicy, '보통맛', 0, 1), (g_spicy, '매운맛', 0, 2);

  insert into public.option_groups (store_id, name, required, min_select, max_select, sort_order)
  values (v_store, '양 선택', true, 1, 1, 1) returning id into g_size;
  insert into public.options (group_id, name, price, sort_order) values
    (g_size, '보통', 0, 0), (g_size, '곱빼기', 2000, 1);

  insert into public.option_groups (store_id, name, required, min_select, max_select, sort_order)
  values (v_store, '토핑 추가', false, 0, 3, 2) returning id into g_topping;
  insert into public.options (group_id, name, price, sold_out, sort_order) values
    (g_topping, '계란 프라이', 1000, false, 0), (g_topping, '치즈', 1500, false, 1),
    (g_topping, '수육 추가(100g)', 4000, false, 2), (g_topping, '떡 사리', 1000, true, 3);

  insert into public.option_groups (store_id, name, required, min_select, max_select, sort_order)
  values (v_store, '공기밥', false, 0, 2, 3) returning id into g_rice;
  insert into public.options (group_id, name, price, sort_order) values
    (g_rice, '공기밥 추가', 1000, 0), (g_rice, '현미밥으로 변경', 500, 1);

  -- 메뉴
  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_main, '소반 김치찌개', '묵은지와 국내산 돼지고기를 넣고 뭉근히 끓인 김치찌개. 공기밥 1개 포함.', '1인분', 9500, 'ON_SALE', 0) returning id into m;
  insert into public.menu_option_groups values (m, g_spicy, 0), (m, g_size, 1), (m, g_topping, 2), (m, g_rice, 3);

  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_main, '제육볶음 정식', '매콤달콤한 제육볶음에 쌈채소와 밑반찬 3종.', '1인분', 11000, 'ON_SALE', 1) returning id into m;
  insert into public.menu_option_groups values (m, g_spicy, 0), (m, g_size, 1), (m, g_rice, 2);

  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_main, '된장찌개 정식', '직접 담근 된장으로 끓인 구수한 된장찌개. 공기밥 1개 포함.', '1인분', 9000, 'ON_SALE', 2) returning id into m;
  insert into public.menu_option_groups values (m, g_size, 0), (m, g_rice, 1);

  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_main, '순두부찌개', '해물 육수에 부드러운 순두부. 계란 프라이 추가 추천.', '1인분', 9000, 'SOLD_OUT', 3) returning id into m;
  insert into public.menu_option_groups values (m, g_spicy, 0), (m, g_topping, 1), (m, g_rice, 2);

  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_set, '2인 집밥 세트', '김치찌개 + 제육볶음 + 계란말이 + 공기밥 2개', '2인분', 24000, 'ON_SALE', 0) returning id into m;
  insert into public.menu_option_groups values (m, g_spicy, 0);

  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_set, '혼밥 세트', '찌개 1개(김치/된장 선택) + 계란말이(소) + 공기밥', '1인분', 12500, 'ON_SALE', 1) returning id into m;
  insert into public.menu_option_groups values (m, g_spicy, 0);

  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_side, '계란말이', '당근·파를 넣어 도톰하게 말아낸 계란말이.', '소', 6000, 'ON_SALE', 0);
  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_side, '수육 (200g)', '잡내 없이 삶아낸 돼지 앞다리살 수육. 새우젓 포함.', '200g', 13000, 'ON_SALE', 1);
  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_side, '김치전', '묵은지를 송송 썰어 바삭하게 부친 김치전.', '1장', 7000, 'HIDDEN', 2);

  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_drink, '식혜', '직접 삭힌 전통 식혜.', '350ml', 2500, 'ON_SALE', 0);
  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
  values (v_store, c_drink, '콜라', '', '245ml', 1500, 'ON_SALE', 1);
  insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order, adult_only)
  values (v_store, c_drink, '막걸리', '지평 생막걸리', '750ml', 4000, 'ON_SALE', 2, true);

  -- 지난 30일 주문 이력 (영업일마다 6~14건, 대부분 완료)
  for d in reverse 30..1 loop
    continue when extract(isodow from (now() at time zone 'Asia/Seoul')::date - d) = 7; -- 일요일 휴무
    n_orders := 6 + floor(random() * 9)::int;
    for i in 1..n_orders loop
      v_at := ((now() at time zone 'Asia/Seoul')::date - d)::timestamp at time zone 'Asia/Seoul'
              + make_interval(hours => 11 + floor(random() * 10)::int, mins => floor(random() * 60)::int);
      v_status := (case
        when random() < 0.90 then 'COMPLETED'
        when random() < 0.60 then 'REJECTED'
        else 'CANCELED' end)::public.order_status;
      perform public._demo_insert_order(v_store, v_at, v_status);
      v_count := v_count + 1;
    end loop;
  end loop;

  -- 오늘: 완료 3건, 진행중(조리중·배달중·준비완료) 3건, 접수대기 2건
  perform public._demo_insert_order(v_store, now() - interval '3 hours',    'COMPLETED');
  perform public._demo_insert_order(v_store, now() - interval '2 hours',    'COMPLETED');
  perform public._demo_insert_order(v_store, now() - interval '80 minutes', 'COMPLETED');
  perform public._demo_insert_order(v_store, now() - interval '25 minutes', 'ACCEPTED',   'DELIVERY');
  perform public._demo_insert_order(v_store, now() - interval '18 minutes', 'DELIVERING', 'DELIVERY');
  perform public._demo_insert_order(v_store, now() - interval '12 minutes', 'READY',      'PICKUP');
  perform public._demo_insert_order(v_store, now() - interval '4 minutes',  'PENDING',    'DELIVERY');
  perform public._demo_insert_order(v_store, now() - interval '1 minute',   'PENDING',    'PICKUP');
  v_count := v_count + 8;

  return json_build_object('storeId', v_store, 'orders', v_count);
end $$;

revoke execute on function public.demo_bootstrap(uuid, text, text) from public, anon, authenticated;
grant execute on function public.demo_bootstrap(uuid, text, text) to service_role;
