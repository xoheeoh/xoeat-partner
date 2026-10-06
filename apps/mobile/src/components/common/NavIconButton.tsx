import { Pressable, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';

import { theme } from '@styles';

/**
 * 상단 바(Header)에 놓이는 둥근 회색 아이콘 버튼.
 * 홈의 알림 종과 닫기 버튼이 같은 위치·모양이 되도록 크기를 한곳에서 정한다.
 */
export const NAV_ICON_BUTTON_SIZE = 40;

interface NavIconButtonProps {
  /** react-native-paper Icon 이름 (예: 'menu', 'close') */
  icon: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

const NavIconButton: React.FC<NavIconButtonProps> = ({ icon, onPress, accessibilityLabel }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    onPress={onPress}>
    <Icon source={icon} size={22} color={theme.colors.gray800} />
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    width: NAV_ICON_BUTTON_SIZE,
    height: NAV_ICON_BUTTON_SIZE,
    borderRadius: NAV_ICON_BUTTON_SIZE / 2,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { backgroundColor: theme.colors.gray150 },
});

export default NavIconButton;
export { NavIconButton };
