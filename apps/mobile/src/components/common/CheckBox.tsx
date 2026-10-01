import { Dispatch, ReactNode, SetStateAction } from 'react';
import { ViewStyle } from 'react-native';
import { Icon } from 'react-native-paper';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import { theme } from '@styles';

interface CheckBoxProps {
  isChecked: boolean;
  setIsChecked: Dispatch<SetStateAction<boolean>>;
  labelComponent: ReactNode;
  style?: ViewStyle;
}

const CheckBox: React.FC<CheckBoxProps> = ({ isChecked, setIsChecked, labelComponent, style }) => {
  return (
    <BouncyCheckbox
      fillColor={isChecked ? theme.colors.primary : theme.colors.gray300}
      unFillColor="white" // 기본은 투명이라 회색 배경 화면에서 상자가 회색으로 보이므로 흰색으로 채운다
      isChecked={isChecked}
      style={[{ gap: 8, flexShrink: 1, alignSelf: 'flex-start' }, style]}
      innerIconStyle={{ borderRadius: 7, borderWidth: isChecked ? 0 : 1.5 }}
      onPress={() => setIsChecked(!isChecked)}
      textComponent={labelComponent}
      size={22}
      iconStyle={{ borderRadius: 7 }}
      // 체크 전에는 아이콘을 그리지 않는다. 투명색으로 숨기면 안드로이드에서 검정으로 보인다
      iconComponent={isChecked ? <Icon source="check" size={16} color="white" /> : undefined}
    />
  );
};

export default CheckBox;
export { CheckBox };
