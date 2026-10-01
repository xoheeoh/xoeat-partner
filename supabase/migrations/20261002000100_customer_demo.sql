-- =====================================================================
-- 구매자 데모 데이터
--   · demo_bootstrap_store()    : 메뉴 JSON 으로 가게를 만든다 (가게 목록을 채우기 위한 추가 가게용)
--   · demo_bootstrap_customer() : 데모 회원의 배송지·카드·찜·지난 주문
-- scripts/seed-demo.mjs 가 서비스 롤로 호출한다.
-- =====================================================================

-- 추가 가게. p_menus: [{ "category": "...", "items": [{ "name", "price", "desc", "standard", "status"? }] }]
create or replace function public.demo_bootstrap_store(
  p_user_id    uuid,
  p_login_id   text,
  p_store_name text,
  p_category   text,
  p_intro      text,
  p_address    text,
  p_min_order  integer,
  p_fee        integer,
  p_minutes    integer,
  p_menus      jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
  cat     jsonb;
  item    jsonb;
  c_id    uuid;
  d       integer;
  i       integer;
  n       integer;
  v_at    timestamptz;
  v_count integer := 0;
  ci      integer := 0;
  mi      integer;
begin
  insert into public.stores (owner_id, login_id, name, category_cd, intro, origin_info, phone, address, biz_no, rep_name,
                             min_order_amount, delivery_fee, delivery_enabled, pickup_enabled, self_delivery,
                             bank_name, account_no, account_holder, fee_rate, delivery_minutes_min, delivery_minutes_max)
  values (p_user_id, lower(p_login_id), p_store_name, p_category, p_intro, '주요 재료: 국내산', '02-000-0000', p_address,
          '000-00-00000', '사장님', p_min_order, p_fee, true, true, false,
          '국민은행', '000000-00-000000', '사장님', 3.30, p_minutes, p_minutes + 15)
  returning id into v_store;

  for d in 0..6 loop
    insert into public.store_hours (store_id, day_of_week, enabled, open_time, close_time)
    values (v_store, d, true, '11:00', '22:00');
  end loop;

  for cat in select * from jsonb_array_elements(p_menus) loop
    insert into public.menu_categories (store_id, name, sort_order) values (v_store, cat->>'category', ci) returning id into c_id;
    mi := 0;
    for item in select * from jsonb_array_elements(cat->'items') loop
      insert into public.menus (store_id, category_id, name, description, standard, price, sale_status, sort_order)
      values (v_store, c_id, item->>'name', coalesce(item->>'desc', ''), coalesce(item->>'standard', ''),
              (item->>'price')::int, coalesce(item->>'status', 'ON_SALE')::public.sale_status, mi);
      mi := mi + 1;
    end loop;
    ci := ci + 1;
  end loop;

  -- 지난 14일 주문 이력 (매출 그래프용)
  for d in reverse 14..1 loop
    n := 3 + floor(random() * 5)::int;
    for i in 1..n loop
      v_at := ((now() at time zone 'Asia/Seoul')::date - d)::timestamp at time zone 'Asia/Seoul'
              + make_interval(hours => 11 + floor(random() * 10)::int, mins => floor(random() * 60)::int);
      perform public._demo_insert_order(v_store, v_at, (case when random() < 0.92 then 'COMPLETED' else 'REJECTED' end)::public.order_status);
      v_count := v_count + 1;
    end loop;
  end loop;

  return json_build_object('storeId', v_store, 'orders', v_count);
end $$;
revoke execute on function public.demo_bootstrap_store(uuid, text, text, text, text, text, integer, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.demo_bootstrap_store(uuid, text, text, text, text, text, integer, integer, integer, jsonb) to service_role;

-- 데모 회원. auth 계정은 seed 가 user_metadata.role='customer' 로 만들어 트리거가 customers 행을 만든다.
create or replace function public.demo_bootstrap_customer(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.customers;
  v_addr   uuid;
  v_store  uuid;
  o        public.orders;
  r        record;
  v_count  integer := 0;
begin
  select * into c from public.customers where id = p_user_id;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001'; end if;

  insert into public.addresses (customer_id, label, road_address, detail, is_default)
  values (p_user_id, '집', '서울 마포구 연남로 12', '101동 1203호', true) returning id into v_addr;
  insert into public.addresses (customer_id, label, road_address, detail, is_default)
  values (p_user_id, '회사', '서울 마포구 월드컵북로 396', '누리꿈스퀘어 7층', false);

  insert into public.payment_methods (customer_id, brand, last4, expiry, alias, is_default)
  values (p_user_id, '신한', '1234', '12/28', '주로 쓰는 카드', true),
         (p_user_id, '현대', '5678', '03/27', '', false);

  -- 찜: 첫 두 가게
  insert into public.favorites (customer_id, store_id)
  select p_user_id, s.id from public.stores s where s.login_id in ('owner01', 'owner03');

  -- 지난 주문 6건: 완료 5 + 거절 1. 여러 가게에 걸쳐서
  for r in
    select s.id as store_id, t.days_ago, t.st::public.order_status as st
      from (values ('owner01', 1, 'COMPLETED'), ('owner03', 3, 'COMPLETED'), ('owner01', 5, 'REJECTED'),
                   ('owner04', 7, 'COMPLETED'), ('owner02', 10, 'COMPLETED'), ('owner05', 16, 'COMPLETED')) as t(login, days_ago, st)
      join public.stores s on s.login_id = t.login
  loop
    o := public._demo_insert_order(r.store_id, now() - make_interval(days => r.days_ago, hours => 2), r.st);
    update public.orders
       set customer_id = p_user_id, customer_name = c.name, customer_phone = c.phone,
           address = '서울 마포구 연남로 12', address_detail = '101동 1203호',
           card_label = '신한카드 ****1234'
     where id = o.id;
    v_count := v_count + 1;
  end loop;

  -- 오늘 진행중 주문 1건 (연남 소반, 조리중) — 주문 상태 추적 화면 시연용
  select id into v_store from public.stores where login_id = 'owner01';
  o := public._demo_insert_order(v_store, now() - interval '12 minutes', 'ACCEPTED', 'DELIVERY');
  update public.orders
     set customer_id = p_user_id, customer_name = c.name, customer_phone = c.phone,
         address = '서울 마포구 연남로 12', address_detail = '101동 1203호', card_label = '신한카드 ****1234'
   where id = o.id;

  return json_build_object('customerId', p_user_id, 'orders', v_count + 1);
end $$;
revoke execute on function public.demo_bootstrap_customer(uuid) from public, anon, authenticated;
grant execute on function public.demo_bootstrap_customer(uuid) to service_role;
