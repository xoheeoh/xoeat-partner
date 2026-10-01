import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import Typography from './Typography';
import { controlSize, ControlSize } from '@styles';

interface TextButtonProps {
  label: string;
  onPress: () => void;
  /** 크기 단계. 배경이 없어도 높이·모서리·여백·글자는 다른 버튼과 같은 표를 따른다 */
  size?: ControlSize;
  style?: ViewStyle;
}

/** 배경 없는 텍스트 버튼 */
const TextButton: React.FC<TextButtonProps> = ({ label, onPress, size = 'md', style }) => {
  const control = controlSize[size];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          height: control.height,
          paddingHorizontal: control.paddingX,
          borderRadius: control.radius,
          opacity: pressed ? 0.5 : 1,
        },
        style,
      ]}>
      <Typography mode={control.text} color="gray600">
        {label}
      </Typography>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});

export default TextButton;
export { TextButton };
