import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, LayoutAnimation, ViewStyle } from 'react-native';
import { PrimaryButton } from '../PrimaryButton';
import { BottomBtnBoxProps } from './BottomBtnBox.ios';

const BottomBtnBox: React.FC<BottomBtnBoxProps> = ({
  buttonKey,
  disabled,
  label,
  onPress,
  backgroundColor = 'white',
}) => {
  const paddingAnim = useRef(new Animated.Value(1)).current; // 1: 기본 padding, 0: 타이트
  const [opacityAnim] = useState(new Animated.Value(1));
  const bottomAnim = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);

  useEffect(() => {
    const didShowSub = Keyboard.addListener('keyboardDidShow', (event) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);

      const keyboardHeight = event.endCoordinates?.height ?? 0;
      Animated.parallel([
        Animated.timing(bottomAnim, {
          toValue: keyboardHeight,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(paddingAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    });

    const didHideSub = Keyboard.addListener('keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);

      Animated.parallel([
        Animated.timing(bottomAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(paddingAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    });

    return () => {
      didShowSub.remove();
      didHideSub.remove();
    };
  }, [bottomAnim, opacityAnim, paddingAnim]);

  const containerStyle: Animated.WithAnimatedObject<ViewStyle> = {
    position: 'absolute',
    bottom: bottomAnim,
    width: '100%',
    backgroundColor,
    paddingHorizontal: paddingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 16],
    }),
    // ScreenWrapper 가 제스처 막대 높이만큼 이미 비워 두므로, 그 위에 더하는 여백은 iOS(24)보다 작게 잡는다
    paddingBottom: paddingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 12],
    }),
    paddingTop: paddingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 16],
    }),
    opacity: opacityAnim,
  };

  return (
    <Animated.View style={containerStyle}>
      <PrimaryButton
        key={buttonKey}
        disabled={disabled}
        label={label}
        onPress={onPress}
        size={'lg'}
        keyboardVisible={keyboardVisible}
      />
    </Animated.View>
  );
};

export default BottomBtnBox;
