-- =====================================================================
-- Xoeat Partner Demo — 행 수준 보안 (RLS)
--
-- 방침
--   · 로그인한 사장님은 "내 가게" 행만 본다. 가게는 owner_id = auth.uid() 로 판단한다.
--   · 메뉴·카테고리·옵션은 사장님이 직접 CRUD 한다 (테이블 쓰기 허용 + RLS).
--   · 주문은 조회만 직접 하고, 상태 변경은 반드시 RPC(domain.sql)를 거친다.
--     → 완료된 주문의 금액을 앱이 임의로 바꿀 수 없다.
-- =====================================================================

-- 내 가게 id. 정책 안에서 반복 서브쿼리를 피하기 위해 stable 함수로 둔다.
create or replace function public.my_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.stores s where s.owner_id = auth.uid() limit 1
$$;
grant execute on function public.my_store_id() to authenticated;

alter table public.stores             enable row level security;
alter table public.store_hours        enable row level security;
alter table public.menu_categories    enable row level security;
alter table public.menus              enable row level security;
alter table public.option_groups      enable row level security;
alter table public.options            enable row level security;
alter table public.menu_option_groups enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.notices            enable row level security;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.stores, public.orders, public.order_items, public.notices to authenticated;
grant update (name, category_cd, intro, origin_info, phone, image_url,
              min_order_amount, delivery_fee, delivery_enabled, pickup_enabled, self_delivery)
  on public.stores to authenticated;

grant select, insert, update, delete on
  public.store_hours,
  public.menu_categories,
  public.menus,
  public.option_groups,
  public.options,
  public.menu_option_groups
to authenticated;

grant usage on sequence public.order_no_seq to authenticated;

-- ── 가게 ─────────────────────────────────────────────────────────────
create policy stores_select_own on public.stores
  for select to authenticated using (owner_id = (select auth.uid()));
create policy stores_update_own on public.stores
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy store_hours_all_own on public.store_hours
  for all to authenticated
  using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());

-- ── 메뉴 ─────────────────────────────────────────────────────────────
create policy menu_categories_all_own on public.menu_categories
  for all to authenticated
  using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());

create policy menus_all_own on public.menus
  for all to authenticated
  using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());

create policy option_groups_all_own on public.option_groups
  for all to authenticated
  using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());

create policy options_all_own on public.options
  for all to authenticated
  using (group_id in (select g.id from public.option_groups g where g.store_id = public.my_store_id()))
  with check (group_id in (select g.id from public.option_groups g where g.store_id = public.my_store_id()));

create policy menu_option_groups_all_own on public.menu_option_groups
  for all to authenticated
  using (menu_id in (select m.id from public.menus m where m.store_id = public.my_store_id()))
  with check (menu_id in (select m.id from public.menus m where m.store_id = public.my_store_id())
          and group_id in (select g.id from public.option_groups g where g.store_id = public.my_store_id()));

-- ── 주문 (조회만) ─────────────────────────────────────────────────────
create policy orders_select_own on public.orders
  for select to authenticated using (store_id = public.my_store_id());

create policy order_items_select_own on public.order_items
  for select to authenticated
  using (order_id in (select o.id from public.orders o where o.store_id = public.my_store_id()));

-- ── 공지 ─────────────────────────────────────────────────────────────
create policy notices_select_all on public.notices
  for select to authenticated using (true);

-- ── Storage: 메뉴 이미지 ──────────────────────────────────────────────
-- 버킷은 공개 읽기. 쓰기는 "내 가게 id" 폴더 아래에만 허용한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy menu_images_public_read on storage.objects
  for select to public using (bucket_id = 'menu-images');

create policy menu_images_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-images' and (storage.foldername(name))[1] = public.my_store_id()::text);

create policy menu_images_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images' and (storage.foldername(name))[1] = public.my_store_id()::text);

create policy menu_images_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images' and (storage.foldername(name))[1] = public.my_store_id()::text);
