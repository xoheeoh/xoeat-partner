import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { theme } from '@styles';

interface ToggleSwitchProps {
  /** 켜짐 여부 */
  value: boolean;
  /** 사용자가 눌러서 바꾸려 할 때 새 값을 넘겨준다 */
  onValueChange: (next: boolean) => void;
  /** true 면 눌리지 않고 흐리게 보인다 */
  disabled?: boolean;
  accessibilityLabel?: string;
}

// iOS 기본 스위치와 같은 크기
const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const THUMB_SIZE = 27;
const THUMB_PADDING = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_PADDING * 2;

/** iOS 모양의 켜기/끄기 스위치. 기본 Switch 는 플랫폼마다 모양과 색이 달라 앱 색상으로 통일해 직접 그린다 */
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ value, onValueChange, disabled = false, accessibilityLabel }) => {
  // 0(꺼짐) ~ 1(켜짐). 렌더 중 ref 를 읽지 말라는 lint 규칙 때문에 useRef 대신 useState 초기화 함수를 쓴다
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // 배경색 보간은 네이티브 드라이버가 지원하지 않는다
    }).start();
  }, [value, progress]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.gray200, theme.colors.primary],
  });
  const thumbTranslate = progress.interpolate({ inputRange: [0, 1], outputRange: [0, THUMB_TRAVEL] });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={disabled && styles.disabled}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbTranslate }] }]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: THUMB_PADDING,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: 'white',
    // iOS 손잡이처럼 아래로 살짝 떨어지는 그림자
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16)',
  },
  disabled: { opacity: 0.5 },
});

export default ToggleSwitch;
export { ToggleSwitch };
