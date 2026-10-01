import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { theme } from '@styles';

import { typographyStyles } from './Typography';
import { useNotifyInputFocus } from './KeyboardAwareScrollView';

interface TextareaProps {
  value: string;
  setValue: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** 입력칸 높이. 기본 120. 긴 글을 받는 화면에서는 더 크게 넘긴다 */
  height?: number;
}

const Textarea: React.FC<TextareaProps> = ({ value, setValue, onFocus, onBlur, height = 120 }) => {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const notifyInputFocus = useNotifyInputFocus();

  return (
    <TextInput
      style={[
        styles.container,
        {
          height,
          borderColor: isFocused ? theme.colors.primary : theme.colors.line, // 입력칸과 같은 테두리 규칙
          backgroundColor: isFocused ? 'white' : theme.colors.gray50,
        },
      ]}
      placeholder="내용"
      placeholderTextColor={theme.colors.gray400}
      multiline
      value={value}
      onChangeText={setValue}
      onFocus={() => {
        setIsFocused(true);
        notifyInputFocus();
        onFocus?.();
      }}
      onBlur={() => {
        setIsFocused(false);
        onBlur?.();
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    ...typographyStyles.body2, // 다른 입력칸과 같은 body2
    color: theme.colors.gray900,
    textAlignVertical: 'top',
  },
});

export default Textarea;
export { Textarea };
