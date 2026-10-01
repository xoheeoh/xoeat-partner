import type { OrderStatus, OrderType, SaleStatus } from '@typ/domain';
import type { BadgeTone } from '@components/common/Badge';

/** 가게 업종 */
export const STORE_CATEGORIES: { code: string; label: string }[] = [
  { code: 'KOREAN_FOOD', label: '한식' },
  { code: 'CHICKEN', label: '치킨' },
  { code: 'PIZZA', label: '피자' },
  { code: 'BURGER', label: '햄버거' },
  { code: 'SNACK_BAR', label: '분식' },
  { code: 'CHINESE_FOOD', label: '중식' },
  { code: 'JAPANESE_FOOD', label: '돈까스/일식' },
  { code: 'WESTERN_FOOD', label: '양식/아시안' },
  { code: 'BOSSAM', label: '족발/보쌈' },
  { code: 'STEW', label: '찜/탕' },
  { code: 'SEAFOOD', label: '회/해물' },
  { code: 'NIGHT_FOOD', label: '야식' },
  { code: 'CAFE_DESSERT', label: '커피/디저트' },
];
export const categoryLabel = (code: string) => STORE_CATEGORIES.find((c) => c.code === code)?.label ?? code;

/** 주문 상태 표시 */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: '접수대기', tone: 'orange' },
  ACCEPTED: { label: '조리중', tone: 'blue' },
  READY: { label: '준비완료', tone: 'green' },
  DELIVERING: { label: '배달중', tone: 'purple' },
  COMPLETED: { label: '완료', tone: 'gray' },
  REJECTED: { label: '거절', tone: 'red' },
  CANCELED: { label: '취소', tone: 'red' },
};

export const ORDER_TYPE: Record<OrderType, { label: string; tone: BadgeTone }> = {
  DELIVERY: { label: '배달', tone: 'orange' },
  PICKUP: { label: '포장', tone: 'gray' },
};

export const SALE_STATUS: Record<SaleStatus, { label: string; tone: BadgeTone }> = {
  ON_SALE: { label: '판매중', tone: 'green' },
  SOLD_OUT: { label: '품절', tone: 'red' },
  HIDDEN: { label: '숨김', tone: 'gray' },
};

/** 거절·취소 사유 (마지막은 직접 입력) */
export const REJECT_REASONS = ['재료 소진', '영업 조기 마감', '주문 폭주', '고객 요청', '기타 (직접 입력)'] as const;

/** 배달 주문 수락 시 예상 조리시간 선택지 */
export const COOKING_MINUTES = [
  { minutes: 10, label: '10분 이내', desc: '지금 바로 배달 호출' },
  { minutes: 20, label: '20분', desc: '10분 뒤 배달 호출' },
  { minutes: 30, label: '30분', desc: '20분 뒤 배달 호출' },
  { minutes: 40, label: '40분', desc: '30분 뒤 배달 호출' },
] as const;

export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

/** 영업시간 선택지: 00:00 ~ 23:30, 30분 간격 */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

export const NOTICE_KIND: Record<string, { label: string; tone: BadgeTone }> = {
  NEWS: { label: '소식', tone: 'gray' },
  UPDATE: { label: '업데이트', tone: 'blue' },
  EVENT: { label: '이벤트', tone: 'orange' },
  MAINTENANCE: { label: '점검', tone: 'yellow' },
};
