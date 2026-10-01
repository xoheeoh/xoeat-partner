import { StyleSheet, View } from 'react-native';
import { ToastConfigParams } from 'react-native-toast-message';
import { Icon } from 'react-native-paper';

import { Typography } from './Typography';
import { theme } from '@styles';
import { getAppWidth } from '@utils/dimensions';

type ToastTone = 'success' | 'error';

/** 톤별 아이콘과 색 */
const TONES: Record<ToastTone, { icon: string; iconColor: string; iconBg: string }> = {
  success: { icon: 'check', iconColor: theme.colors.green400, iconBg: 'rgba(76, 197, 127, 0.18)' },
  error: { icon: 'close', iconColor: theme.colors.red400, iconBg: 'rgba(236, 107, 111, 0.18)' },
};

/**
 * 성공·오류 토스트 공통 모양.
 * 폭은 내용에 맞추고 최대 폭만 화면 기준으로 제한한다. 아이콘은 글자 블록 전체의 세로 가운데에 맞춘다.
 */
const ToastItem = ({ text1, text2, tone }: ToastConfigParams<any> & { tone: ToastTone }) => {
  const { icon, iconColor, iconBg } = TONES[tone];

  return (
    <View style={styles.toast}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon source={icon} size={16} color={iconColor} />
      </View>

      <View style={styles.text}>
        <Typography mode="subtitle3" color="white">
          {text1}
        </Typography>
        {text2 ? (
          <Typography mode="caption1" color="gray300">
            {text2}
          </Typography>
        ) : null}
      </View>
    </View>
  );
};

/** Toast 컴포넌트의 config 에 그대로 넘긴다. type: 'success' | 'error' 로 골라 쓴다 */
export const toastConfig = {
  success: (props: ToastConfigParams<any>) => <ToastItem {...props} tone="success" />,
  error: (props: ToastConfigParams<any>) => <ToastItem {...props} tone="error" />,
};

const styles = StyleSheet.create({
  toast: {
    maxWidth: getAppWidth() - 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: 'rgba(21, 23, 29, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: theme.shadow.float,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 남는 폭 안에서만 줄바꿈되고 카드 밖으로 나가지 않게 한다
  text: { flexShrink: 1, gap: 2 },
});

export default toastConfig;
