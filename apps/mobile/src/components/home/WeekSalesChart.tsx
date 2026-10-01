import { StyleSheet, View } from 'react-native';

import { Typography } from '@components/common';
import { theme } from '@styles';

interface WeekSalesChartProps {
  data: Array<{ date: string; sales: number; orderCount: number }>;
}

const BAR_AREA_HEIGHT = 96;

/** 최근 7일 매출 막대. 오늘은 브랜드색, 나머지는 연한 색. 라이브러리 없이 View 로 그린다 */
const WeekSalesChart: React.FC<WeekSalesChartProps> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.sales));
  const todayIdx = data.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {data.map((d, i) => {
          const h = Math.max(d.sales > 0 ? 4 : 2, Math.round((d.sales / max) * BAR_AREA_HEIGHT));
          const day = new Date(`${d.date}T00:00:00`);
          const isToday = i === todayIdx;
          return (
            <View key={d.date} style={styles.col}>
              <Typography mode="caption2" color={isToday ? 'orange700' : 'gray400'} style={{ marginBottom: 4 }}>
                {d.sales >= 10000 ? `${Math.round(d.sales / 10000)}만` : d.sales > 0 ? `${Math.round(d.sales / 1000)}천` : ''}
              </Typography>
              <View style={[styles.barTrack, { height: BAR_AREA_HEIGHT }]}>
                <View style={[styles.bar, { height: h, backgroundColor: isToday ? theme.colors.primary : theme.colors.orange200 }]} />
              </View>
              <Typography mode="caption1" color={isToday ? 'orange700' : 'gray500'} style={{ marginTop: 6 }}>
                {isToday ? '오늘' : `${day.getDate()}일`}
              </Typography>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 28, borderRadius: 6 },
});

export default WeekSalesChart;
export { WeekSalesChart };
