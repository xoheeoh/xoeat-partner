import type { RootStackParamList } from '@typ/navigation';
import React from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';

// Navigation 참조를 전역에서 사용하기 위한 변수
export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

// 웹 브라우저 탭 제목. 기본값은 화면 이름으로 바뀌므로 하나로 고정한다. 네이티브에서는 무시된다.
export const WEB_DOCUMENT_TITLE = 'Xoeat 사장님 | 주문은 바로, 메뉴는 간단히.';

// Provider 설정
export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <NavigationContainer ref={navigationRef} documentTitle={{ formatter: () => WEB_DOCUMENT_TITLE }}>
      {children}
    </NavigationContainer>
  );
};
