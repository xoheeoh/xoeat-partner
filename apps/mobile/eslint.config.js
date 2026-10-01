// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // React Compiler 전제의 규칙. 애니메이션 값(Animated.Value)을 ref 에 두고 렌더에서 읽는 공통 컴포넌트와
      // "화면 진입 시 목록 비우고 다시 조회" 패턴을 경고로 낮춘다. 컴파일러를 켤 때 다시 올린다.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
