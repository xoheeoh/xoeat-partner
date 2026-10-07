import { useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@styles';

import { typographyStyles } from './Typography';

/**
 * 라디오 원 크기. dp 값을 그 기기에서 정수 픽셀이 되도록 맞춘다.
 * 화소 밀도가 소수(예: 2.625)인 기기에서는 22dp·10dp 가 57.75px·26.25px 처럼 소수가 되어, 좌우 반올림이 달라지면 점이 1px 치우친다.
 * 바깥 원과 점의 픽셀 차이를 짝수로 맞춰 양쪽 여백이 같게 한다.
 */
const snap = (dp: number) => PixelRatio.roundToNearestPixel(dp);
const OUTER_SIZE = snap(22);
const DOT_SIZE = (() => {
  const dot = snap(10);
  const gapPx = Math.round((OUTER_SIZE - dot) * PixelRatio.get());
  return gapPx % 2 === 0 ? dot : dot + 1 / PixelRatio.get();
})();
/**
 * 테두리 두께. CheckBox 의 테두리(1.5)와 같고, 선택 전후 모두 같은 두께다.
 * 픽셀 반올림(snap)을 하지 않는다. 하면 웹(배율 1)에서 2px 가 되어 체크박스(1px)보다 두꺼워 보인다.
 */
const RING_WIDTH = 1.5;

/**
 * 눌림 효과 값. CheckBox(react-native-bouncy-checkbox)의 기본값과 같아 두 부품의 손맛이 같다.
 * 누르는 동안 0.9배, 떼면 1배. 손을 뗀 뒤에는 "50ms 만에 0.9배 → 스프링으로 튕겨 1배"를 한 번 더 돌린다 (이게 튕김의 핵심).
 */
const BOUNCE_SCALE = 0.9;
const BOUNCINESS = 20;
const VELOCITY_IN = 0.1;
const VELOCITY_OUT = 0.4;

/**
 * 라디오(또는 그와 비슷한 선택 표시)에 체크박스와 같은 눌림·튕김 효과를 붙인다.
 * 반환한 onPressIn/onPressOut/onPress 를 Pressable 에 넘기고, style 을 RadioIndicator 의 style 로 넘긴다.
 */
const useRadioBounce = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number, velocity: number) => Animated.spring(scale, { toValue, velocity, bounciness: BOUNCINESS, useNativeDriver: true }).start();
  return {
    style: { transform: [{ scale }] },
    onPressIn: () => spring(BOUNCE_SCALE, VELOCITY_IN),
    onPressOut: () => spring(1, VELOCITY_OUT),
    onPress: () =>
      Animated.sequence([
        Animated.timing(scale, { toValue: BOUNCE_SCALE, duration: 50, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, velocity: VELOCITY_OUT, bounciness: BOUNCINESS, useNativeDriver: true }),
      ]).start(),
  };
};

interface RadioButtonData {
  id: string;
  label: string;
  value: string;
}

interface RadioProps {
  selectedId: string;
  setSelectedId: (id: string) => void;
  radioButtons: RadioButtonData[];
}

interface RadioIndicatorProps {
  selected: boolean;
  /** 선택 불가(품절 등). 연한 회색으로 가라앉힌다 */
  disabled?: boolean;
  /** useRadioBounce 가 돌려준 style. 눌림·튕김 효과를 받는다 */
  style?: StyleProp<ViewStyle>;
}

/**
 * 라디오 동그라미만 그린다. 가격·품절 표시처럼 다른 내용과 함께 한 줄을 직접 구성할 때 쓴다 (메뉴 옵션 등).
 * 점은 테두리 안쪽이 아니라 바깥 원 전체를 기준으로 가운데 맞춘다. 테두리 두께의 반올림에 영향받지 않는다.
 */
const RadioIndicator: React.FC<RadioIndicatorProps> = ({ selected, disabled, style }) => (
  <Animated.View style={[styles.outerCircle, style]}>
    <View style={[StyleSheet.absoluteFill, styles.ring, selected ? styles.ringSelected : styles.ringUnselected, disabled && styles.ringDisabled]} />
    {selected && (
      <View style={[StyleSheet.absoluteFill, styles.dotCenter]}>
        <View style={[styles.dot, disabled && styles.dotDisabled]} />
      </View>
    )}
  </Animated.View>
);

/** 라디오 한 줄. 줄마다 눌림 효과 값을 따로 가져야 해서 컴포넌트로 분리했다 */
const RadioRow: React.FC<{ button: RadioButtonData; selected: boolean; onSelect: () => void }> = ({ button, selected, onSelect }) => {
  const bounce = useRadioBounce();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={button.label}
      accessibilityState={{ checked: selected }}
      style={styles.row}
      onPressIn={bounce.onPressIn}
      onPressOut={bounce.onPressOut}
      onPress={() => {
        bounce.onPress();
        if (!selected) onSelect();
      }}>
      <RadioIndicator selected={selected} style={bounce.style} />
      <Text style={styles.label}>{button.label}</Text>
    </Pressable>
  );
};

const Radio: React.FC<RadioProps> = ({ selectedId, setSelectedId, radioButtons }) => (
  <View accessibilityRole="radiogroup" style={styles.group}>
    {radioButtons.map((button) => (
      <RadioRow key={button.id} button={button} selected={button.id === selectedId} onSelect={() => setSelectedId(button.id)} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  group: { alignItems: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  outerCircle: { width: OUTER_SIZE, height: OUTER_SIZE },
  ring: { borderRadius: OUTER_SIZE / 2, borderWidth: RING_WIDTH },
  ringSelected: { borderColor: theme.colors.primary },
  ringUnselected: { borderColor: theme.colors.gray300 },
  // 선택 불가(품절 등): 연한 회색으로 가라앉힌다
  ringDisabled: { borderColor: theme.colors.gray200 },
  dotCenter: { justifyContent: 'center', alignItems: 'center' },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: theme.colors.primary,
  },
  dotDisabled: { backgroundColor: theme.colors.gray300 },
  label: {
    marginLeft: 10,
    ...typographyStyles.body2,
    fontFamily: 'Pretendard-Medium', // 선택지 라벨은 body2 에서 굵기만 Medium
    color: theme.colors.gray900,
  },
});

export default Radio;
export { Radio, RadioIndicator, useRadioBounce };
