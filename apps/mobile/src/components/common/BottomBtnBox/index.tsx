import { Platform } from 'react-native';
import type { BottomBtnBoxProps } from './BottomBtnBox.ios';
import type { FC } from 'react';
import { controlSize } from '@styles';

/** 하단 버튼 상자의 위·아래 안쪽 여백 (BottomBtnBox.ios / .android 의 paddingTop·paddingBottom 과 같은 값) */
const BOTTOM_BTN_BOX_PADDING_TOP = 16;
// iOS 만 전용 파일(아래 여백 24)을 쓰고 안드로이드·웹은 같은 파일(아래 여백 12)을 쓰므로 그 분기와 똑같이 나눈다
const BOTTOM_BTN_BOX_PADDING_BOTTOM = Platform.select({ ios: 24, default: 12 }) as number;

/** 하단 버튼 상자의 전체 높이 (안전 영역 제외). 화면 내용을 버튼 위 영역에 맞춰 배치할 때 쓴다 */
export const BOTTOM_BTN_BOX_HEIGHT = BOTTOM_BTN_BOX_PADDING_TOP + controlSize.lg.height + BOTTOM_BTN_BOX_PADDING_BOTTOM;

/** 하단 버튼(lg) 높이. 키보드 위에 올라온 BottomBtnBox 만큼 ScreenWrapper keyboardBottomInset 과 스크롤 여백에 맞춤 */
export const BOTTOM_BTN_BOX_KEYBOARD_INSET = controlSize.lg.height;

let BottomBtnBox: FC<BottomBtnBoxProps>;

if (Platform.OS === 'ios') {
  BottomBtnBox = require('./BottomBtnBox.ios').default;
} else {
  BottomBtnBox = require('./BottomBtnBox.android').default;
}

export { BottomBtnBox };
export type { BottomBtnBoxProps };
