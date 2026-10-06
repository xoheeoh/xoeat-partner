import { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Typography } from './Typography';
import { theme } from '@styles';

type InfoBoxTone = 'gray' | 'yellow';

interface InfoBoxProps {
  /** 안내 문구. 문자열이면 기본 글자 모양으로, 직접 꾸민 요소를 넘겨도 된다 */
  children: ReactNode;
  /** gray: 일반 안내 / yellow: 주의가 필요한 안내 */
  tone?: InfoBoxTone;
  /** 아이콘 이름 (MaterialCommunityIcons). 기본은 정보 아이콘 */
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  style?: ViewStyle;
}

const ICON_SIZE = 18;
const ICON_BOX_HEIGHT = ICON_SIZE + 2; // 글자가 상자 끝에 닿아 잘리지 않도록 위아래 1px 여유
const TEXT_LINE_HEIGHT = 16; // caption1 줄 높이

const TONES: Record<InfoBoxTone, { bg: keyof typeof theme.colors; icon: keyof typeof theme.colors }> = {
  gray: { bg: 'gray50', icon: 'gray600' },
  yellow: { bg: 'yellow50', icon: 'yellow700' },
};

/**
 * 안내 상자: 연한 배경 위에 [아이콘 + 짧은 안내 문구].
 * 아이콘은 첫 줄 글자 높이에 맞춰 여러 줄 문구에서도 위로 뜨지 않는다.
 */
const InfoBox: React.FC<InfoBoxProps> = ({ children, tone = 'gray', icon = 'information-outline', style }) => {
  const colors = TONES[tone];

  return (
    <View style={[styles.box, { backgroundColor: theme.colors[colors.bg] }, style]}>
      <View style={styles.icon}>
        {/* Paper 의 Icon 은 lineHeight 를 size 로 고정해 안드로이드에서 글자 아래가 잘리므로 아이콘 글꼴을 직접 그린다 */}
        <MaterialCommunityIcons name={icon} size={ICON_SIZE} color={theme.colors[colors.icon]} style={styles.glyph} />
      </View>
      {typeof children === 'string' ? (
        <Typography mode="caption1" color="gray600" style={styles.text}>
          {children}
        </Typography>
      ) : (
        <View style={styles.text}>{children}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: theme.radius.md,
  },
  // 아이콘 글자 상자(20)의 중심을 caption1 첫 줄(16)의 중심(8)에 맞춘다: 20 / 2 - 2 = 8
  icon: {
    height: ICON_BOX_HEIGHT,
    marginTop: (TEXT_LINE_HEIGHT - ICON_BOX_HEIGHT) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 아이콘 글꼴의 글자 높이는 크기(18)와 정확히 같아 상자 끝에 닿는다. 안드로이드는 픽셀 반올림으로 아래 한 줄을 잘라내므로 줄 높이에 위아래 1px 여유를 준다
  glyph: { lineHeight: ICON_BOX_HEIGHT, includeFontPadding: false, textAlignVertical: 'center' },
  text: { flex: 1 },
});

export default InfoBox;
export { InfoBox };
