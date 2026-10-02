import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabParamList } from '@typ/navigation';
import { useOrderFeed } from '@contexts/OrderFeedContext';
import { Header, Typography } from '@components/common';
import { theme } from '@styles';
import HomeScreen from './Home/HomeScreen';
import HomeHeader from './Home/HomeHeader';
import OrdersScreen from './Orders/OrdersScreen';
import MenusScreen from './Menus/MenusScreen';
import StoreScreen from './Store/StoreScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** 탭 바 높이와 탭 하나의 너비. 아이콘 24 + 간격 2 + 라벨(caption2 줄높이 14) = 40 이 세로 가운데 온다 */
const TAB_BAR_HEIGHT = 58;
const TAB_ITEM_WIDTH = 72;

const TABS: Record<keyof MainTabParamList, { label: string; icon: IconName; iconActive: IconName }> = {
  Home: { label: '홈', icon: 'home-outline', iconActive: 'home' },
  Orders: { label: '주문 현황', icon: 'receipt-text-outline', iconActive: 'receipt-text' },
  Menus: { label: '메뉴 관리', icon: 'silverware-fork-knife', iconActive: 'silverware-fork-knife' },
  Store: { label: '가게', icon: 'storefront-outline', iconActive: 'storefront' },
};

const TabIcon = ({ name, focused, badge }: { name: keyof MainTabParamList; focused: boolean; badge?: number }) => {
  const t = TABS[name];
  return (
    <View style={styles.tabItem}>
      <View>
        <MaterialCommunityIcons name={focused ? t.iconActive : t.icon} size={24} color={focused ? theme.colors.primary : theme.colors.gray400} />
        {!!badge && (
          <View style={styles.badge}>
            <Typography mode="caption2" color="white">
              {badge > 99 ? '99+' : badge}
            </Typography>
          </View>
        )}
      </View>
      <Typography mode="caption2" color={focused ? 'primary' : 'gray500'}>
        {t.label}
      </Typography>
    </View>
  );
};

/** 하단 4탭. 주문 현황 탭에는 접수대기 건수 배지가 붙는다 */
const MainTabs = () => {
  const { counts } = useOrderFeed();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarShowLabel: false,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + (Platform.OS === 'web' ? 0 : insets.bottom),
          paddingTop: 0,
          paddingBottom: Platform.OS === 'web' ? 0 : insets.bottom,
          // 구분선 대신 위로 퍼지는 그림자로 화면과 나눈다
          borderTopWidth: 0,
          boxShadow: theme.shadow.bar,
          backgroundColor: theme.colors.white,
        },
        // 라이브러리는 아이콘 자리를 고정 높이(약 31)로 잡고 탭 버튼 위쪽에 붙인다(위 정렬 + 안쪽 여백 5).
        // 우리는 아이콘+라벨을 한 덩어리로 넣으므로, 아이콘 자리를 탭 버튼 높이만큼 늘리고(flex: 1)
        // 그 안에서 묶음을 세로 가운데 두어 라이브러리의 정렬 방식과 상관없이 위아래 여백이 같게 한다.
        tabBarIconStyle: { flex: 1, width: TAB_ITEM_WIDTH },
        tabBarItemStyle: { paddingVertical: 0 },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ header: () => <HomeHeader />, tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          header: () => <Header title="주문 현황" bgColor="white" />,
          tabBarIcon: ({ focused }) => <TabIcon name="Orders" focused={focused} badge={counts.PENDING} />,
        }}
      />
      <Tab.Screen
        name="Menus"
        component={MenusScreen}
        options={{
          header: () => <Header title="메뉴 관리" bgColor="white" />,
          tabBarIcon: ({ focused }) => <TabIcon name="Menus" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Store"
        component={StoreScreen}
        options={{
          header: () => <Header title="가게" bgColor={theme.colors.bg} />,
          tabBarIcon: ({ focused }) => <TabIcon name="Store" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  // 아이콘 자리(flex: 1)를 꽉 채우고 그 안에서 세로 가운데 정렬
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, width: TAB_ITEM_WIDTH },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: theme.colors.red500,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
});

export default MainTabs;
