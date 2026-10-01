module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.web.tsx', '.web.ts', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@screens': './src/screens',
            '@components': './src/components',
            '@utils': './src/utils',
            '@styles': './src/styles',
            '@typ': './src/types',
            '@contexts': './src/svc/contexts',
            '@images': './assets/images',
            '@apis': './src/svc/apis',
            '@storages': './src/svc/storages',
            '@dt': './src/svc/data',
            '@env': './src/shims/env',
            // 그라데이션은 expo-linear-gradient 를 같은 API 이름으로 연결한다.
            'react-native-linear-gradient': './src/shims/linear-gradient',
          },
        },
      ],
    ],
  };
};
