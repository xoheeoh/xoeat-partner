/** 숫자 → "12,000원" */
export const won = (n: number | null | undefined) => `${(n ?? 0).toLocaleString('ko-KR')}원`;

/** 숫자 → "12,000" */
export const comma = (n: number | null | undefined) => (n ?? 0).toLocaleString('ko-KR');

/** 입력 문자열에서 숫자만 남겨 number 로 */
export const digitsToNumber = (s: string) => Number(s.replace(/[^\d]/g, '') || 0);

/** "01012345678" → "010-1234-5678" (이미 하이픈이 있으면 그대로) */
export const phone = (s: string) => {
  if (!s) return '';
  if (s.includes('-')) return s;
  const d = s.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith('02') ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return s;
};

/** "1234567890" → "123-45-67890" */
export const bizNo = (s: string) => {
  const d = s.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : s;
};

const pad = (n: number) => String(n).padStart(2, '0');
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** ISO → "10월 1일 (목) 14:05" */
export const dateTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** ISO → "14:05" */
export const timeOnly = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** ISO 또는 'yyyy-MM-dd' → "2026.10.01" */
export const dateDot = (s: string | null | undefined) => {
  if (!s) return '';
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

/** 'yyyy-MM-dd' → "10월 1일 (목)" */
export const dateKo = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]})`;
};

/** Date → "10월 1일 (목)". 홈 상단처럼 자리가 좁을 때 */
export const todayKoShort = (d = new Date()) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]})`;

/** Date → "2026년 10월 1일 목요일" */
export const todayKo = (d = new Date()) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_KO[d.getDay()]}요일`;

/** ISO → "3분 전", "1시간 전" (주문 목록의 경과 시간) */
export const ago = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

/** "HH:mm" → "오전 10:00" */
export const timeKo = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hh}:${pad(m)}`;
};
