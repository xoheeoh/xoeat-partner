-- =====================================================================
-- 서버 시나리오 테스트. 마이그레이션 + 시드가 적용된 DB 에서 실행한다 (scripts/verify.sh).
-- 모든 검사는 트랜잭션 안에서 돌고 끝에 롤백되므로 데이터가 남지 않는다.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

-- 테스트용 사장님 2명
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 't-owner01@demo.xoeat.app'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 't-owner02@demo.xoeat.app');
select public.demo_bootstrap('aaaaaaaa-0000-0000-0000-000000000001', 't-owner01', '테스트 가게 1');
select public.demo_bootstrap('aaaaaaaa-0000-0000-0000-000000000002', 't-owner02', '테스트 가게 2');

create temp table t_result (no serial, name text, ok boolean);
grant all on t_result, t_result_no_seq to authenticated;

create or replace function pg_temp.check(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  insert into t_result (name, ok) values (p_name, p_ok);
  if not p_ok then raise notice 'FAIL: %', p_name; end if;
end $$;

-- 예외 코드가 기대와 같은지
create or replace function pg_temp.expect_error(p_name text, p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  perform pg_temp.check(p_name || ' (오류가 나야 함: ' || p_code || ')', false);
exception when others then
  perform pg_temp.check(p_name, sqlerrm = p_code);
end $$;

-- ── 1. 사장님 1 로 로그인 ─────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);

do $$
declare
  v_store uuid := public.my_store_id();
  v_other uuid;
  o public.orders;
  o2 public.orders;
  p public.orders;
begin
  perform pg_temp.check('내 가게 id 를 찾는다', v_store is not null);
  perform pg_temp.check('RLS: 가게는 내 것 1개만 보인다', (select count(*) from public.stores) = 1);
  perform pg_temp.check('RLS: 메뉴는 내 가게 것만 보인다', (select count(distinct store_id) from public.menus) = 1 and (select count(*) from public.menus) = 12);
  perform pg_temp.check('RLS: 주문은 내 가게 것만 보인다', (select count(*) from public.orders where store_id <> v_store) = 0);
  perform pg_temp.check('RLS: 정산 뷰도 내 가게만', (select count(*) from public.settlements where store_id <> v_store) = 0);

  -- 다른 가게 id 확보 (서비스 롤이 아니라 보이지 않으므로 함수 우회 없이 하드코딩된 소유자로 조회 불가 → 다음 섹션에서 검사)

  -- ── 주문 상태 전이 ───────────────────────────────────────────────
  select * into p from public.orders where status = 'PENDING' and order_type = 'DELIVERY' order by created_at limit 1;
  perform pg_temp.check('접수대기 배달 주문이 있다', p.id is not null);

  -- 배달 주문은 조리시간 없이 수락할 수 없다
  perform pg_temp.expect_error('배달 주문 수락: 조리시간 필수', format('select public.accept_order(%L)', p.id), 'COOKING_MINUTES_REQUIRED');

  o := public.accept_order(p.id, 20);
  perform pg_temp.check('수락 → ACCEPTED', o.status = 'ACCEPTED' and o.cooking_minutes = 20 and o.accepted_at is not null);

  perform pg_temp.expect_error('수락된 주문은 다시 수락 불가', format('select public.accept_order(%L, 10)', p.id), 'INVALID_TRANSITION');
  perform pg_temp.expect_error('수락된 주문은 거절 불가', format('select public.reject_order(%L, %L)', p.id, '재료 소진'), 'INVALID_TRANSITION');

  o := public.advance_order(p.id);
  perform pg_temp.check('배달 주문: ACCEPTED → DELIVERING', o.status = 'DELIVERING' and o.delivering_at is not null);
  o := public.advance_order(p.id);
  perform pg_temp.check('배달 주문: DELIVERING → COMPLETED', o.status = 'COMPLETED' and o.completed_at is not null);
  perform pg_temp.expect_error('완료된 주문은 더 진행 불가', format('select public.advance_order(%L)', p.id), 'INVALID_TRANSITION');
  perform pg_temp.expect_error('완료된 주문은 취소 불가', format('select public.cancel_order(%L, %L)', p.id, '고객 요청'), 'INVALID_TRANSITION');

  -- 포장 주문
  select * into p from public.orders where status = 'PENDING' and order_type = 'PICKUP' order by created_at limit 1;
  o := public.accept_order(p.id);
  perform pg_temp.check('포장 주문: 조리시간 없이 수락', o.status = 'ACCEPTED' and o.cooking_minutes is null);
  o := public.advance_order(p.id);
  perform pg_temp.check('포장 주문: ACCEPTED → READY', o.status = 'READY' and o.ready_at is not null);
  o := public.cancel_order(p.id, '고객 요청');
  perform pg_temp.check('준비완료 주문 취소 → CANCELED', o.status = 'CANCELED' and o.reject_reason = '고객 요청');

  -- 거절
  o := public.demo_create_order('DELIVERY');
  perform pg_temp.check('데모 주문 생성: 접수대기·배달', o.status = 'PENDING' and o.order_type = 'DELIVERY' and o.total_amount = o.items_amount + o.delivery_fee);
  perform pg_temp.check('데모 주문: 주문 항목이 있다', (select count(*) from public.order_items where order_id = o.id) >= 1);
  perform pg_temp.check('데모 주문: 항목 합계 = items_amount', (select sum(line_amount) from public.order_items where order_id = o.id) = o.items_amount);
  perform pg_temp.check('데모 주문: 최소 주문금액 이상', o.items_amount >= 12000);
  perform pg_temp.expect_error('거절 사유는 필수', format('select public.reject_order(%L, %L)', o.id, ' '), 'REASON_REQUIRED');
  o2 := public.reject_order(o.id, '영업 조기 마감');
  perform pg_temp.check('거절 → REJECTED', o2.status = 'REJECTED' and o2.reject_reason = '영업 조기 마감');

  -- 자체 배달
  o := public.demo_create_order('DELIVERY');
  o2 := public.accept_order(o.id, null, true);
  perform pg_temp.check('자체 배달 수락: 조리시간 없이 self_delivery', o2.status = 'ACCEPTED' and o2.self_delivery and o2.cooking_minutes is null);

  -- 영업 상태
  perform public.set_store_status('PAUSED');
  perform pg_temp.check('영업 일시중지', (select status from public.stores) = 'PAUSED');
  perform pg_temp.expect_error('일시중지 중에는 주문이 들어오지 않는다', 'select public.demo_create_order()', 'STORE_PAUSED');
  perform public.set_store_status('OPEN');
  perform pg_temp.check('영업 재개', (select status from public.stores) = 'OPEN');

  -- 대시보드
  perform pg_temp.check('대시보드: 7일 추이는 7개', json_array_length(public.dashboard_summary()->'week') = 7);
  perform pg_temp.check('대시보드: 오늘 매출 ≥ 0', (public.dashboard_summary()->'today'->>'sales')::int >= 0);

  -- ── 메뉴 CRUD (직접 쓰기 + RLS) ──────────────────────────────────
  insert into public.menu_categories (store_id, name, sort_order) values (v_store, '신메뉴', 9);
  perform pg_temp.check('카테고리 추가', (select count(*) from public.menu_categories where name = '신메뉴') = 1);
  insert into public.menus (store_id, category_id, name, price)
  select v_store, id, '테스트 메뉴', 5000 from public.menu_categories where name = '신메뉴';
  update public.menus set sale_status = 'SOLD_OUT' where name = '테스트 메뉴';
  perform pg_temp.check('메뉴 품절 처리', (select sale_status from public.menus where name = '테스트 메뉴') = 'SOLD_OUT');
  delete from public.menus where name = '테스트 메뉴';
  perform pg_temp.check('메뉴 삭제', (select count(*) from public.menus where name = '테스트 메뉴') = 0);

  -- 주문 테이블 직접 수정은 막혀 있다 (권한 없음)
  perform pg_temp.expect_error('주문 직접 UPDATE 불가', 'update public.orders set total_amount = 0', 'permission denied for table orders');
  perform pg_temp.expect_error('가게 상태 직접 UPDATE 불가(컬럼 권한)', 'update public.stores set status = ''PAUSED''', 'permission denied for table stores');
end $$;

-- ── 2. 사장님 2 로 바꿔서 남의 주문을 만질 수 없는지 ─────────────────
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
do $$
declare
  v_other_order uuid;
begin
  reset role;
  select o.id into v_other_order from public.orders o
   join public.stores s on s.id = o.store_id
   where s.login_id = 't-owner01' and o.status = 'PENDING' limit 1;
  set role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);

  perform pg_temp.check('RLS: 남의 주문은 보이지 않는다', (select count(*) from public.orders where id = v_other_order) = 0);
  perform pg_temp.expect_error('남의 주문 수락 불가', format('select public.accept_order(%L, 10)', v_other_order), 'ORDER_NOT_FOUND');
  perform pg_temp.check('RLS: 남의 메뉴에 카테고리를 넣을 수 없다',
    (select count(*) from public.menu_categories) = 4);
end $$;

reset role;

-- ── 결과 ─────────────────────────────────────────────────────────────
select no, case when ok then 'PASS' else 'FAIL' end as result, name from t_result order by no;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t_result;
do $$ begin
  if exists (select 1 from t_result where not ok) then
    raise exception '실패한 테스트가 있습니다';
  end if;
end $$;

rollback;
