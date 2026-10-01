-- 공지사항 (모든 가맹점 공통). 데모 계정·가게·주문은 scripts/seed-demo.mjs 가 demo_bootstrap() 으로 만든다.
insert into public.notices (kind, title, body, created_at) values
  ('UPDATE', '사장님 앱 1.0 출시 안내',
   '주문 수락·거절, 메뉴 관리, 영업 상태 설정, 정산 조회를 앱에서 바로 할 수 있습니다.\n새 주문이 들어오면 알림음과 함께 주문현황 탭에 표시됩니다.',
   now() - interval '12 days'),
  ('EVENT', '10월 신규 가맹점 수수료 0% 이벤트',
   '10월 한 달간 신규 입점 가맹점은 플랫폼 수수료가 면제됩니다. 정산 화면에서 수수료 0원으로 표시됩니다.',
   now() - interval '5 days'),
  ('MAINTENANCE', '정산 시스템 점검 안내 (10/8 02:00~04:00)',
   '점검 시간 동안 정산 내역 조회가 잠시 지연될 수 있습니다. 주문 접수와 처리는 정상 동작합니다.',
   now() - interval '1 day');
