-- ── 기본 배송지·기본 결제수단 자동 승계 ─────────────────────────────────
-- 회원당 기본은 최대 1개(부분 유니크 인덱스)지만 "최소 1개"는 보장되지 않았다.
-- 기본으로 지정된 줄을 지우면 아무것도 기본이 아닌 상태가 되어, 사용자가 다시 지정해야 했다.
--
-- 이 트리거는 "줄이 하나라도 있으면 기본도 하나 있다"를 서버에서 보장한다.
-- - 삭제 뒤: 지운 줄이 기본이었고 남은 줄이 있으면, 가장 먼저 등록한 줄을 기본으로 올린다.
-- - 추가 뒤: 기본이 하나도 없으면 방금 추가한 줄을 기본으로 올린다 (첫 등록 때 "기본으로 설정"을 끄고 저장해도 기본이 비지 않게).
-- 사용자가 다른 줄을 기본으로 바꾸고 싶으면 기존대로 set_default_* 함수를 쓰면 된다.
--
-- 두 테이블 구조가 같아 하나의 함수를 공유하고, TG_TABLE_NAME 으로 테이블을 고른다.

create or replace function public.ensure_default_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := coalesce(new.customer_id, old.customer_id);
  v_has_default boolean;
  v_fallback uuid;
begin
  -- 삭제인데 지운 줄이 기본이 아니었으면 할 일 없음
  if tg_op = 'DELETE' and not old.is_default then
    return old;
  end if;

  execute format('select exists (select 1 from public.%I where customer_id = $1 and is_default)', tg_table_name)
    into v_has_default using v_customer;
  if v_has_default then
    return coalesce(new, old);
  end if;

  -- 기본이 없다: 가장 먼저 등록한 줄(추가 직후라면 그 줄 자신)을 기본으로
  execute format('select id from public.%I where customer_id = $1 order by created_at asc, id asc limit 1', tg_table_name)
    into v_fallback using v_customer;
  if v_fallback is not null then
    execute format('update public.%I set is_default = true where id = $1', tg_table_name) using v_fallback;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists addresses_ensure_default on public.addresses;
create trigger addresses_ensure_default
  after insert or delete on public.addresses
  for each row execute function public.ensure_default_exists();

drop trigger if exists payment_methods_ensure_default on public.payment_methods;
create trigger payment_methods_ensure_default
  after insert or delete on public.payment_methods
  for each row execute function public.ensure_default_exists();
