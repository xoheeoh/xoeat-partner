import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabParamList } from '@typ/navigation';
import { useOrderFeed } from '@contexts/OrderFeedContext';
import { Header, Typography } from '@components/common';
import { theme } from '@styles';
import HomeScreen from './Home/HomeScreen';
import OrdersScreen from './Orders/OrdersScreen';
import MenusScreen from './Menus/MenusScreen';
import StoreScreen from './Store/StoreScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: Record<keyof MainTabParamList, { label: string; icon: IconName; iconActive: IconName }> = {
  Home: { label: '홈', icon: 'home-outline', iconActive: 'home' },
  Orders: { label: '주문현황', icon: 'receipt-text-outline', iconActive: 'receipt-text' },
  Menus: { label: '메뉴관리', icon: 'silverware-fork-knife', iconActive: 'silverware-fork-knife' },
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

/** 하단 4탭. 주문현황 탭에는 접수대기 건수 배지가 붙는다 */
const MainTabs = () => {
  const { counts } = useOrderFeed();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 56 + (Platform.OS === 'web' ? 0 : insets.bottom),
          paddingTop: 6,
          paddingBottom: Platform.OS === 'web' ? 0 : insets.bottom,
          borderTopColor: theme.colors.line,
          backgroundColor: theme.colors.white,
        },
        tabBarItemStyle: { paddingVertical: 0 },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false, tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          header: () => <Header title="주문현황" bgColor="white" />,
          tabBarIcon: ({ focused }) => <TabIcon name="Orders" focused={focused} badge={counts.PENDING} />,
        }}
      />
      <Tab.Screen
        name="Menus"
        component={MenusScreen}
        options={{
          header: () => <Header title="메뉴관리" bgColor="white" />,
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
  tabItem: { alignItems: 'center', gap: 2, width: 72 },
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
