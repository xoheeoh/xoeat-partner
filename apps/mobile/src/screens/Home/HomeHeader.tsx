import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@typ/navigation';
import { useStore } from '@contexts/StoreContext';
import { useNotifications } from '@contexts/NotificationContext';
import { Header, NavIconButton } from '@components/common';
import { theme } from '@styles';

/**
 * 홈 탭 상단. 다른 탭과 같은 공통 Header 를 쓰되 제목은 가게 이름, 오른쪽은 알림 종.
 * 종은 Header 의 오른쪽 자리 규격(NavIconButton)을 그대로 쓰므로 다른 화면과 위치·크기가 같다.
 */
const HomeHeader = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { store } = useStore();
  const { unreadCount } = useNotifications();

  return (
    <Header
      title={store?.name ?? ' '}
      bgColor={theme.colors.bg}
      right={
        <View>
          <NavIconButton
            icon="bell-outline"
            accessibilityLabel={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}
            onPress={() => navigation.navigate('Notifications')}
          />
          {unreadCount > 0 && <View pointerEvents="none" style={styles.dot} />}
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  // 안 읽은 알림 표시. 버튼 오른쪽 위에 배경색 테두리를 둘러 아이콘과 겹쳐도 또렷하다
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.red500,
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
});

export default HomeHeader;
export { HomeHeader };
