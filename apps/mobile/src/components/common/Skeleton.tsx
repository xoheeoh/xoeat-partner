import { useEffect, useState } from 'react';
import { Animated, DimensionValue, Easing, StyleSheet, View, ViewStyle } from 'react-native';

import { theme } from '@styles';

interface SkeletonProps {
  /** 가로 크기. 숫자(px) 또는 '100%' 같은 비율 */
  width?: DimensionValue;
  /** 세로 크기 (px) */
  height?: number;
  /** 모서리 반경. 원을 만들려면 height 의 절반을 넘긴다 */
  radius?: number;
  style?: ViewStyle;
}

/**
 * 스켈레톤(자리표시자): 데이터를 불러오는 동안 내용 자리를 회색 막대로 보여준다.
 * 조회 전 "없음" 화면이 잠깐 보이는 깜빡임을 막는다.
 */
const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 16, radius = theme.radius.sm, style }) => {
  // 렌더 중 ref 를 읽지 말라는 lint 규칙 때문에 useRef 대신 useState 초기화 함수로 한 번만 만든다
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.base, { width, height, borderRadius: radius, opacity }, style]} />;
};

interface SkeletonListProps {
  /** 자리표시자 줄 수 */
  rows?: number;
  /** 줄 사이 구분선 표시 여부 */
  divider?: boolean;
}

/** 목록 화면용 스켈레톤: [제목 줄 + 짧은 설명 줄] 을 여러 줄 반복한다 */
const SkeletonList: React.FC<SkeletonListProps> = ({ rows = 4, divider = true }) => (
  <View>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={[styles.listRow, divider && i > 0 && styles.listDivider]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="35%" height={12} />
        </View>
        <Skeleton width={72} height={16} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  base: { backgroundColor: theme.colors.gray100 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18 },
  listDivider: { borderTopWidth: 1, borderTopColor: theme.colors.gray100 },
});

export default Skeleton;
export { Skeleton, SkeletonList };
