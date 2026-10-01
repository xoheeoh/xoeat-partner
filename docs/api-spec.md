# Xoeat Partner — API 명세

앱(`apps/mobile`)이 연동 기준으로 삼는 명세입니다. 화면은 이 문서의 응답 모양만 알고, 실제 호출은
`src/svc/apis/*` 어댑터가 담당합니다. 서버 구현(`supabase/`)이 바뀌어도 이 계약이 같으면 화면은 그대로 동작합니다.

## 공통

### 인증

- 로그인: 아이디 + 비밀번호. 어댑터가 아이디를 `${loginId}@demo.xoeat.app` 로 바꿔 Supabase Auth 에 보낸다.
- 가맹점 계정은 플랫폼이 발급한다 (회원가입 없음). 데모 계정은 `scripts/seed-demo.mjs` 가 만든다.
- 세션 토큰은 네이티브는 SecureStore(Keychain/Keystore), 웹은 localStorage 에 저장되고 자동 갱신된다.

### 응답 모양

어댑터는 모든 호출을 아래 모양으로 돌려준다.

```ts
type ApiResult<T> = { resultCd: string; resultMsg: string } & Partial<T>;
// 성공: resultCd '0000'
// 실패: resultCd = 서버 오류 코드 (아래 표), resultMsg = 화면에 보여줄 문구
```

### 오류 코드

| 코드 | 뜻 | 발생 지점 |
|---|---|---|
| `UNAUTHENTICATED` | 세션 없음·만료 | 모든 호출 |
| `invalid_credentials` | 아이디/비밀번호 불일치 | 로그인 |
| `STORE_NOT_FOUND` | 로그인 계정에 가게가 없음 | 가게 조회·상태 변경 |
| `ORDER_NOT_FOUND` | 내 가게 주문이 아니거나 없음 | 주문 상태 변경 |
| `INVALID_TRANSITION` | 현재 상태에서 허용되지 않는 전이 | 수락·거절·취소·진행 |
| `COOKING_MINUTES_REQUIRED` | 배달 주문을 조리시간 없이 수락 | 수락 |
| `SELF_DELIVERY_NOT_ENABLED` | 자체 배달이 꺼진 가게에서 자체 배달 수락 | 수락 |
| `REASON_REQUIRED` | 거절·취소 사유 없음 | 거절·취소 |
| `STORE_PAUSED` | 영업 일시중지 중 주문 생성 | 데모 주문 |
| `NO_MENU_ON_SALE` | 판매중 메뉴가 없어 주문 생성 불가 | 데모 주문 |
| `TOO_MANY_REQUESTS` | 1분에 10건 초과 | 데모 주문 |
| `23505` | 유니크 충돌 (같은 이름 등) | 메뉴·카테고리 저장 |
| `NETWORK` | 네트워크 오류 | 모든 호출 |

문구 매핑은 `apps/mobile/src/svc/apis/client.ts` 한 곳에 있다.

---

## 1. 가게 (`storeApi`)

### `getMyStore()` → `{ store: Store }`

로그인한 사장님의 가게 1개. RLS 로 본인 가게만 조회된다.

```ts
interface Store {
  id: string; loginId: string; name: string; categoryCd: string;
  intro: string; originInfo: string; phone: string; address: string;
  bizNo: string; repName: string; imageUrl: string | null;
  minOrderAmount: number; deliveryFee: number;
  deliveryEnabled: boolean; pickupEnabled: boolean; selfDelivery: boolean;
  status: 'OPEN' | 'PAUSED';
  bankName: string; accountNo: string; accountHolder: string; feeRate: number; // %
}
```

### `updateStore(patch)` → `{ store }`

수정 가능한 컬럼만 (name, categoryCd, intro, originInfo, phone, imageUrl, minOrderAmount, deliveryFee,
deliveryEnabled, pickupEnabled, selfDelivery). 사업자·정산 정보와 `status` 는 직접 수정할 수 없다.

### `setStoreStatus('OPEN' | 'PAUSED')` → `{ store }`

RPC `set_store_status`. 일시중지 중에는 고객 앱(데모에서는 `demo_create_order`)이 주문을 만들 수 없다.

### `getStoreHours()` / `saveStoreHours(storeId, hours)`

```ts
interface StoreHour { dayOfWeek: 0..6 /* 월..일 */; enabled: boolean; openTime: 'HH:mm'; closeTime: 'HH:mm'; breakFrom: 'HH:mm' | null; breakTo: 'HH:mm' | null }
```
7개 요일을 한 번에 upsert 한다. 종료가 시작보다 이르면 다음날 새벽까지 영업으로 본다.

### `getDashboard()` → `{ summary }`

RPC `dashboard_summary`. 날짜는 Asia/Seoul 기준.
```ts
{ today: { sales, orderCount, pending, inProgress }, month: { sales, orderCount }, week: [{ date: 'yyyy-MM-dd', sales, orderCount } × 7] }
```
매출은 `COMPLETED` 주문의 `totalAmount` 합.

### `getSettlements('yyyy-MM')` → `{ settlements }`

뷰 `settlements` (완료 주문의 완료일 기준 일 단위 집계).
```ts
{ settleDate, orderCount, salesAmount, fee, vat, payoutAmount, payoutDate, status: 'SCHEDULED' | 'PAID' }
```
`fee = round(sales × feeRate%)`, `vat = round(fee × 10%)`, `payout = sales − fee − vat`, 입금일 = 완료일 + 2일.

### `getNotices()` → `{ notices }`

---

## 2. 메뉴 (`menuApi`)

메뉴·카테고리·옵션은 사장님이 직접 CRUD 한다 (PostgREST + RLS). 모든 행은 `store_id = 내 가게` 로 제한된다.

