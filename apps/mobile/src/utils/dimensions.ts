import { Dimensions, Platform, useWindowDimensions } from 'react-native';

/** 웹에서는 앱이 최대 700px 프레임 안에 그려지므로(index.js), 화면 폭 계산도 그 폭을 기준으로 한다. */
export const WEB_MAX_WIDTH = 700;

export const getAppWidth = (): number => {
  const width = Dimensions.get('window').width;
  return Platform.OS === 'web' ? Math.min(width, WEB_MAX_WIDTH) : width;
};

/** 회전·창 크기 변화를 반영하는 훅 버전. 웹에서는 프레임 폭(700px)을 넘지 않는다. */
export const useAppWidth = (): number => {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, WEB_MAX_WIDTH) : width;
};
