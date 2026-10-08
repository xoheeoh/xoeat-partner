-- ── 구매자 회원탈퇴 ──────────────────────────────────────────────────
-- 로그인한 구매자가 자기 계정을 지운다. 앱은 auth.users 를 직접 지울 권한이 없으므로 서버 함수가 대신한다.
-- auth.users 행이 지워지면 customers → addresses / payment_methods / favorites 가 연쇄 삭제되고,
-- orders.customer_id 는 null 로 남아 가게 쪽 주문·정산 기록은 유지된다 (20261002000000_customer.sql 의 외래키 설정).
--
-- 진행 중인 주문(접수 대기·접수됨·준비 완료·배달 중)이 있으면 막는다. 가게가 조리 중인데 주문자가 사라지면 안 되기 때문.
-- 비밀번호 재확인은 앱이 탈퇴 직전에 다시 로그인해 보는 방식으로 한다 (이 함수는 로그인된 사용자만 호출 가능).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.customers where id = uid) then
    raise exception 'NOT_A_CUSTOMER' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.orders
     where customer_id = uid and status in ('PENDING', 'ACCEPTED', 'READY', 'DELIVERING')
  ) then
    raise exception 'ACTIVE_ORDER_EXISTS' using errcode = 'P0001';
  end if;

  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
