-- =====================================================================
-- Xoeat Partner Demo — 스키마
--
-- 배달 플랫폼의 "가맹점(사장님) 앱"이 쓰는 최소 모델.
--   stores ─1:N─ menu_categories ─1:N─ menus ─N:M─ option_groups ─1:N─ options
--   stores ─1:N─ orders ─1:N─ order_items
--   stores ─1:N─ store_hours
-- 주문은 고객 앱(이 데모에는 없음)이 만들고, 사장님 앱은 상태만 바꾼다.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── 열거형 ──────────────────────────────────────────────────────────
create type public.store_status as enum ('OPEN', 'PAUSED');
create type public.sale_status  as enum ('ON_SALE', 'SOLD_OUT', 'HIDDEN');
create type public.order_type   as enum ('DELIVERY', 'PICKUP');
create type public.order_status as enum (
  'PENDING',     -- 접수대기: 사장님 수락/거절 전
  'ACCEPTED',    -- 조리중: 수락됨 (배달이면 예상 조리시간 포함)
  'READY',       -- 준비완료: 포장 주문이 픽업 가능
  'DELIVERING',  -- 배달중
  'COMPLETED',   -- 완료
  'REJECTED',    -- 거절: 접수대기에서 사장님이 거절
  'CANCELED'     -- 취소: 수락 후 사장님이 취소
);

-- ── 가게 ────────────────────────────────────────────────────────────
create table public.stores (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null unique references auth.users(id) on delete cascade,
  login_id         text not null unique,
  name             text not null,
  category_cd      text not null default 'KOREAN_FOOD',
  intro            text not null default '',
  origin_info      text not null default '',
  phone            text not null default '',
  address          text not null default '',
  biz_no           text not null default '',
  rep_name         text not null default '',
  image_url        text,
  min_order_amount integer not null default 0 check (min_order_amount >= 0),
  delivery_fee     integer not null default 0 check (delivery_fee >= 0),
  delivery_enabled boolean not null default true,
  pickup_enabled   boolean not null default true,
  self_delivery    boolean not null default false,   -- 자체 배달 사용 여부 (수락 시 "자체 배달" 선택지가 생긴다)
  status           public.store_status not null default 'OPEN',
  bank_name        text not null default '',
  account_no       text not null default '',
  account_holder   text not null default '',
  fee_rate         numeric(4,2) not null default 3.30,  -- 플랫폼 수수료(%)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.store_hours (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=월 … 6=일
  enabled     boolean not null default true,
  open_time   time not null default '10:00',
  close_time  time not null default '22:00',
  break_from  time,
  break_to    time,
  unique (store_id, day_of_week)
);

-- ── 메뉴 ────────────────────────────────────────────────────────────
create table public.menu_categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null check (length(name) between 1 and 30),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.menus (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name        text not null check (length(name) between 1 and 60),
  description text not null default '',
  standard    text not null default '',          -- 규격 (예: 1인분, 600ml)
  price       integer not null check (price >= 0),
  image_url   text,
  sale_status public.sale_status not null default 'ON_SALE',
  adult_only  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index menus_store_idx on public.menus(store_id, sort_order);

create table public.option_groups (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null check (length(name) between 1 and 40),
  required   boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (min_select <= max_select)
);

create table public.options (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.option_groups(id) on delete cascade,
  name       text not null check (length(name) between 1 and 40),
  price      integer not null default 0 check (price >= 0),
  sold_out   boolean not null default false,
  sort_order integer not null default 0
);
create index options_group_idx on public.options(group_id, sort_order);

create table public.menu_option_groups (
  menu_id    uuid not null references public.menus(id) on delete cascade,
  group_id   uuid not null references public.option_groups(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (menu_id, group_id)
);

-- ── 주문 ────────────────────────────────────────────────────────────
create sequence public.order_no_seq;

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  order_no        text not null unique,
  order_type      public.order_type not null,
  status          public.order_status not null default 'PENDING',
  customer_name   text not null,
  customer_phone  text not null,
  address         text,                 -- 배달 주문만
  address_detail  text,
  request_memo    text not null default '',
  items_amount    integer not null check (items_amount >= 0),
  delivery_fee    integer not null default 0 check (delivery_fee >= 0),
  total_amount    integer not null check (total_amount >= 0),
  payment_method  text not null default 'CARD',
  cooking_minutes integer,              -- 수락 시 선택한 예상 조리시간. 자체 배달이면 null 이고 self_delivery=true
  self_delivery   boolean not null default false,
  reject_reason   text,                 -- 거절·취소 사유
  accepted_at     timestamptz,
  ready_at        timestamptz,
  delivering_at   timestamptz,
  completed_at    timestamptz,
  canceled_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index orders_store_status_idx on public.orders(store_id, status, created_at desc);
create index orders_store_created_idx on public.orders(store_id, created_at desc);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  menu_id     uuid references public.menus(id) on delete set null,
  menu_name   text not null,
  quantity    integer not null check (quantity > 0),
  unit_price  integer not null check (unit_price >= 0),
  -- [{ groupName, name, price }]
  options     jsonb not null default '[]'::jsonb,
  line_amount integer not null check (line_amount >= 0)
);
create index order_items_order_idx on public.order_items(order_id);

-- ── 공지 (앱 상단 벨 아이콘) ───────────────────────────────────────
create table public.notices (
  id         bigint generated always as identity primary key,
  kind       text not null default 'NEWS',   -- NEWS | UPDATE | EVENT | MAINTENANCE
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ── updated_at 자동 갱신 ───────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger stores_touch before update on public.stores
  for each row execute function public.touch_updated_at();
create trigger menus_touch before update on public.menus
  for each row execute function public.touch_updated_at();

-- ── Realtime: 사장님 앱이 새 주문·상태 변경을 구독한다 ─────────────
alter publication supabase_realtime add table public.orders;
alter table public.orders replica identity full;
