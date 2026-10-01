import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
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
const BORDER_SELECTED = snap(2);
const BORDER_UNSELECTED = snap(1.5);

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

const Radio: React.FC<RadioProps> = ({ selectedId, setSelectedId, radioButtons }) => {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {radioButtons.map((button) => {
        const selected = button.id === selectedId;
        return (
          <Pressable
            key={button.id}
            accessibilityRole="radio"
            accessibilityLabel={button.label}
            accessibilityState={{ checked: selected }}
            style={styles.row}
            onPress={() => {
              if (!selected) setSelectedId(button.id);
            }}>
            {/* 점은 테두리 안쪽이 아니라 바깥 원 전체를 기준으로 가운데 맞춘다. 테두리 두께의 반올림에 영향받지 않는다 */}
            <View style={styles.outerCircle}>
              <View
                style={[StyleSheet.absoluteFill, styles.ring, selected ? styles.ringSelected : styles.ringUnselected]}
              />
              {selected && (
                <View style={[StyleSheet.absoluteFill, styles.dotCenter]}>
                  <View style={styles.dot} />
                </View>
              )}
            </View>
            <Text style={styles.label}>{button.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  group: { alignItems: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  outerCircle: { width: OUTER_SIZE, height: OUTER_SIZE },
  ring: { borderRadius: OUTER_SIZE / 2 },
  ringSelected: { borderWidth: BORDER_SELECTED, borderColor: theme.colors.primary },
  ringUnselected: { borderWidth: BORDER_UNSELECTED, borderColor: theme.colors.gray300 },
  dotCenter: { justifyContent: 'center', alignItems: 'center' },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: theme.colors.primary,
  },
  label: {
    marginLeft: 10,
    ...typographyStyles.body2,
    fontFamily: 'Pretendard-Medium', // 선택지 라벨은 body2 에서 굵기만 Medium
    color: theme.colors.gray900,
  },
});

export default Radio;
export { Radio };
