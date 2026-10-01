import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, ScrollViewProps, TextInput, findNodeHandle, UIManager } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AutoScrollStrategy = 'focused-input';

/**
 * 스크롤 뷰 안의 입력칸이 포커스될 때 알려 주는 통로.
 * 키보드가 이미 떠 있는 상태에서 다음 칸으로 포커스만 옮기면 키보드 이벤트가 새로 오지 않아,
 * 입력칸 쪽에서 직접 알려 줘야 그 칸을 키보드 위로 스크롤할 수 있다.
 */
const KeyboardAwareScrollContext = createContext<{ onInputFocus: () => void } | null>(null);

/** AnimatedTextInput·Textarea 가 포커스 시 호출한다. KeyboardAwareScrollView 밖에서는 아무 일도 하지 않는다. */
export const useNotifyInputFocus = () => {
  const ctx = useContext(KeyboardAwareScrollContext);
  return ctx?.onInputFocus ?? (() => {});
};

export interface KeyboardAwareScrollViewProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  /**
   * 화면 하단에 absolute로 떠 있는 UI(BottomBtnBox 등) 높이 합.
   * 키보드가 올라왔을 때 입력칸이 이 영역에 가리지 않도록 스크롤 오프셋에 반영함.
   */
  keyboardAccessoryHeight?: number;
  /**
   * iOS에서 키보드가 올라왔을 때 기본으로 확보할 하단 여백. (기본값 60)
   */
  iosBaseBottomPadding?: number;
  /**
   * Android에서 기본으로 확보할 하단 여백. (기본값 48)
   * keyboardAccessoryHeight(버튼 56)와 합쳐 하단 버튼 상자 전체 높이(84)보다 커야 마지막 내용이 상자에 가리지 않는다.
   */
  androidBaseBottomPadding?: number;
  /** 추가로 더할 하단 padding */
  extraBottomPadding?: number;
  /**
   * 키보드 등장 시 현재 포커스된 입력칸을 자동으로 보이게 스크롤.
   * 기본은 켜짐.
   */
  autoScrollStrategy?: AutoScrollStrategy | 'none';
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}

/**
 * 키보드 대응 공통 ScrollView.
 * - 키보드 등장 시 현재 포커스된 입력칸을 자동으로 키보드 위로 올린다
 * - BottomBtnBox 같이 absolute 하단 UI 가 키보드 위에 뜨는 경우를 keyboardAccessoryHeight 로 반영한다
 */
