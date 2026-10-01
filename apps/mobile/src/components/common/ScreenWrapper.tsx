import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
  hasHeader?: boolean;
  topComponent?: boolean;
  children: React.ReactNode;
  backgroundColor: string;
  keyboardOffsetOverride?: number; // 헤더 높이가 다른 화면용 오버라이드
  /** BottomBtnBox 등 하단 고정 버튼 높이만큼 iOS KeyboardAvoidingView 보정 (BOTTOM_BTN_BOX_KEYBOARD_INSET) */
  keyboardBottomInset?: number;
  /** 하단 탭 안의 화면이면 true. 탭바가 아래 안전 영역을 이미 차지하므로 bottom 여백을 넣지 않는다 */
  inTab?: boolean;
}

/** 공통 안전 영역 레이아웃 */
const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  hasHeader = true,
  topComponent = true,
  children,
  backgroundColor,
  keyboardOffsetOverride,
  keyboardBottomInset = 0,
  inTab = false,
}) => {
  const insets = useSafeAreaInsets();
  // 기본 오프셋 = 안전 영역 상단 + 헤더 높이(56)
  const defaultOffset = insets.top + 56;
  const offset = (keyboardOffsetOverride ?? defaultOffset) + keyboardBottomInset;
  const edges = [...(inTab ? [] : (['bottom'] as const)), 'left', 'right', ...(!hasHeader ? (['top'] as const) : [])] as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? offset : 0}>
        {/* topComponent 는 호환용 prop. 현재 디자인에서는 그리지 않는다 */}
        {topComponent && <View style={{ height: 0 }} />}

        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ScreenWrapper;
export { ScreenWrapper };
