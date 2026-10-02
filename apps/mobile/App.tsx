import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { loadingController } from '@utils/loadingController';
import { hasSession, supabase } from '@apis/client';
import { DEV_START_SCREEN } from '@env';
import type { RootStackParamList } from '@typ/navigation';

import { DialogProvider } from '@contexts/DialogContext';
import { LoadingProvider, useLoading } from '@contexts/LoadingContext';
import { NavigationProvider } from '@contexts/navigationContext';
import { StoreProvider } from '@contexts/StoreContext';
import { OrderFeedProvider } from '@contexts/OrderFeedContext';
import { NotificationProvider } from '@contexts/NotificationContext';

import { Header, toastConfig } from '@components/common';
import {
  CategoryManageScreen,
  LoginScreen,
  MainTabs,
  MenuEditScreen,
  NoticeScreen,
  NotificationsScreen,
  OperationSettingScreen,
  OptionGroupEditScreen,
  OrderDetailScreen,
  OrderHistoryScreen,
  SettlementScreen,
  StoreHoursScreen,
  StoreInfoEditScreen,
} from '@screens';
import { theme } from '@styles';

/* 글로벌 로딩 ==================================== */
const GlobalLoading = () => {
  const { isLoading, setLoading } = useLoading();

  useEffect(() => {
    loadingController.register(setLoading);
  }, [setLoading]);

  if (!isLoading) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
};

const Stack = createNativeStackNavigator<RootStackParamList>();

SplashScreen.preventAutoHideAsync().catch(() => {});

function App(): React.JSX.Element {
  // 웹은 용량이 작은 woff2, 네이티브는 otf 를 런타임에 로드한다 (Pretendard, SIL OFL)
  const [fontsLoaded] = useFonts(
    Platform.OS === 'web'
      ? {
          'Pretendard-Regular': require('./assets/fonts/web/Pretendard-Regular.woff2'),
          'Pretendard-Medium': require('./assets/fonts/web/Pretendard-Medium.woff2'),
          'Pretendard-SemiBold': require('./assets/fonts/web/Pretendard-SemiBold.woff2'),
          'Pretendard-Bold': require('./assets/fonts/web/Pretendard-Bold.woff2'),
        }
      : {
          'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
          'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
          'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
          'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
        },
  );

  /* 로그인 상태 ===== */
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    hasSession().then((v) => {
      setIsLoggedIn(v);
      setIsLoading(false);
    });
    // 로그인·로그아웃·토큰 만료를 한 곳에서 받아 가게 정보·주문 구독을 켜고 끈다
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoading && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [isLoading, fontsLoaded]);

  if (isLoading || !fontsLoaded) {
    return <></>;
  }

  const getInitialRoute = (): keyof RootStackParamList => {
    if (DEV_START_SCREEN) return DEV_START_SCREEN as keyof RootStackParamList;
    return isLoggedIn ? 'Main' : 'Login';
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LoadingProvider>
          <StatusBar barStyle="dark-content" />
          <DialogProvider>
            <GlobalLoading />

            <StoreProvider enabled={isLoggedIn}>
              <OrderFeedProvider enabled={isLoggedIn}>
                <NotificationProvider enabled={isLoggedIn}>
                  <NavigationProvider>
                    <Stack.Navigator initialRouteName={getInitialRoute()}>
                      <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ headerShown: false, gestureEnabled: false }}
                      />
                      <Stack.Screen
                        name="Main"
                        component={MainTabs}
                        options={{ headerShown: false, gestureEnabled: false }}
                      />

                      {/* 주문 */}
                      <Stack.Screen
                        name="OrderDetail"
                        component={OrderDetailScreen}
                        options={{ header: () => <Header title="주문 상세" bgColor={theme.colors.bg} leftButton /> }}
                      />
                      <Stack.Screen
                        name="OrderHistory"
                        component={OrderHistoryScreen}
                        options={{ header: () => <Header title="주문 내역" bgColor="white" leftButton /> }}
                      />

                      {/* 메뉴 */}
                      <Stack.Screen
                        name="MenuEdit"
                        component={MenuEditScreen}
                        options={({ route }) => ({
                          header: () => (
                            <Header
                              title={route.params?.menuId ? '메뉴 수정' : '메뉴 등록'}
                              bgColor="white"
                              leftButton
                            />
                          ),
                        })}
                      />
                      <Stack.Screen
                        name="CategoryManage"
                        component={CategoryManageScreen}
                        options={{ header: () => <Header title="카테고리 관리" bgColor="white" leftButton /> }}
                      />
                      <Stack.Screen
                        name="OptionGroupEdit"
                        component={OptionGroupEditScreen}
                        options={({ route }) => ({
                          header: () => (
                            <Header
                              title={route.params?.groupId ? '옵션 그룹 수정' : '옵션 그룹 등록'}
                              bgColor="white"
                              leftButton
                            />
                          ),
                        })}
                      />

                      {/* 가게 */}
                      <Stack.Screen
                        name="StoreInfoEdit"
                        component={StoreInfoEditScreen}
                        options={{ header: () => <Header title="가게 정보 관리" bgColor="white" leftButton /> }}
                      />
                      <Stack.Screen
                        name="StoreHours"
                        component={StoreHoursScreen}
                        options={{ header: () => <Header title="영업시간 설정" bgColor="white" leftButton /> }}
                      />
                      <Stack.Screen
                        name="OperationSetting"
                        component={OperationSettingScreen}
                        options={{ header: () => <Header title="배달/포장 운영 설정" bgColor="white" leftButton /> }}
                      />
                      <Stack.Screen
                        name="Settlement"
                        component={SettlementScreen}
                        options={{ header: () => <Header title="정산 내역" bgColor={theme.colors.bg} leftButton /> }}
                      />
                      <Stack.Screen
                        name="Notice"
                        component={NoticeScreen}
                        options={{ header: () => <Header title="공지사항" bgColor="white" leftButton /> }}
                      />
                      <Stack.Screen
                        name="Notifications"
                        component={NotificationsScreen}
                        options={{ header: () => <Header title="알림" bgColor="white" leftButton /> }}
                      />
                    </Stack.Navigator>

                    <Toast position="top" topOffset={70} config={toastConfig} />
                  </NavigationProvider>
                </NotificationProvider>
              </OrderFeedProvider>
            </StoreProvider>
          </DialogProvider>
        </LoadingProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
