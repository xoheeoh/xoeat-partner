# 데모 API 서버 (Supabase)

`apps/mobile`(사장님 앱)과 [xoeat-customer](https://github.com/xoheeoh/xoeat-customer)(구매자 앱)를 실제로 동작시키기 위한 백엔드 대역입니다.
두 앱이 같은 프로젝트를 쓰고, 역할은 RLS 로 나뉩니다 — 가게 소유자(`stores.owner_id`)와 회원(`customers.id`).

이 프로젝트는 프론트엔드 포트폴리오이고, 실무에서는 백엔드 팀이 담당하는 부분(DB, 서버 로직)을
대신할 서버가 필요해 **AI 도구로 생성**했습니다. 앱은 [`docs/api-spec.md`](../docs/api-spec.md) 의
명세만 보고 연동했으며, 이 폴더의 내부 구현은 프로젝트가 보여주려는 역량 범위에 들어가지 않습니다.

---

## 구성

```
supabase/
  migrations/
    20261001000000_schema.sql   테이블 · 열거형 · Realtime 퍼블리케이션
    20261001000100_rls.sql      RLS 정책 · 권한 · Storage 버킷/정책
    20261001000200_domain.sql   주문 상태 전이 RPC · 영업 상태 · 대시보드 · 정산 뷰
    20261001000300_demo.sql     데모 주문 생성 · 데모 가게 부트스트랩
    20261002000000_customer.sql 회원 · 배송지 · 결제수단 · 찜 · place_order / cancel_my_order · 구매자 RLS
    20261002000100_customer_demo.sql  추가 가게(메뉴 JSON) · 데모 회원 부트스트랩
  seed.sql                      공지사항
  config.toml                   로컬 스택 설정 (구매자 회원가입 허용, 이메일 확인 없음)
scripts/
  seed-demo.mjs                 사장님 6 · 회원 2 생성 (서비스 롤)
  test.sql · verify.sh          서버 시나리오 테스트 64건
```

앱이 호출하는 방식은 두 가지입니다.

| 용도 | 경로 | 예 |
| --- | --- | --- |
| 조회 · 메뉴 CRUD | PostgREST (`/rest/v1/...`) | 가게, 메뉴, 옵션, 주문 목록, 정산 뷰 |
| 주문 상태 변경 · 집계 | RPC (`/rest/v1/rpc/...`) | `accept_order`, `reject_order`, `advance_order`, `dashboard_summary` |
| 구매자 주문 생성·취소 | RPC | `place_order`, `cancel_my_order` |
| 새 주문 알림 | Realtime (`/realtime/v1`) | `orders` INSERT/UPDATE |
| 이미지 | Storage (`/storage/v1`) | 버킷 `menu-images` |

## 데이터 모델

```
stores ─1:N─ store_hours
   ├─1:N─ menu_categories ─1:N─ menus ─N:M─ option_groups ─1:N─ options
   └─1:N─ orders ─1:N─ order_items
                 └─N:1─ customers ─1:N─ addresses · payment_methods · favorites
settlements (뷰: 완료 주문을 완료일 기준으로 집계)
notices
```

## 서버가 보장하는 것 (앱이 기대하는 계약)

| 계약 | 앱에서 의존하는 곳 |
| --- | --- |
| 주문 상태 전이는 RPC 만 가능하고, 허용되지 않는 전이는 `INVALID_TRANSITION` | `OrderActions` 가 실패 시 토스트 후 목록 새로고침 |
| 배달 주문 수락에는 조리시간 또는 자체 배달 중 하나가 필요 | 수락 바텀시트 |
| 모든 테이블은 RLS 로 내 가게 행만 보인다 | 쿼리에 `store_id` 필터를 넣지 않음, Realtime 도 필터 없이 구독 |
| `settlements` 뷰는 `security_invoker` 라 RLS 가 그대로 적용 | 정산 화면 |
| `demo_create_order` 는 영업 일시중지 중 `STORE_PAUSED`, 1분 10건 초과 `TOO_MANY_REQUESTS` | 홈 데모 버튼 |
| 이미지는 `menu-images/<store_id>/...` 경로만 쓸 수 있고 읽기는 공개 | `uploadMenuImage` |
| 구매자는 가게·메뉴를 읽기만 하고(숨김 메뉴 제외), 주문은 `place_order` 가 금액·옵션 규칙을 다시 계산해 만든다 | 구매자 앱 장바구니·결제 |
| 구매자는 자기 주문만 보고 `PENDING` 일 때만 취소할 수 있다 | 구매자 앱 주문 상세 |

## 검증

`scripts/test.sql` 이 64개 시나리오(RLS 격리, 상태 전이 7종, 조리시간 필수, 사유 필수, 자체 배달,
영업 일시중지, 대시보드, 메뉴 CRUD, 직접 UPDATE 차단, 남의 주문 접근 차단, 회원 가입 트리거, 구매자 주문 생성의
검증 9종과 금액 계산, 구매자 취소, 사장님이 구매자 주문을 수락)를 검사합니다.

```bash
npm run db:test                                   # 로컬 Supabase 스택
PGURL=postgres://... ./scripts/verify.sh --shim   # 순정 Postgres (auth/storage 대역 포함)
```

## 교체 지점

| 기능 | 현재 | 실제 서비스라면 |
| --- | --- | --- |
| 주문 유입 | 구매자 앱 `place_order` / `demo_create_order` | 실제 PG 승인 후 주문 확정 (Edge Function) |
| 고객 알림(수락·거절·픽업 안내) | 없음 | 상태 변경 트리거 → 알림톡/푸시 |
| 사장님 백그라운드 푸시 | 없음 (Realtime 만) | `orders` INSERT 트리거 → Expo Push |
| 정산 | 뷰로 즉시 계산 | 일 배치로 `settlements` 테이블 적재 + 실제 이체 |
