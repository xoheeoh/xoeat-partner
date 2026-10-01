import { Dispatch, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { controlSize, theme } from '@styles';

import { typographyStyles } from './Typography';

interface SearchBoxProps {
  searchQuery: string;
  setSearchQuery: Dispatch<React.SetStateAction<string>>;
  onPress: () => void;
  disabled: boolean;
}

const SearchBox: React.FC<SearchBoxProps> = ({ searchQuery, setSearchQuery, onPress, disabled }) => {
  const [isActive, setIsActive] = useState<boolean>(false);

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <View style={styles.magnifyIcon}>
        <Icon source={'magnify'} size={22} color={theme.colors.gray400} />
      </View>

      <TextInput
        placeholder="검색어를 입력해주세요."
        placeholderTextColor={theme.colors.gray400}
        inputMode="text"
        editable={!disabled}
        style={[
          styles.container,
          {
            borderColor: isActive ? theme.colors.primary : theme.colors.line, // 입력칸과 같은 테두리 규칙
            backgroundColor: isActive ? 'white' : theme.colors.gray50,
          },
        ]}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        value={searchQuery}
        onChangeText={(query: string) => setSearchQuery(query)}
        onSubmitEditing={onPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1 을 주면 웹에서 높이가 글자 한 줄로 줄어 모양이 깨진다. 가로 폭은 바깥 View 가 잡으므로 높이만 고정한다
    borderWidth: 1.5,
    borderRadius: controlSize.lg.radius,
    paddingLeft: 48,
    paddingRight: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 0,
    height: controlSize.lg.height, // 드롭다운·입력칸과 나란히 놓여도 높이가 같다 (lg)
    position: 'relative',
    ...typographyStyles.body2, // 다른 입력칸과 같은 body2
    color: theme.colors.gray900,
    includeFontPadding: false, // 안드로이드 기본 패딩 제거
    // 브라우저 기본 포커스 outline 을 끈다. 포커스 표시는 테두리 색이 담당한다
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  // 입력칸 전체 높이에 걸쳐 세로 중앙에 둔다. top 값을 직접 적으면 입력칸 높이가 바뀔 때 어긋난다
  magnifyIcon: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 24,
    justifyContent: 'center',
    zIndex: 99,
  },
});

export default SearchBox;
export { SearchBox };
