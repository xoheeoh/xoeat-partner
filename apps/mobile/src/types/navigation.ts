import type { NavigatorScreenParams } from '@react-navigation/native';

/** 하단 탭 */
export type MainTabParamList = {
  Home: undefined;
  Orders: { tab?: 'PENDING' | 'ING' | 'COMPLETED' | 'CLOSED' } | undefined;
  Menus: undefined;
  Store: undefined;
};

/** 루트 스택 */
export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;

  // 주문
  OrderDetail: { orderId: string };
  OrderHistory: undefined;

  // 알림함 (홈 종 아이콘)
  Notifications: undefined;

  // 메뉴
  MenuEdit: { menuId?: string } | undefined;
  CategoryManage: undefined;
  OptionGroupEdit: { groupId?: string } | undefined;

  // 가게
  StoreInfoEdit: undefined;
  StoreHours: undefined;
  OperationSetting: undefined;
  Settlement: undefined;
  Notice: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
