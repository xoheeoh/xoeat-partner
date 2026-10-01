import colors from './colors';

/** 모서리 반경 */
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

/** 간격 (4pt 그리드) */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/**
 * 화면 내용의 위·아래 바깥 여백.
 * 헤더(높이 56)는 제목 아래에 이미 빈 공간을 갖고 있고, 아래쪽은 안전 영역(제스처 막대·홈 인디케이터)이 빈 공간으로 보이므로 크게 띄우지 않는다.
 */
export const screen = {
  /** 첫 내용이 글자·입력칸인 폼 화면 */
  topForm: 16,
  /** 첫 내용이 카드인 화면. 카드 안쪽 여백이 숨 쉴 공간을 대신한다 */
  topCard: 8,
  /** 하단 고정 버튼이 없는 화면의 아래 여백. 안전 영역 위에 더한다. 버튼이 있는 화면은 KeyboardAwareScrollView 가 따로 계산한다 */
  bottom: 16,
} as const;

/** 그림자 - RN 0.76+ / web 공통 boxShadow 문자열 */
export const shadow = {
  card: '0 1px 2px rgba(21, 23, 29, 0.04), 0 6px 20px rgba(21, 23, 29, 0.06)',
  float: '0 8px 28px rgba(21, 23, 29, 0.12)',
  primary: '0 10px 24px rgba(240, 80, 30, 0.28)',
} as const;

/** 다크 모드 시맨틱 토큰. 현재 앱은 라이트 고정이며, 적용 시 colors 의 시맨틱 키를 이 값으로 바꾼다 */
export const darkColors = {
  primary: '#F5744C',
  primaryDark: '#F0501E',
  primarySoft: 'rgba(245, 116, 76, 0.14)',
  bg: '#0C0D11',
  surface: '#15171D',
  surfaceAlt: '#23262F',
  line: '#23262F',
  lineStrong: '#343947',
  text: '#F6F7FA',
  textSub: '#AEB5C2',
  textMuted: '#8B93A3',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const theme = {
  colors,
  radius,
  space,
  shadow,
  screen,
};

export default theme;
