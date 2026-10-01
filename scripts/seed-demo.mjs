/**
 * 데모 계정을 만든다.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
 *
 * - 사장님 2명(owner01·02): demo_bootstrap() 이 한식 가게·메뉴·지난 30일 주문을 채운다 (사장님 앱 시연용)
 * - 추가 가게 4곳(owner03~06): demo_bootstrap_store() 가 메뉴 JSON 으로 만든다 (구매자 앱 가게 목록용)
 * - 회원 2명(user01·02): auth metadata role=customer 로 가입시키고 demo_bootstrap_customer() 가 배송지·카드·찜·주문을 채운다
 * 몇 번이고 다시 돌릴 수 있다 (기존 데모 계정은 지우고 새로 만든다). 서비스 롤 키를 쓰므로 로컬 또는 본인 프로젝트에서만 실행할 것.
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

/** 아이디 → 로그인 이메일. 사장님과 회원은 도메인이 달라 같은 아이디를 써도 충돌하지 않는다 */
const ownerEmail = (id) => `${id}@demo.xoeat.app`;
const customerEmail = (id) => `${id}@customer.xoeat.app`;

const PASSWORD = 'demo1234!';

const OWNERS = [
  { loginId: 'owner01', storeName: '연남 소반' },
  { loginId: 'owner02', storeName: '망원 소반' },
];

const EXTRA_STORES = [
  {
    loginId: 'owner03', name: '홍대 치킨공방', category: 'CHICKEN', intro: '주문 즉시 튀기는 바삭한 치킨. 순살은 100% 국내산 닭다리살만 씁니다.',
    address: '서울 마포구 와우산로 29', minOrder: 15000, fee: 2500, minutes: 35,
    menus: [
      { category: '치킨', items: [
        { name: '후라이드 치킨', price: 19000, desc: '겉바속촉 기본 후라이드', standard: '1마리' },
        { name: '양념 치킨', price: 20000, desc: '달콤 매콤한 비법 양념', standard: '1마리' },
        { name: '반반 치킨', price: 20000, desc: '후라이드 반 + 양념 반', standard: '1마리' },
        { name: '순살 간장 치킨', price: 21000, desc: '마늘 간장 소스에 버무린 순살', standard: '순살 500g' },
      ] },
      { category: '사이드', items: [
        { name: '치즈볼 (6개)', price: 6000, desc: '', standard: '6개' },
        { name: '감자튀김', price: 4000, desc: '', standard: 'L' },
        { name: '치킨무 추가', price: 1000, desc: '', standard: '1개' },
      ] },
      { category: '음료', items: [
        { name: '콜라 1.25L', price: 3000, desc: '', standard: '1.25L' },
        { name: '제로콜라 500ml', price: 2000, desc: '', standard: '500ml' },
      ] },
    ],
  },
  {
    loginId: 'owner04', name: '피자 델리나', category: 'PIZZA', intro: '48시간 저온 숙성 도우로 굽는 화덕 피자.',
    address: '서울 마포구 동교로 162', minOrder: 18000, fee: 3000, minutes: 40,
    menus: [
      { category: '피자', items: [
        { name: '마르게리타', price: 17000, desc: '토마토 · 모짜렐라 · 바질', standard: 'R (30cm)' },
        { name: '페퍼로니', price: 19000, desc: '페퍼로니 듬뿍', standard: 'R (30cm)' },
        { name: '고르곤졸라', price: 21000, desc: '꿀과 함께', standard: 'R (30cm)' },
        { name: '불고기 피자', price: 22000, desc: '한국식 불고기 토핑', standard: 'R (30cm)' },
      ] },
      { category: '파스타', items: [
        { name: '알리오 올리오', price: 13000, desc: '', standard: '1인분' },
        { name: '로제 파스타', price: 15000, desc: '', standard: '1인분', status: 'SOLD_OUT' },
      ] },
      { category: '음료', items: [{ name: '스프라이트 1.25L', price: 3000, desc: '', standard: '1.25L' }] },
    ],
  },
  {
    loginId: 'owner05', name: '카페 모퉁이', category: 'CAFE_DESSERT', intro: '직접 로스팅한 원두와 매일 굽는 스콘.',
    address: '서울 마포구 성미산로 45', minOrder: 8000, fee: 2000, minutes: 20,
    menus: [
      { category: '커피', items: [
        { name: '아메리카노', price: 4500, desc: '', standard: 'Tall' },
        { name: '카페라떼', price: 5000, desc: '', standard: 'Tall' },
        { name: '바닐라 라떼', price: 5500, desc: '', standard: 'Tall' },
        { name: '콜드브루', price: 5000, desc: '', standard: 'Tall' },
      ] },
      { category: '디저트', items: [
        { name: '플레인 스콘', price: 3800, desc: '클로티드 크림 포함', standard: '1개' },
        { name: '초코 브라우니', price: 4500, desc: '', standard: '1조각' },
        { name: '바스크 치즈케이크', price: 6500, desc: '', standard: '1조각' },
      ] },
    ],
  },
  {
    loginId: 'owner06', name: '망원 분식당', category: 'SNACK_BAR', intro: '쌀떡볶이와 바로 튀긴 모둠 튀김.',
    address: '서울 마포구 포은로 90', minOrder: 10000, fee: 2000, minutes: 30,
    menus: [
      { category: '분식', items: [
        { name: '쌀떡볶이', price: 6000, desc: '', standard: '1인분' },
        { name: '로제떡볶이', price: 7500, desc: '', standard: '1인분' },
        { name: '모둠튀김 (5개)', price: 5000, desc: '오징어 · 김말이 · 고구마 · 야채 · 만두', standard: '5개' },
        { name: '순대', price: 5000, desc: '', standard: '1인분' },
        { name: '참치김밥', price: 4500, desc: '', standard: '1줄' },
      ] },
      { category: '세트', items: [
        { name: '떡튀순 세트', price: 14000, desc: '떡볶이 + 튀김 3개 + 순대', standard: '2인분' },
      ] },
    ],
  },
];

