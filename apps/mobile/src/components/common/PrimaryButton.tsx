import { Animated, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { Typography } from './Typography';
import { usePressScale } from './usePressScale';
import { controlSize, ControlSize, theme } from '@styles';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  /** 크기 단계. 높이·모서리·여백·글자는 styles/controls 의 표를 따른다 */
  size?: ControlSize;
  disabled?: boolean;
  /** 배경색 오버라이드 (흰색을 넘기면 글자는 진한 회색으로) */
  buttonColor?: string;
  style?: ViewStyle;
  /** 키보드 위에 붙는 하단 버튼이면 모서리를 직각으로 */
  keyboardVisible?: boolean;
}

/** 채워진 기본 액션 버튼 */
const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  size = 'lg',
  disabled,
  buttonColor = theme.colors.primary,
  style,
  keyboardVisible = false,
}) => {
  const press = usePressScale();
  const isWhite = buttonColor === theme.colors.white;
  const textColor = disabled ? 'gray400' : isWhite ? 'gray900' : 'white';
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
            borderRadius: keyboardVisible ? 0 : control.radius,
            backgroundColor: disabled
              ? theme.colors.disabled
              : pressed && !isWhite
                ? theme.colors.primaryDark
                : buttonColor,
          },
          isWhite && !disabled && styles.whiteBorder,
        ]}>
        <Typography mode={control.text} color={textColor}>
          {label}
        </Typography>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  whiteBorder: { borderWidth: 1, borderColor: theme.colors.line },
});

export default PrimaryButton;
export { PrimaryButton };
