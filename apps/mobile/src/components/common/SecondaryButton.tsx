import { Animated, Pressable, StyleSheet, ViewStyle } from 'react-native';

import Typography from './Typography';
import { usePressScale } from './usePressScale';
import { controlSize, ControlSize, theme } from '@styles';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  /** 크기 단계. 높이·모서리·여백·글자는 styles/controls 의 표를 따른다 (PrimaryButton 과 동일) */
  size?: ControlSize;
  disabled?: boolean;
  style?: ViewStyle;
}

/** 보조 액션 버튼 - 연한 회색 채움 */
const SecondaryButton: React.FC<SecondaryButtonProps> = ({ label, onPress, size = 'lg', disabled, style }) => {
  const press = usePressScale();
  const control = controlSize[size];

  return (
    <Animated.View style={[!disabled && press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          styles.base,
          {
            height: control.height,
            paddingHorizontal: control.paddingX,
            borderRadius: control.radius,
            backgroundColor: pressed ? theme.colors.gray150 : theme.colors.gray100,
          },
        ]}>
        <Typography mode={control.text} color={disabled ? 'gray300' : 'gray800'}>
          {label}
        </Typography>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});

export default SecondaryButton;
export { SecondaryButton };