const CUSTOMERS = [
  { loginId: 'user01', name: '김소희', phone: '010-1234-5678' },
  { loginId: 'user02', name: '이민준', phone: '010-9876-5432' },
];

const findUser = async (email) => {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  return data?.users?.find((u) => u.email === email);
};

const resetUser = async (email, opts) => {
  const existing = await findUser(email);
  if (existing) {
    await admin.from('stores').delete().eq('owner_id', existing.id); // 메뉴·주문은 cascade
    await admin.auth.admin.deleteUser(existing.id); // customers·addresses·… 도 cascade
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, ...opts });
  if (error) throw new Error(`${email} 계정 생성 실패: ${error.message}`);
  return data.user;
};

// 회원이 사장님 가게를 참조하므로 먼저 회원을 지우고(주문의 customer_id 는 set null), 가게 → 회원 순으로 만든다
for (const c of CUSTOMERS) {
  const existing = await findUser(customerEmail(c.loginId));
  if (existing) await admin.auth.admin.deleteUser(existing.id);
}

for (const acc of OWNERS) {
  const user = await resetUser(ownerEmail(acc.loginId));
  const { data, error } = await admin.rpc('demo_bootstrap', { p_user_id: user.id, p_login_id: acc.loginId, p_store_name: acc.storeName });
  if (error) { console.error(`${acc.loginId} 데이터 생성 실패:`, error.message); continue; }
  console.log(`✓ 사장님 ${acc.loginId} / ${PASSWORD}  ${acc.storeName}  주문 ${data.orders}건`);
}

for (const st of EXTRA_STORES) {
  const user = await resetUser(ownerEmail(st.loginId));
  const { data, error } = await admin.rpc('demo_bootstrap_store', {
    p_user_id: user.id, p_login_id: st.loginId, p_store_name: st.name, p_category: st.category, p_intro: st.intro,
    p_address: st.address, p_min_order: st.minOrder, p_fee: st.fee, p_minutes: st.minutes, p_menus: st.menus,
  });
  if (error) { console.error(`${st.loginId} 가게 생성 실패:`, error.message); continue; }
  console.log(`✓ 가게 ${st.loginId}  ${st.name}  주문 ${data.orders}건`);
}

for (const c of CUSTOMERS) {
  const user = await resetUser(customerEmail(c.loginId), {
    user_metadata: { role: 'customer', login_id: c.loginId, name: c.name, phone: c.phone },
  });
  const { data, error } = await admin.rpc('demo_bootstrap_customer', { p_user_id: user.id });
  if (error) { console.error(`${c.loginId} 회원 데이터 생성 실패:`, error.message); continue; }
  console.log(`✓ 회원 ${c.loginId} / ${PASSWORD}  ${c.name}  주문 ${data.orders}건`);
}