const KeyboardAwareScrollView = React.forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  (
    {
      keyboardAccessoryHeight = 0,
      iosBaseBottomPadding = 60,
      androidBaseBottomPadding = 48,
      extraBottomPadding = 0,
      autoScrollStrategy = 'focused-input',
      keyboardShouldPersistTaps = 'handled',
      contentContainerStyle,
      onScrollBeginDrag,
      ...rest
    },
    forwardedRef,
  ) => {
    const insets = useSafeAreaInsets();
    // 스택 아래에 남아 있는 이전 화면도 키보드 이벤트를 받는다. 지금 보이는 화면의 스크롤 뷰만 움직여야 하므로 화면 포커스를 확인한다.
    // 이전 화면이 남의 입력칸을 자기 스크롤 뷰 기준으로 측정하면 "Error measuring text field" 경고가 난다.
    const navigation = useContext(NavigationContext);
    const isScreenVisible = () => !navigation || navigation.isFocused();
    const innerRef = useRef<ScrollView>(null);
    // 내부 로직은 항상 innerRef를 사용하고, 외부 ref(object/function)는 동기화만 해줌.
    const setRefs = (node: ScrollView | null) => {
      innerRef.current = node;
      if (!forwardedRef) return;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else {
        (forwardedRef as React.MutableRefObject<ScrollView | null>).current = node;
      }
    };

    const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
    const scrollYRef = useRef(0);

    const baseBottomPadding = Platform.OS === 'ios' ? iosBaseBottomPadding : androidBaseBottomPadding;
    const computedBottomPadding = useMemo(() => {
      const keyboardPadding = Platform.OS === 'android' ? androidKeyboardHeight : 0;
      return baseBottomPadding + keyboardAccessoryHeight + extraBottomPadding + keyboardPadding;
    }, [androidKeyboardHeight, baseBottomPadding, extraBottomPadding, keyboardAccessoryHeight]);

    const scrollToFocusedInput = (delayMs: number) => {
      const sv = innerRef.current;
      if (!sv || !isScreenVisible()) return;

      const maybeFocusedInput = (TextInput as any).State?.currentlyFocusedInput?.();
      const node = findNodeHandle(maybeFocusedInput ?? null);

      if (!node) return;

      const responder = (sv as any).getScrollResponder?.() ?? (sv as any);
      // 키보드 위에서 "추가로 띄울" 공간.
      // - accessory(BottomBtnBox 등) 높이
      // - 화면에서 확보하는 기본/추가 bottom padding (ScrollView content inset 역할)
      // - 멀티라인 입력(Textarea)에서 커서가 더 아래로 내려가는 케이스를 위한 여유
      const basePadding = baseBottomPadding + extraBottomPadding;
      const safetyMargin = Platform.OS === 'android' ? 48 : 60;
      const extraOffset = insets.bottom + keyboardAccessoryHeight + basePadding + safetyMargin;

      setTimeout(() => {
        responder.scrollResponderScrollNativeHandleToKeyboard?.(node, extraOffset, true);
      }, delayMs);
    };

    const scrollToFocusedInputByMeasurementIOS = (keyboardScreenY: number, delayMs: number) => {
      if (Platform.OS !== 'ios') return;
      const sv = innerRef.current;
      if (!sv || !isScreenVisible()) return;

      const maybeFocusedInput = (TextInput as any).State?.currentlyFocusedInput?.();
      const node = findNodeHandle(maybeFocusedInput ?? null);
      if (!node) return;

      // 키보드 상단 위로 확보할 영역: accessory 높이 + 기기·폰트 편차 여유.
      // iOS 의 endCoordinates.screenY 는 키보드 top 좌표라 safe-area bottom 을 따로 빼면 과보정된다.
      const margin = 12;
      const visibleBottomY = keyboardScreenY - keyboardAccessoryHeight - margin;

      setTimeout(() => {
        UIManager.measureInWindow(node, (_x: number, y: number, _w: number, h: number) => {
          const inputBottomY = y + h;
          const overlap = inputBottomY - visibleBottomY;
          if (overlap <= 0) return;

          const nextY = scrollYRef.current + overlap;
          // scrollTo가 없거나 ref가 ScrollResponder 형태인 경우를 대비
          (sv as any).scrollTo?.({ y: nextY, animated: true });
        });
      }, delayMs);
    };

    useEffect(() => {
      if (Platform.OS !== 'android') return;

      const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
        setAndroidKeyboardHeight(e.endCoordinates?.height ?? 0);
      });
      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        setAndroidKeyboardHeight(0);
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    useEffect(() => {
      if (autoScrollStrategy === 'none') return;

      // Android는 keyboardDidShow에서 안정적으로 스크롤.
      // iOS는 willShow/didShow 타이밍이 기기별로 달라서 둘 다 2회씩 보정함.
      const subs =
        Platform.OS === 'ios'
          ? [
              Keyboard.addListener('keyboardWillShow', () => {
                scrollToFocusedInput(0);
                scrollToFocusedInput(80);
              }),
              Keyboard.addListener('keyboardDidShow', () => {
                scrollToFocusedInput(0);
                scrollToFocusedInput(80);
              }),
            ]
          : [
              Keyboard.addListener('keyboardDidShow', () => {
                scrollToFocusedInput(50);
                scrollToFocusedInput(250);
              }),
            ];

      return () => {
        subs.forEach((s) => s.remove());
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoScrollStrategy, keyboardAccessoryHeight, insets.bottom]);

    useEffect(() => {
      if (autoScrollStrategy === 'none') return;
      if (Platform.OS !== 'ios') return;

      // iOS: scrollResponderScrollNativeHandleToKeyboard가 덜 올라오는 케이스가 있어,
      // measureInWindow로 실제 겹침을 계산해서 "필요한 만큼만" 추가 scrollTo로 보정함.
      const subs = [
        Keyboard.addListener('keyboardWillShow', (e) => {
          scrollToFocusedInputByMeasurementIOS(e.endCoordinates?.screenY ?? 0, 0);
          scrollToFocusedInputByMeasurementIOS(e.endCoordinates?.screenY ?? 0, 80);
        }),
        Keyboard.addListener('keyboardDidShow', (e) => {
          scrollToFocusedInputByMeasurementIOS(e.endCoordinates?.screenY ?? 0, 0);
          scrollToFocusedInputByMeasurementIOS(e.endCoordinates?.screenY ?? 0, 80);
        }),
      ];
      return () => subs.forEach((s) => s.remove());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoScrollStrategy, keyboardAccessoryHeight, insets.bottom]);

    // 키보드가 이미 떠 있는데 다른 입력칸으로 포커스가 옮겨진 경우. 키보드 show 이벤트가 없으므로 여기서 스크롤한다.
    // 키보드가 아직 없으면 곧 올 show 이벤트가 처리하므로 건너뛴다.
    const handleInputFocusRef = useRef(() => {});
    useEffect(() => {
      // 매 렌더 뒤 최신 props 를 보는 함수로 바꿔 둔다
      handleInputFocusRef.current = () => {
        if (autoScrollStrategy === 'none') return;
        if (!Keyboard.isVisible()) return;
        // 키보드가 이미 떠 있어 배치가 안정된 상태라 한 번만 스크롤한다. 두 번 하면 두 단계로 덜컹인다
        scrollToFocusedInput(50);
        if (Platform.OS === 'ios') {
          const screenY = Keyboard.metrics()?.screenY ?? 0;
          scrollToFocusedInputByMeasurementIOS(screenY, 80);
        }
      };
    });
    // 입력칸이 매 렌더마다 다시 그려지지 않도록 컨텍스트 값은 한 번만 만든다
    const focusContextValue = useMemo(() => ({ onInputFocus: () => handleInputFocusRef.current() }), []);

    const handleScrollBeginDrag = (e: any) => {
      // 화면이 스크롤 시작 시 드롭다운 같은 오버레이를 닫을 수 있게 그대로 전달한다
      onScrollBeginDrag?.(e);
    };

    // 첫 포커스는 키보드 show 이벤트가, 키보드가 떠 있는 채로 옮기는 포커스는 위 컨텍스트가 스크롤을 맡는다

    return (
      <KeyboardAwareScrollContext.Provider value={focusContextValue}>
        <ScrollView
          ref={setRefs}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
            (rest as any).onScroll?.(e);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[contentContainerStyle, { paddingBottom: computedBottomPadding }]}
          {...rest}
        />
      </KeyboardAwareScrollContext.Provider>
    );
  },
);

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';

export default KeyboardAwareScrollView;
export { KeyboardAwareScrollView };
