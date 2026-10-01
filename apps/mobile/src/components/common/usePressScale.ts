import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * 버튼을 누르는 동안 살짝 줄어드는(기본 0.98) 피드백.
 * 반환한 onPressIn/onPressOut 을 버튼에 넘기고, style 을 Animated 컨테이너(Paper Button 의 Surface 포함)에 합친다.
 */
export const usePressScale = (to = 0.98) => {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 60, bounciness: 0 }).start();

  return {
    style: { transform: [{ scale }] },
    onPressIn: () => animate(to),
    onPressOut: () => animate(1),
  };
};

export default usePressScale;
