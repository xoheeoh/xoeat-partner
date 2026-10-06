import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { theme } from '@styles';

import { Typography, typographyStyles } from './Typography';
import { useNotifyInputFocus } from './KeyboardAwareScrollView';

interface TextareaProps {
  value: string;
  setValue: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** 입력칸 높이. 기본 120. 긴 글을 받는 화면에서는 더 크게 넘긴다 */
  height?: number;
  /** 최대 글자 수. 넘기면 입력을 자르고 입력칸 아래에 "현재/최대" 를 실시간으로 보여준다 */
  maxLength?: number;
}

const Textarea: React.FC<TextareaProps> = ({ value, setValue, onFocus, onBlur, height = 120, maxLength }) => {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const notifyInputFocus = useNotifyInputFocus();
  const atLimit = maxLength !== undefined && value.length >= maxLength;

  return (
    <View>
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
        onChangeText={(v) => setValue(maxLength !== undefined ? v.slice(0, maxLength) : v)}
        maxLength={maxLength}
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
      {maxLength !== undefined && (
        // 꽉 차면 빨갛게 바꿔 "더 못 쓴다"는 걸 알린다
        <Typography mode="caption1" color={atLimit ? 'red500' : 'gray400'} style={styles.counter}>
          {value.length}/{maxLength}
        </Typography>
      )}
    </View>
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
  counter: { alignSelf: 'flex-end', marginTop: 4 },
});

export default Textarea;
export { Textarea };
