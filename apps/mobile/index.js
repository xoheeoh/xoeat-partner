import { registerRootComponent } from 'expo';
import { Platform, StyleSheet, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import App from './App';

/** 웹에서 앱이 브라우저 전체를 채우지 않도록 최대 폭 700px 로 제한하고 중앙에 둔다. */
export const WEB_MAX_WIDTH = 700;

function WebFrame({ children }) {
  if (Platform.OS !== 'web') return children;
  return (
    <View style={styles.backdrop}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

// Paper 의 Portal(드롭다운 목록·팝업)이 동작하려면 최상위에 PaperProvider 가 있어야 한다.
function Main() {
  return (
    <PaperProvider>
      <WebFrame>
        <App />
      </WebFrame>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', backgroundColor: '#EFEAE6' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_MAX_WIDTH,
    backgroundColor: '#fff',
    overflow: 'hidden',
    boxShadow: '0 0 40px rgba(0, 0, 0, 0.08)',
  },
});

registerRootComponent(Main);