### 카테고리

- `getCategories()` → `{ categories: { id, name, sortOrder }[] }`
- `saveCategories(storeId, items, removedIds)` — 배열 순서가 곧 `sortOrder`. `id` 없는 항목은 생성, `removedIds` 는 삭제.
  삭제된 카테고리의 메뉴는 `categoryId = null`(미분류)이 된다.

### 메뉴

```ts
interface Menu {
  id; categoryId: string | null; categoryName: string | null;
  name; description; standard; price: number; imageUrl: string | null;
  saleStatus: 'ON_SALE' | 'SOLD_OUT' | 'HIDDEN'; adultOnly: boolean; sortOrder: number;
  optionGroupIds: string[]; updatedAt: string;
}
```
- `getMenus()` / `getMenu(id)`
- `createMenu(storeId, input)` / `updateMenu(storeId, id, input)` — `optionGroupIds` 는 `menu_option_groups` 를 전부 지우고 다시 넣는다.
- `setMenuSaleStatus(id, status)` — 목록에서 바로 품절·숨김 처리
- `deleteMenu(id)` — 지난 주문의 `order_items.menu_name` 은 남고 `menu_id` 만 null 이 된다.
- `uploadMenuImage(storeId, localUri, mimeType)` → `{ imageUrl }` — Storage 버킷 `menu-images/${storeId}/…`. 공개 읽기, 쓰기는 내 가게 폴더만.

### 옵션 그룹

```ts
interface OptionGroup { id; name; required: boolean; minSelect; maxSelect; sortOrder; options: Option[]; menuCount: number }
interface Option { id; name; price; soldOut: boolean; sortOrder }
```
- `getOptionGroups()` / `getOptionGroup(id)`
- `createOptionGroup(storeId, input)` / `updateOptionGroup(id, input)` — `options` 는 id 있는 것은 갱신, 없는 것은 생성, 빠진 것은 삭제. `menuIds` 로 연결 메뉴를 통째로 교체.
- `deleteOptionGroup(id)` — 연결된 메뉴에서 옵션이 사라진다.
- `setOptionSoldOut(optionId, soldOut)`

---

## 3. 주문 (`orderApi`)

주문은 **조회만 직접** 하고, 상태 변경은 **반드시 RPC** 를 거친다. 앱은 `orders` 에 UPDATE 권한이 없다.

```ts
interface Order {
  id; orderNo: 'X261001-0012'; orderType: 'DELIVERY' | 'PICKUP';
  status: 'PENDING' | 'ACCEPTED' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'REJECTED' | 'CANCELED';
  customerName; customerPhone; address: string | null; addressDetail: string | null; requestMemo;
  itemsAmount; deliveryFee; totalAmount; paymentMethod: 'CARD';
  cookingMinutes: number | null; selfDelivery: boolean; rejectReason: string | null;
  acceptedAt; readyAt; deliveringAt; completedAt; canceledAt; createdAt;
  items: { id; menuName; quantity; unitPrice; options: { groupName; name; price }[]; lineAmount }[];
}
```

### 상태 전이

```
PENDING ──accept──▶ ACCEPTED ──(포장) advance──▶ READY ──advance──▶ COMPLETED
   │                   │
   │                   └──(배달) advance──▶ DELIVERING ──advance──▶ COMPLETED
   │                   └──cancel──▶ CANCELED            (READY 에서도 cancel 가능)
   └──reject──▶ REJECTED
```

| 어댑터 | RPC | 규칙 |
|---|---|---|
| `acceptOrder(id, { cookingMinutes?, selfDelivery? })` | `accept_order` | PENDING 만. 배달 주문은 `cookingMinutes` 또는 `selfDelivery=true` 필요. 자체 배달은 가게 `selfDelivery` 가 켜져 있어야 함 |
| `rejectOrder(id, reason)` | `reject_order` | PENDING 만. 사유 필수 |
| `cancelOrder(id, reason)` | `cancel_order` | ACCEPTED·READY 만. 사유 필수 |
| `advanceOrder(id)` | `advance_order` | 위 그림의 다음 단계로. 그 외는 `INVALID_TRANSITION` |

모두 변경된 주문 전체(`{ order }`)를 돌려준다. 같은 주문에 두 번 요청하면 두 번째는 `INVALID_TRANSITION` 이다.

### 조회

- `getTodayOrders(tab)` — 오늘(로컬 자정 기준) 주문. `tab`: `PENDING` | `ING`(ACCEPTED·READY·DELIVERING) | `COMPLETED` | `CLOSED`(REJECTED·CANCELED). 접수대기는 오래된 순, 나머지는 최신순.
- `getTodayCounts()` → `{ counts: Record<tab, number> }` — RPC `order_counts`
- `getOrder(id)`
- `getOrderHistory(fromYmd, toYmd, statuses?)` — 최신순 최대 200건

### Realtime

`subscribeOrders(cb)` — `orders` 테이블의 INSERT·UPDATE 를 구독한다. RLS 가 적용되어 내 가게 행만 온다.
앱은 INSERT + `status = PENDING` 이면 알림음·토스트를 띄우고, 어떤 이벤트든 건수와 현재 목록을 다시 읽는다.
Realtime 페이로드에는 `order_items` 가 없으므로 상세는 다시 조회한다.

### 데모 전용

- `createDemoOrder(type?)` — RPC `demo_create_order`. 고객 앱 대신 판매중 메뉴로 가짜 주문 1건을 만든다. 영업 일시중지 중에는 `STORE_PAUSED`, 1분 10건 초과는 `TOO_MANY_REQUESTS`.
