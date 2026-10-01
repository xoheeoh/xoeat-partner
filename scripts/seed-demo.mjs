/**
 * 데모 가맹점 계정을 만든다.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
 *
 * Auth 계정은 관리자 API 로 만들고, 가게·메뉴·지난 30일 주문은 demo_bootstrap() 이 채운다.
 * 몇 번이고 다시 돌릴 수 있다 (기존 데모 계정은 지우고 새로 만든다).
 * 서비스 롤 키를 쓰므로 로컬 또는 본인 프로젝트에서만 실행할 것.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  console.error('  예) SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo');
  process.exit(1);
}

const admin = createClient(URL, KEY, { auth: { persistSession: false }, realtime: { transport: ws } });

/** 아이디 → 로그인 이메일. 앱(svc/apis/client.ts)의 emailFor 와 같은 규칙 */
const emailFor = (loginId) => `${loginId}@demo.xoeat.app`;

const ACCOUNTS = [
  { loginId: 'owner01', password: 'demo1234!', storeName: '연남 소반' },
  { loginId: 'owner02', password: 'demo1234!', storeName: '망원 소반' },
];

for (const acc of ACCOUNTS) {
  const email = emailFor(acc.loginId);

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    // stores 를 지우면 메뉴·주문은 cascade 로 함께 사라진다
    await admin.from('stores').delete().eq('owner_id', existing.id);
    await admin.auth.admin.deleteUser(existing.id);
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: acc.password,
    email_confirm: true,
  });
  if (authError) {
    console.error(`${acc.loginId} 계정 생성 실패:`, authError.message);
    continue;
  }

  const { data, error } = await admin.rpc('demo_bootstrap', {
    p_user_id: created.user.id,
    p_login_id: acc.loginId,
    p_store_name: acc.storeName,
  });
  if (error) {
    console.error(`${acc.loginId} 데이터 생성 실패:`, error.message);
    continue;
  }

  console.log(`✓ ${acc.loginId} / ${acc.password}  ${acc.storeName}  주문 ${data.orders}건`);
}
