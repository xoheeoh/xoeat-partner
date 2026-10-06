import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@typ/navigation';
import { Typography } from './Typography';
import { NAV_ICON_BUTTON_SIZE, NavIconButton } from './NavIconButton';
import { theme } from '@styles';

interface HeaderProps {
  bgColor: string;
  title: string;
  leftButton?: boolean;
  leftEvent?: () => void;
  rightButton?: boolean;
  rightEvent?: () => void;
  /** 오른쪽 자리에 닫기 버튼 대신 놓을 요소 (예: 홈의 알림 종). NavIconButton 크기(40)에 맞춰 만든다 */
  right?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ bgColor, title, leftButton, leftEvent, rightButton, rightEvent, right }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={{ backgroundColor: bgColor }} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={
            leftButton
              ? () => {
                  if (leftEvent) {
                    leftEvent();
                  } else {
                    navigation.goBack();
                  }
                }
              : () => undefined
          }
          style={({ pressed }) => [styles.button, pressed && leftButton && styles.pressed]}>
          {leftButton && <Icon source="chevron-left" size={26} color={theme.colors.gray900} />}
        </Pressable>
        {/* 화면 제목은 바텀시트 제목과 같은 subtitle1. 내용 첫 제목(heading3, 20 Bold)보다 작아 위계가 뒤집히지 않되 시트 제목보다 작지는 않다 */}
        <Typography mode="subtitle1" color="gray900" numberOfLines={1} style={styles.title}>
          {title}
        </Typography>
        {/* 오른쪽 자리: right 요소 → 닫기 버튼(rightButton) → 빈 칸 순. 빈 칸도 같은 폭이라 제목이 항상 가운데 온다 */}
        {right ? (
          right
        ) : rightButton ? (
          <NavIconButton
            icon="close"
            accessibilityLabel="닫기"
            onPress={() => {
              if (rightEvent) {
                rightEvent();
              } else {
                navigation.goBack();
              }
            }}
          />
        ) : (
          <View style={styles.button} /> // 버튼이 없어도 제목이 가운데 오도록 같은 크기의 빈 칸을 둔다
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: { flex: 1, textAlign: 'center' },
  button: {
    width: NAV_ICON_BUTTON_SIZE,
    height: NAV_ICON_BUTTON_SIZE,
    borderRadius: NAV_ICON_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { backgroundColor: theme.colors.gray100 },
});

export default Header;
export { Header };
