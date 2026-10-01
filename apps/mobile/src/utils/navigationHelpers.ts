import { CommonActions } from '@react-navigation/native';

type Nav = { dispatch: (action: ReturnType<typeof CommonActions.reset>) => void };

/** 로그인 성공 → 스택을 비우고 메인 탭으로 */
export const goToMain = (navigation: Nav) => {
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
};

/** 로그아웃·세션 만료 → 로그인으로 */
export const goToLogin = (navigation: Nav) => {
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
};
