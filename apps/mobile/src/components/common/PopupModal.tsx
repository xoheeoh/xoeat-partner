import { Platform, StyleSheet, View } from 'react-native';
import { WEB_MAX_WIDTH } from '@utils/dimensions';
import { Modal, Portal } from 'react-native-paper';
import Typography from './Typography';
import { theme } from '@styles';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

interface PopupModalProps {
  visible: boolean;
  close?: () => void;
  title?: string;
  message1: string;
  message2?: string;
  button1Label: string;
  button1Event: () => void;
  button2Label?: string;
  button2Event?: () => void;
}

const PopupModal: React.FC<PopupModalProps> = ({
  visible,
  close,
  title,
  message1,
  message2,
  button1Label,
  button1Event,
  button2Label,
  button2Event,
}) => {
  return (
    <Portal>
      <Modal
        visible={visible}
        contentContainerStyle={styles.popup}
        onDismiss={close}
        dismissable={false}
        style={{ backgroundColor: theme.colors.overlay }}>
        <View style={[styles.titleBox, { justifyContent: title ? 'flex-start' : 'flex-end' }]}>
          {title && (
            <Typography mode="subtitle1" color="gray900">
              {title}
            </Typography>
          )}
        </View>

        <View>
          <Typography mode="body1" color="gray600">
            {message1}
          </Typography>
          {message2 && (
            <Typography mode="body1" color="gray600">
              {message2}
            </Typography>
          )}
        </View>

        {/* 버튼 - 두 개면 가로로 나란히 (보조 왼쪽 · 기본 오른쪽) */}
        <View style={styles.buttons}>
          {button2Label && button2Event && (
            <SecondaryButton label={button2Label} onPress={button2Event} size={'lg'} style={{ flex: 1 }} />
          )}
          <PrimaryButton label={button1Label} onPress={button1Event} size={'lg'} style={{ flex: 1 }} />
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  popup: {
    backgroundColor: 'white',
    margin: 24,
    borderRadius: theme.radius.xl,
    gap: 12,
    padding: 24,
    boxShadow: theme.shadow.float,
    // 웹: Portal 이 700px 프레임 바깥에 그리므로 프레임 폭에 맞춰 중앙 정렬한다
    ...(Platform.OS === 'web'
      ? { width: '100%' as const, maxWidth: WEB_MAX_WIDTH - 48, alignSelf: 'center' as const }
      : null),
  },
  titleBox: { flexDirection: 'row', alignItems: 'center' },
  buttons: { flexDirection: 'row', gap: 8, paddingTop: 12 },
});

export default PopupModal;
export { PopupModal };
