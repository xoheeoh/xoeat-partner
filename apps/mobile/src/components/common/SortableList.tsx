import { ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '@styles';

interface SortableListProps<T> {
  data: T[];
  keyOf: (item: T) => string;
  /** 모든 줄의 높이(px). 드래그 위치를 줄 번호로 바꾸는 데 쓰므로 줄 높이는 반드시 같아야 한다 */
  rowHeight: number;
  /** 손을 뗐을 때 from 번째 줄이 to 번째로 옮겨졌음을 알린다. 데이터 재배열은 호출한 쪽이 한다 */
  onReorder: (from: number, to: number) => void;
  /** 드래그 시작/끝. 바깥 스크롤을 잠그는 데 쓴다 */
  onDragChange?: (dragging: boolean) => void;
  /** 줄 내용. handle 을 원하는 자리에 넣으면 그곳을 잡고 끌 수 있다 */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
}

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.max(min, Math.min(max, v));
};

/**
 * 손잡이(≡)를 잡고 끌어 순서를 바꾸는 짧은 목록. 라이브러리 없이 gesture-handler + reanimated 로 만든다.
 * - 끄는 줄은 손가락을 따라 움직이고 살짝 떠오른다. 지나가는 줄들은 한 칸씩 자리를 비켜 준다.
 * - 손을 떼면 onReorder(from, to) 를 부르고 제자리로 돌아간다. 호출한 쪽이 데이터를 재배열하면 그 순서로 다시 그려진다.
 * 줄 높이가 같다는 전제로 위치 계산을 하므로, 수십 개 이하의 짧은 목록(카테고리 등)에 맞다.
 */
function SortableList<T>({ data, keyOf, rowHeight, onReorder, onDragChange, renderItem }: SortableListProps<T>) {
  // 끌고 있는 줄 번호(-1 이면 없음)와 그 줄이 시작점에서 움직인 거리
  const activeIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  return (
    <View>
      {data.map((item, index) => (
        <Row
          key={keyOf(item)}
          index={index}
          count={data.length}
          rowHeight={rowHeight}
          activeIndex={activeIndex}
          dragY={dragY}
          onReorder={onReorder}
          onDragChange={onDragChange}>
          {(handle) => renderItem(item, index, handle)}
        </Row>
      ))}
    </View>
  );
}

interface RowProps {
  index: number;
  count: number;
  rowHeight: number;
  activeIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onReorder: (from: number, to: number) => void;
  onDragChange?: (dragging: boolean) => void;
  children: (handle: ReactNode) => ReactNode;
}

const Row = ({ index, count, rowHeight, activeIndex, dragY, onReorder, onDragChange, children }: RowProps) => {
  // reanimated 의 shared value 는 .value 에 직접 쓰는 것이 공식 사용법이다. React Compiler 린트가 이를 "불변값 수정"으로 오해하므로 이 블록만 끈다
  /* eslint-disable react-hooks/immutability */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // 손잡이에서 바로 끌 수 있게 짧은 이동으로 시작한다. 바깥 스크롤은 onDragChange 로 잠근다
        .activeOffsetY([-4, 4])
        .onStart(() => {
          activeIndex.value = index;
          dragY.value = 0;
          if (onDragChange) runOnJS(onDragChange)(true);
        })
        .onUpdate((e) => {
          // 목록 밖으로는 못 나가게 한다
          dragY.value = clamp(e.translationY, -index * rowHeight, (count - 1 - index) * rowHeight);
        })
        .onEnd(() => {
          const to = clamp(Math.round(index + dragY.value / rowHeight), 0, count - 1);
          activeIndex.value = -1;
          dragY.value = 0;
          if (to !== index) runOnJS(onReorder)(index, to);
          if (onDragChange) runOnJS(onDragChange)(false);
        })
        .onFinalize(() => {
          // 제스처가 중간에 끊겨도 상태를 남기지 않는다
          if (activeIndex.value === index) {
            activeIndex.value = -1;
            dragY.value = 0;
            if (onDragChange) runOnJS(onDragChange)(false);
          }
        }),
    [index, count, rowHeight, activeIndex, dragY, onReorder, onDragChange],
  );
  /* eslint-enable react-hooks/immutability */

  const style = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active === -1) {
      return {
        transform: [{ translateY: withTiming(0, { duration: 150 }) }, { scale: withTiming(1, { duration: 150 }) }],
        zIndex: 0,
        boxShadow: 'none',
      };
    }
    if (active === index) {
      // 끄는 줄: 손가락을 따라가고 살짝 떠오른다
      return { transform: [{ translateY: dragY.value }, { scale: 1.02 }], zIndex: 10, boxShadow: theme.shadow.float };
    }
    // 다른 줄: 끄는 줄이 지나간 만큼 한 칸 비켜 준다
    const target = clamp(Math.round(active + dragY.value / rowHeight), 0, count - 1);
    let shift = 0;
    if (active < index && index <= target) shift = -rowHeight;
    else if (target <= index && index < active) shift = rowHeight;
    return {
      transform: [{ translateY: withSpring(shift, { damping: 20, stiffness: 220 }) }, { scale: 1 }],
      zIndex: 0,
      boxShadow: 'none',
    };
  });

  const handle = (
    <GestureDetector gesture={gesture}>
      <View style={styles.handle} accessibilityLabel="끌어서 순서 변경" accessibilityRole="button">
        <MaterialCommunityIcons name="drag-horizontal-variant" size={22} color={theme.colors.gray400} />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View style={[{ height: rowHeight, backgroundColor: theme.colors.white }, style]}>
      {children(handle)}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // 손잡이는 터치 영역을 넉넉히 잡는다
  handle: { width: 36, height: '100%', alignItems: 'center', justifyContent: 'center', cursor: 'grab' } as never,
});

export default SortableList;
export { SortableList };
