import { Pressable, StyleSheet, View } from 'react-native';
import Typography from './Typography';
import { theme } from '@styles';

interface TabBarProps {
  active: 1 | 2;
  label1: string;
  label2: string;
  onPress1: () => void;
  onPress2: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ active, label1, label2, onPress1, onPress2 }) => {
  return (
    <View style={styles.container}>
      <Pressable style={[styles.tab, active === 1 && styles.tabActive]} onPress={onPress1}>
        <Typography mode="subtitle3" color={active === 1 ? 'gray900' : 'gray500'}>
          {label1}
        </Typography>
      </Pressable>
      <Pressable style={[styles.tab, active === 2 && styles.tabActive]} onPress={onPress2}>
        <Typography mode="subtitle3" color={active === 2 ? 'gray900' : 'gray500'}>
          {label2}
        </Typography>
      </Pressable>
    </View>
  );
};

/** 세그먼트 컨트롤 형태의 2탭 */
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.gray100,
  },
  tab: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.sm + 2 },
  tabActive: { backgroundColor: 'white', boxShadow: theme.shadow.card },
});

export default TabBar;
export { TabBar };
