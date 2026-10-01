// Expo 기본 Metro 설정 + 웹용 woff2 폰트를 에셋으로 취급
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'woff2', 'otf']));

module.exports = config;
