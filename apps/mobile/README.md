# Xoeat 사장님 — 앱 (Expo)

루트 README 의 "직접 실행하기" 절차로 API 서버를 먼저 올린 뒤:

```bash
cd apps/mobile
cp .env.example .env      # SUPABASE URL / anon key 채우기
npm install
npm run web               # 브라우저
npm run ios / android     # 시뮬레이터 (Expo Go 또는 개발 빌드)
npm run typecheck         # tsc
npm run lint              # eslint
```

## 구조

```
App.tsx           루트 스택(Login · Main · 상세/편집 화면) · 전역 프로바이더(가게 · 주문 피드 · 알림함 · 다이얼로그 · 로딩 · 토스트) · 폰트 로딩
src/
  screens/
    MainTabs.tsx  하단 4탭 (홈 · 주문 현황 · 메뉴 관리 · 가게). 주문 현황 탭에 접수대기 배지
    Home/         공통 Header(가게 이름 · 알림 종) · 영업 상태 줄 · 접수대기/진행중 카드 · 오늘·이번 달 매출(주 단위 막대) · 바로가기 · 데모 주문 버튼
    Orders/       오늘 주문 탭 목록 · 주문 상세 · 지난 주문 내역
    Menus/        메뉴/옵션 그룹 목록 · 메뉴 편집 · 카테고리 관리(드래그 정렬) · 옵션 그룹 편집
    Store/        가게 탭(프로필형 헤더) · 가게 정보 · 영업시간 · 배달/포장 운영 · 정산 · 공지 · 알림함
  components/
    common/       디자인 시스템 (Typography · Button · TextField · Textarea · Dropdown · BottomSheet · Badge · AdultBadge · ToggleSwitch · SortableList · …)
    order/        OrderCard · OrderReceipt · OrderActions(상태별 버튼 + 수락/거절 시트)
    home/         MonthSalesChart(이번 달 주 단위 막대)
  svc/
    apis/         client(Supabase · 응답 계약 · 오류 문구) · storeApi · menuApi · orderApi · notificationApi
    contexts/     StoreContext(내 가게) · OrderFeedContext(Realtime 구독 · 알림음 · 건수) · NotificationContext(알림함 안 읽은 개수 · 구독) · Dialog · Loading · navigation
    data/         constants (상태 라벨/색 · 거절 사유 · 조리시간 · 업종 · 시간 선택지)
    storages/     AsyncStorage + 보안 저장소(expo-secure-store / 웹 localStorage)
  styles/         colors · theme(radius · space · shadow) · controls(버튼/입력 크기 단계) · layout
  types/          domain(화면이 다루는 모양) · navigation
  utils/          formatter(금액 · 날짜 · 전화번호) · navigationHelpers · loadingController
  shims/          env(EXPO_PUBLIC_*) · linear-gradient
```

## 화면 흐름

```
Login ─▶ Main(탭)
          ├ Home ──▶ Notifications(종) · Orders(탭 지정) · OrderHistory · Settlement · StoreHours · OperationSetting
          ├ Orders ─▶ OrderDetail
          ├ Menus ──▶ MenuEdit · CategoryManage · OptionGroupEdit
          └ Store ──▶ StoreInfoEdit · StoreHours · OperationSetting · Settlement · Notice
Notifications ─▶ OrderDetail(주문 알림) · Notice(공지 알림)
```

## 플랫폼 분기와 모듈 선택

| 용도 | 모듈 | 비고 |
| --- | --- | --- |
| 세션 저장 | expo-secure-store (웹: localStorage) | 2KB 제한은 조각 저장으로 처리 |
| 메뉴·가게 사진 | expo-image-picker → Supabase Storage | 정사각 크롭. 웹은 파일 선택 대화상자 |
| 새 주문 알림음 | expo-audio | 웹은 사용자 상호작용 전 자동재생이 막힐 수 있어 토스트는 항상 띄운다 |
| 실시간 | @supabase/supabase-js Realtime | `orders` INSERT/UPDATE 와 `notifications` INSERT 구독. RLS 로 내 가게 행만 수신 |
| 드래그 정렬 | react-native-gesture-handler + reanimated | 카테고리 순서. 라이브러리 추가 없이 `SortableList` 로 직접 구현 |
| 앱 버전 표시 | expo-application | 스토어 미배포라 현재 버전만 표시 |
| 환경변수 | `EXPO_PUBLIC_*` (`src/shims/env`) | 빌드 시 인라인 |
| 폰트 | expo-font 런타임 로드 | 네이티브 otf, 웹 woff2 |
| 아이콘 | @expo/vector-icons (MaterialCommunityIcons) | |

## 개발 팁

- `.env` 의 `EXPO_PUBLIC_DEV_START_SCREEN=StoreHours` 처럼 두면 개발 실행에서 그 화면으로 바로 시작한다 (로그인 세션은 있어야 한다).
- 웹 빌드: `npm run export:web` → `dist/`. 정적 호스팅(Vercel · GitHub Pages)에 그대로 올린다.
