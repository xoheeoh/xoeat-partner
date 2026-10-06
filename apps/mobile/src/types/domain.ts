/**
 * 화면이 다루는 도메인 타입. docs/api-spec.md 의 응답 모양과 같다.
 * 서버 컬럼(snake_case)은 svc/apis 어댑터가 이 모양(camelCase)으로 바꿔 준다.
 */

export type StoreStatus = 'OPEN' | 'PAUSED';
export type SaleStatus = 'ON_SALE' | 'SOLD_OUT' | 'HIDDEN';
export type OrderType = 'DELIVERY' | 'PICKUP';
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'REJECTED' | 'CANCELED';

export interface Store {
  id: string;
  loginId: string;
  name: string;
  categoryCd: string;
  intro: string;
  originInfo: string;
  phone: string;
  address: string;
  bizNo: string;
  repName: string;
  imageUrl: string | null;
  minOrderAmount: number;
  deliveryFee: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  status: StoreStatus;
  bankName: string;
  accountNo: string;
  accountHolder: string;
  feeRate: number;
}

/** 수정 가능한 가게 정보 (StoreInfoEdit 화면) */
export type StoreEditable = Pick<
  Store,
  | 'name'
  | 'categoryCd'
  | 'intro'
  | 'originInfo'
  | 'phone'
  | 'imageUrl'
  | 'minOrderAmount'
  | 'deliveryFee'
  | 'deliveryEnabled'
  | 'pickupEnabled'
>;

export interface StoreHour {
  dayOfWeek: number; // 0=월 … 6=일
  enabled: boolean;
  openTime: string; // 'HH:mm'
  closeTime: string;
  breakFrom: string | null;
  breakTo: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Menu {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  description: string;
  standard: string;
  price: number;
  imageUrl: string | null;
  saleStatus: SaleStatus;
  adultOnly: boolean;
  sortOrder: number;
  optionGroupIds: string[];
  updatedAt: string;
}

export type MenuInput = Omit<Menu, 'id' | 'categoryName' | 'updatedAt' | 'sortOrder'>;

export interface Option {
  id: string;
  name: string;
  price: number;
  soldOut: boolean;
  sortOrder: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: Option[];
  /** 이 그룹을 쓰는 메뉴 수 (목록 표시용) */
  menuCount: number;
}

export interface OptionGroupInput {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: (Pick<Option, 'name' | 'price' | 'soldOut'> & { id?: string })[];
  menuIds: string[];
}

export interface OrderItemOption {
  groupName: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  options: OrderItemOption[];
  lineAmount: number;
}

export interface Order {
  id: string;
  orderNo: string;
  orderType: OrderType;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  address: string | null;
  addressDetail: string | null;
  requestMemo: string;
  itemsAmount: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: string;
  cookingMinutes: number | null;
  rejectReason: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  deliveringAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface DashboardSummary {
  today: { sales: number; orderCount: number; pending: number; inProgress: number };
  month: { sales: number; orderCount: number };
  /** 이번 달 1일 ~ 오늘, 하루 한 줄 */
  monthDays: DailySales[];
}

export interface DailySales {
  date: string; // yyyy-MM-dd
  sales: number;
  orderCount: number;
}

export interface Settlement {
  settleDate: string; // yyyy-MM-dd
  orderCount: number;
  salesAmount: number;
  fee: number;
  vat: number;
  payoutAmount: number;
  payoutDate: string;
  status: 'SCHEDULED' | 'PAID';
}

export interface Notice {
  id: number;
  kind: 'NEWS' | 'UPDATE' | 'EVENT' | 'MAINTENANCE';
  title: string;
  body: string;
  createdAt: string;
}

/** 알림함 한 줄. 서버 트리거가 만들고 앱은 읽기·읽음 처리만 한다 */
export interface AppNotification {
  id: number;
  kind: 'NEW_ORDER' | 'ORDER_CANCELED' | 'NOTICE';
  title: string;
  body: string;
  /** 누르면 갈 주문 (NEW_ORDER · ORDER_CANCELED) */
  orderId: string | null;
  /** 누르면 갈 공지 (NOTICE) */
  noticeId: number | null;
  readAt: string | null;
  createdAt: string;
}

/** 주문 목록 탭. ING 는 ACCEPTED·READY·DELIVERING 을 묶은 값 */
export type OrderTab = 'PENDING' | 'ING' | 'COMPLETED' | 'CLOSED';
