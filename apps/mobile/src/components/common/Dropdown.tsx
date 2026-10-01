import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Portal } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

import Typography from './Typography';
import { controlSize, theme } from '@styles';

interface DropdownProps {
  placeholder: string;
  options: string[];
  onSelect?: (selectedOption: string) => void;
  /** 크기 단계. lg 는 입력칸·검색창과 나란히 놓이는 기본, md 는 목록 위 필터처럼 작은 자리용 */
  size?: 'lg' | 'md';
  onOpen?: 'options' | 'modal';
  openEvent?: () => void;
  dismissKeyboardOnOpen?: boolean;
}

interface DropDownHandle {
  close: () => void;
}

type WindowPoint = { x: number; y: number };

/**
 * 옵션 목록은 셀렉트 박스의 창 좌표를 재서 Portal(최상위 층)에 그린다.
 * 화면 스크롤 뷰 밖에 그려지므로 형제 요소에 가리지 않고, 목록 안 스크롤이 바깥 스크롤에 먹히지 않는다.
 * 좌표는 두 가지를 보정한다.
 * - 키보드가 떠 있으면 화면이 밀려 있어 잘못 재므로, 키보드가 닫히고 배치가 돌아온 뒤에 잰다.
 * - Portal 층의 위치도 같은 방법으로 재서 차이를 뺀다. 층이 창 맨 위가 아닌 환경에서도 맞는다.
 */
const Dropdown = forwardRef<DropDownHandle, DropdownProps>(
  (
    { placeholder, options, onSelect, size = 'lg', onOpen = 'options', openEvent, dismissKeyboardOnOpen = true },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [selectedOption, setSelectedOption] = useState<string>(placeholder);
    const [activeOption, setActiveOption] = useState<string | null>(null);

    const selectRef = useRef<View | null>(null);
    const portalLayerRef = useRef<View | null>(null);
    const [selectBox, setSelectBox] = useState<{ left: number; width: number; top: number } | null>(null);
    const [portalOrigin, setPortalOrigin] = useState<WindowPoint | null>(null);
    // 키보드가 닫히길 기다리는 구독. 화면을 떠나거나 다시 누르면 정리한다
    const pendingOpenRef = useRef<{ remove: () => void } | null>(null);

    useImperativeHandle(ref, () => ({
      close: () => setIsOpen(false),
    }));

    // 화면을 벗어날 때 열린 드롭다운을 닫는다
    useFocusEffect(
      useCallback(() => {
        return () => {
          setIsOpen(false);
          pendingOpenRef.current?.remove();
          pendingOpenRef.current = null;
        };
      }, []),
    );

    useEffect(() => () => pendingOpenRef.current?.remove(), []);

    // findNodeHandle + UIManager.measure 는 웹에서 에러가 나므로 measureInWindow 를 쓴다
    const measureAndOpen = () => {
      selectRef.current?.measureInWindow((x, y, width, height) => {
        setSelectBox({ left: x, width, top: y + height + OPTION_BOX_GAP });
        setIsOpen(true);
      });
    };

    const handlePress = () => {
      if (isOpen) {
        setIsOpen(false);
        return;
      }

      if (dismissKeyboardOnOpen && Keyboard.isVisible()) {
        // 키보드가 내려가고 스크롤 여백이 원래대로 돌아온 뒤에 재야 위치가 맞는다
        Keyboard.dismiss();
        pendingOpenRef.current?.remove();
        const sub = Keyboard.addListener('keyboardDidHide', () => {
          sub.remove();
          pendingOpenRef.current = null;
          setTimeout(measureAndOpen, 50);
        });
        pendingOpenRef.current = sub;
        return;
      }

      measureAndOpen();
    };

    const handleModalOpen = () => {
      if (dismissKeyboardOnOpen) Keyboard.dismiss();
      openEvent?.();
    };

    const handleSelectOption = (option: string) => {
      setSelectedOption(option);
      setIsOpen(false);
      onSelect?.(option);
    };

    // Portal 층의 창 좌표. 셀렉트 박스 좌표와 같은 창 기준이라 둘의 차이가 곧 보정값이다
    const measurePortalOrigin = () => {
      portalLayerRef.current?.measureInWindow((x, y) => setPortalOrigin({ x, y }));
    };

    return (
      <View ref={selectRef} style={{ position: 'relative' }}>
        <Pressable
          style={[
            styles.select,
            {
              borderColor: isOpen ? theme.colors.primary : theme.colors.line, // 입력칸과 같은 테두리 규칙
              backgroundColor: isOpen ? theme.colors.white : theme.colors.gray50,
              height: controlSize[size].height,
              borderRadius: controlSize[size].radius,
            },
          ]}
          onPress={onOpen === 'options' ? handlePress : handleModalOpen}>
          {/* 입력칸·옵션 목록과 같은 body2 */}
          <Typography mode="body2" color="gray900" numberOfLines={1} style={{ flexShrink: 1 }}>
            {selectedOption}
          </Typography>

          <Icon source={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.gray500} />
        </Pressable>

        {/* 옵션 리스트. 바깥을 누르면 닫힌다. Portal 층 좌표를 알기 전에는 목록을 그리지 않아 잘못된 자리에 한 번 보이는 깜빡임을 막는다 */}
        {isOpen && selectBox && (
          <Portal>
            <View
              ref={portalLayerRef}
              style={StyleSheet.absoluteFill}
              onLayout={measurePortalOrigin}
              collapsable={false}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} />
              {portalOrigin && (
                <View
                  style={[
                    styles.optionBox,
                    {
                      left: selectBox.left - portalOrigin.x,
                      width: selectBox.width,
                      top: selectBox.top - portalOrigin.y,
                    },
                  ]}>
                  <FlatList
                    nestedScrollEnabled={true}
                    data={options}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                      <Pressable
                        style={[styles.optionItem, activeOption === item && styles.active]}
                        onPress={() => handleSelectOption(item)}
                        onPressIn={() => setActiveOption(item)}
                        onPressOut={() => setActiveOption(null)}>
                        <Typography mode="body2" color="gray900">
                          {item}
                        </Typography>
                      </Pressable>
                    )}
                  />
                </View>
              )}
            </View>
          </Portal>
        )}
      </View>
    );
  },
);

// 셀렉트 박스와 옵션 리스트 사이 간격
const OPTION_BOX_GAP = 8;
// 옵션 리스트 상자의 최대 높이. 넘치면 안에서 스크롤된다
const OPTION_BOX_MAX_HEIGHT = 200;

const styles = StyleSheet.create({
  select: {
    borderWidth: 1.5,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 높이는 내용에 맞게 자라고 최대치만 둔다. 항목 높이를 숫자로 계산해 고정하면 글자 크기가 바뀔 때 아래에 빈 공간이 남는다
  optionBox: {
    position: 'absolute',
    maxHeight: OPTION_BOX_MAX_HEIGHT,
    backgroundColor: 'white',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line, // 셀렉트 박스의 평소 테두리와 같은 색
    paddingHorizontal: 8,
    paddingVertical: 8,
    overflow: 'hidden',
    boxShadow: theme.shadow.float,
  },
  optionItem: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radius.sm },
  active: { backgroundColor: theme.colors.gray100 },
});

Dropdown.displayName = 'Dropdown';

export default Dropdown;
export { Dropdown };
