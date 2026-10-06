import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { theme } from '@styles';

interface AdultBadgeProps {
  /** 지름(px). 글자 크기와 테두리 두께는 지름에 맞춰 따라간다 */
  size?: number;
  /** 배열도 받는다 (예: [위치 보정, 흐리게]) */
  style?: StyleProp<ViewStyle>;
}

/**
 * 미성년자 구매 불가(주류 등) 표시. 영상물 등급 마크처럼 빨간 테두리의 빈 원 안에 굵은 빨간 "19".
 * 아이콘 라이브러리에 같은 뜻의 아이콘이 없어 직접 그린다. 상태 배지(Badge)와 모양을 달리해 "분류"가 아니라 "경고"로 읽히게 한다.
 */
const AdultBadge: React.FC<AdultBadgeProps> = ({ size = 20, style }) => (
  <View
    accessibilityLabel="미성년자 구매 불가"
    style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size * 0.12) }, style]}>
    <Text allowFontScaling={false} style={[styles.text, { fontSize: size * 0.5, lineHeight: size * 0.9 }]}>
      19
    </Text>
  </View>
);

const styles = StyleSheet.create({
  circle: { borderColor: theme.colors.red600, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: 'Pretendard-Bold', color: theme.colors.red600, letterSpacing: -0.6, textAlign: 'center' },
});

export default AdultBadge;
export { AdultBadge };
