import { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { WEB_MAX_WIDTH } from '@utils/dimensions';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Typography from './Typography';
import { theme } from '@styles';

// 핸들·헤더를 잡고 끌어내려서 시트를 닫는 기준값
const CLOSE_DRAG_DISTANCE = 120; // 이 거리(px) 이상 끌어내리면 닫힘
const CLOSE_DRAG_VELOCITY = 0.5; // 거리가 짧아도 이 속도(px/ms) 이상으로 빠르게 내리면 닫힘
const DRAG_START_DISTANCE = 5; // 이 거리(px)보다 적게 움직이면 탭으로 보고 드래그를 시작하지 않음

// 시트 내용물(버튼 등) 아래에 안전 영역 위로 더하는 여백. 안드로이드는 제스처 막대가 이미 공간을 차지해 BottomBtnBox 와 같은 12 로 둔다
const SHEET_BOTTOM_GAP = Platform.select({ android: 12, default: 24 }) as number;

/**
 * 핸들·헤더 같은 전용 드래그 구역에 붙여서 아래로 끌어내리면 닫히게 하는 제스처 핸들러를 만든다.
 * - 끌고 있는 동안: 손가락을 따라 시트가 내려간다 (위로는 올라가지 않음)
 * - 손을 뗄 때: 충분히 내렸거나 빠르게 내렸으면 닫고, 아니면 제자리로 돌아온다
 * 터치가 시작될 때 바로 잡는다. 움직인 뒤에 잡는 방식(onMoveShouldSetPanResponder)은 안드로이드에서 판정이 넘어오지 않아 드래그가 안 된다.
 * 그래서 안의 버튼 터치를 가로채지 않도록 시트 전체가 아닌 구역에만 붙인다. 구역 안의 버튼은 더 안쪽 요소라 먼저 터치를 가져간다.
 */
function useDragToClose(panY: Animated.Value, snapBack: Animated.CompositeAnimation, close: () => void) {
  // snapBack/close는 매 렌더마다 새로 만들어지므로, 항상 최신 것을 쓰도록 ref에 담아둔다
  const latest = useRef({ snapBack, close });
  latest.current = { snapBack, close };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // 시작을 놓친 경우(다른 요소가 먼저 잡았다가 놓은 경우)를 위한 보조 판정
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > DRAG_START_DISTANCE && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        // 웹: 드래그 중 글자가 선택되면 브라우저가 제스처 종료를 요청하므로 거절해 계속 끌 수 있게 한다
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          panY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          const draggedFarEnough = gesture.dy > CLOSE_DRAG_DISTANCE;
          const flickedDownFast = gesture.dy > 0 && gesture.vy > CLOSE_DRAG_VELOCITY;
          if (draggedFarEnough || flickedDownFast) {
            latest.current.close();
          } else {
            latest.current.snapBack.start();
          }
        },
        // 다른 요소가 제스처를 가로채 드래그가 중단되면 제자리로
        onPanResponderTerminate: () => {
          latest.current.snapBack.start();
        },
      }),
    [panY],
  );

  return panResponder.panHandlers;
}

interface SimpleBottomSheetProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  title: string;
  content: ReactNode;
}

// 스크롤 없는 BottomSheet (짧은 내용)
const SimpleBottomSheet: React.FC<SimpleBottomSheetProps> = ({ visible, setVisible, title, content }) => {
  const screenHeight = Dimensions.get('screen').height;
  const panY = useRef(new Animated.Value(screenHeight)).current;
  const insets = useSafeAreaInsets();
  const translateY = panY.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, 1],
  });

  const resetBottomSheet = Animated.timing(panY, {
    toValue: 0,
    duration: 300,
    useNativeDriver: true,
  });

  const closeBottomSheet = Animated.timing(panY, {
    toValue: screenHeight,
    duration: 300,
    useNativeDriver: true,
  });

  useEffect(() => {
    if (visible) {
      resetBottomSheet.start();
    } else {
      closeBottomSheet.start();
    }
  }, [visible]);

  const closeModal = () => {
    closeBottomSheet.start(() => {
      setVisible(false);
    });
  };

  const dragToCloseHandlers = useDragToClose(panY, resetBottomSheet, closeModal);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.background} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={{
            ...styles.container,
            transform: [{ translateY: translateY }],
          }}>
          {/* 드래그 구역: 핸들과 헤더. 여기를 잡고 끌어내리면 닫힌다 */}
          <View {...dragToCloseHandlers}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Typography mode="subtitle1" color="gray900" style={styles.title}>
                {title}
              </Typography>
              <IconButton
                icon={'close'}
                size={20}
                onPress={closeModal}
                style={styles.closeBtn}
                iconColor={theme.colors.gray700}
              />
            </View>
          </View>

          {/* 콘텐츠 영역 */}
          {/* 내용물 아래 여백은 시트가 한 곳에서 책임진다. 안전 영역(제스처 막대·홈 인디케이터) 위에 SHEET_BOTTOM_GAP 만 더한다 */}
          <View style={[styles.content, { paddingBottom: insets.bottom + SHEET_BOTTOM_GAP }]}>{content}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  background: { flex: 1 },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    width: '100%',
    // 웹: 시트를 700px 프레임 폭에 맞춰 중앙 정렬하고, 드래그 중 글자 선택으로 제스처가 끊기지 않게 userSelect 를 막는다
    ...(Platform.OS === 'web'
      ? { maxWidth: WEB_MAX_WIDTH, alignSelf: 'center' as const, userSelect: 'none' as const }
      : null),
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    backgroundColor: theme.colors.gray200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { flex: 1 },
  closeBtn: { margin: 0, width: 36, height: 36, borderRadius: 18 },
  scrollArea: {
    flex: 1,
    maxHeight: '100%',
  },
  content: { paddingHorizontal: 20 },
});

export default SimpleBottomSheet;
export { SimpleBottomSheet };

/** 호환용 별칭 */
export const BottomSheet = SimpleBottomSheet;
