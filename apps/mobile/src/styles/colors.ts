/**
 * 컬러 팔레트
 * - 화면 코드는 theme.colors.<key> 또는 Typography color="<key>" 로만 색을 참조한다.
 * - 브랜드 오렌지(#F0501E)는 "따끈한 음식이 바로 간다"는 인상. 회색은 살짝 따뜻한 기가 도는 웜 뉴트럴.
 * - 주문 상태 색: 접수대기=orange(브랜드), 조리중=blue, 배달중=purple, 완료=gray, 거절/취소=red
 */
const colors = {
  // 브랜드
  primary: '#F0501E',
  primaryDark: '#CC3F14',
  primarySoft: '#FFF1EC',
  mint: '#2FA463',
  disabled: '#E6E2DF',

  // 시맨틱 (라이트)
  bg: '#F8F6F4', // 화면 배경
  surface: '#FFFFFF', // 카드/시트
  surfaceAlt: '#F8F6F4', // 채워진 인풋, 눌림 배경
  line: '#E6E2DF', // 구분선
  lineStrong: '#D3CEC9',
  text: '#1C1917',
  textSub: '#6F6A66',
  textMuted: '#948E89',
  overlay: 'rgba(20, 16, 14, 0.45)',

  // 그레이 스케일 (웜)
  gray900: '#1C1917',
  gray800: '#292524',
  gray700: '#3D3835',
  gray600: '#57514D',
  gray500: '#6F6A66',
  gray400: '#948E89',
  gray300: '#B5AFAA',
  gray200: '#D3CEC9',
  gray150: '#E6E2DF',
  gray100: '#F0EDEA',
  gray50: '#F8F6F4',

  // 오렌지 (브랜드 스케일)
  orange900: '#7A2609',
  orange800: '#9A300D',
  orange700: '#B83912',
  orange600: '#CC3F14',
  orange500: '#F0501E',
  orange400: '#F5744C',
  orange300: '#F8977A',
  orange200: '#FBBBA7',
  orange100: '#FDDDD2',
  orange50: '#FFF1EC',

  red900: '#7F2225',
  red800: '#9E2A2E',
  red700: '#B83338',
  red600: '#D03D42',
  red500: '#E5484D',
  red400: '#EC6B6F',
  red300: '#F28D90',
  red200: '#F7B1B3',
  red100: '#FCD5D6',
  red50: '#FFEDEE',

  blue900: '#0E2C70',
  blue800: '#123C9C',
  blue700: '#174ECC',
  blue600: '#1E63F0',
  blue500: '#2F6BFF',
  blue400: '#5B8CFF',
  blue300: '#86A7FF',
  blue200: '#B3C8FF',
  blue100: '#D9E4FF',
  blue50: '#EEF3FF',

  purple900: '#3B1E7A',
  purple800: '#4C2A9C',
  purple700: '#5B35BD',
  purple600: '#6B42D9',
  purple500: '#7C53F0',
  purple400: '#9876F5',
  purple300: '#B59BF8',
  purple200: '#D0C0FB',
  purple100: '#E6DDFD',
  purple50: '#F3EEFF',

  green900: '#155230',
  green800: '#1C6A3E',
  green700: '#207A47',
  green600: '#25864F',
  green500: '#2FA463',
  green400: '#4CC57F',
  green300: '#7AD5A0',
  green200: '#A8E4C0',
  green100: '#D2F1DF',
  green50: '#E9F8EF',

  yellow900: '#8A5C08',
  yellow800: '#A8700A',
  yellow700: '#C4830B',
  yellow600: '#D68F0C',
  yellow500: '#E89B0C',
  yellow400: '#F0B23C',
  yellow300: '#F5C66A',
  yellow200: '#F9D998',
  yellow100: '#FCEAC4',
  yellow50: '#FFF5E1',

  white: '#ffffff',
  black: '#000000',
};

export default colors;
