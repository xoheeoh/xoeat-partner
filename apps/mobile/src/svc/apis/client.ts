/**
 * Supabase 클라이언트와 API 어댑터 공통 헬퍼.
 *
 * 화면 코드는 { resultCd, resultMsg, ...data } 형태의 응답만 본다.
 * 어댑터(storeApi / menuApi / orderApi)가 Supabase 호출 결과를 그 모양으로 바꿔 돌려준다.
 * 서버가 바뀌어도 고칠 곳은 어댑터뿐이다.
 */
import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@env';
import { secureStorage } from '@storages/asyncStorage';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. apps/mobile/.env 확인',
  );
}

// 값이 비어 있어도 앱은 뜨게 두고(로그인 시 NETWORK 오류로 안내), createClient 가 throw 하지 않도록 자리표시자를 넣는다
export const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'missing-anon-key',
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** 아이디 → 로그인 이메일 (서버는 이메일만 알고, 화면은 아이디만 다룬다). scripts/seed-demo.mjs 와 같은 규칙 */
export const emailFor = (loginId: string) => `${loginId.trim().toLowerCase()}@demo.xoeat.app`;

export const hasSession = async () => !!(await supabase.auth.getSession()).data.session;

/* ── 응답 모양 ─────────────────────────────────────────────────── */
export type ApiResult<T = object> = { resultCd: string; resultMsg: string } & Partial<T>;

export const ok = <T extends object>(data?: T): ApiResult<T> =>
  ({ resultCd: '0000', resultMsg: '정상 처리되었습니다.', ...(data ?? ({} as T)) }) as ApiResult<T>;

export const isOk = (r: ApiResult<unknown>) => r.resultCd === '0000';

/** 서버 오류 코드 → 화면 문구 */
const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: '로그인이 필요합니다.',
  STORE_NOT_FOUND: '가게 정보를 찾을 수 없습니다.',
  ORDER_NOT_FOUND: '주문을 찾을 수 없습니다.',
  INVALID_TRANSITION: '이미 처리된 주문입니다. 목록을 새로고침해 주세요.',
  COOKING_MINUTES_REQUIRED: '예상 조리시간을 선택해 주세요.',
  REASON_REQUIRED: '사유를 입력해 주세요.',
  STORE_PAUSED: '영업 일시중지 상태에서는 주문이 들어오지 않습니다. 홈에서 영업을 재개해 주세요.',
  NO_MENU_ON_SALE: '판매중인 메뉴가 없어 주문을 만들 수 없습니다.',
  TOO_MANY_REQUESTS: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  invalid_credentials: '아이디 또는 비밀번호가 올바르지 않습니다.',
  'Invalid login credentials': '아이디 또는 비밀번호가 올바르지 않습니다.',
  NETWORK: '네트워크 연결을 확인해 주세요.',
  '23505': '같은 이름이 이미 있습니다.',
  '23514': '입력값을 확인해 주세요.',
};

export const fail = (code: string, msg?: string): ApiResult =>
  ({
    resultCd: code || '9999',
    resultMsg: msg ?? MESSAGES[code] ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  }) as ApiResult;

/** supabase { data, error } → 값. 실패는 throw. */
export function unwrap<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const e = new Error(res.error.message) as Error & { code?: string };
    const isAuthError = res.error.code === 'PGRST301' || /jwt/i.test(res.error.message);
    e.code = isAuthError
      ? 'UNAUTHENTICATED'
      : res.error.code && MESSAGES[res.error.code]
        ? res.error.code
        : res.error.message;
    throw e;
  }
  return res.data as T;
}

/** throw 된 오류 → ApiResult */
export const toFail = (e: unknown): ApiResult => {
  const err = e as { code?: string; message?: string };
  if (err?.message && /fetch|network/i.test(err.message)) return fail('NETWORK');
  const code = err?.code ?? err?.message ?? '9999';
  return fail(code);
};

/** 어댑터 본문을 감싸 try/catch 를 한 곳에 둔다 */
export async function run<T extends object>(body: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return ok(await body());
  } catch (e) {
    return toFail(e);
  }
}

/* ── 날짜 유틸 ─────────────────────────────────────────────────── */
const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'yyyy-MM-dd' (로컬) */
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'yyyy-MM-dd' → 그 날 00:00 / 23:59:59 (로컬) ISO */
export const dayStartIso = (ymd: string) => new Date(`${ymd}T00:00:00`).toISOString();
export const dayEndIso = (ymd: string) => new Date(`${ymd}T23:59:59.999`).toISOString();
