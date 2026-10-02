import { StyleSheet, View } from 'react-native';

import type { DailySales } from '@typ/domain';
import { Typography } from '@components/common';
import { theme } from '@styles';

interface MonthSalesChartProps {
  /** 이번 달 1일 ~ 오늘, 하루 한 줄. 마지막 항목의 날짜를 "오늘"로 본다 */
  days: DailySales[];
}

const BAR_AREA_HEIGHT = 72;

/** 주 묶음 경계(시작일). 1~7일 / 8~14일 / 15~21일 / 22일~말일 로 고정해서 매달 모양이 같게 한다 */
const WEEK_STARTS = [1, 8, 15, 22];

type Bucket = { label: string; sales: number; state: 'past' | 'current' | 'future' };

const toLabel = (n: number) => (n >= 10000 ? `${Math.round(n / 10000)}만` : n > 0 ? `${Math.round(n / 1000)}천` : '');

/** 날짜별 매출을 주 단위 4개로 묶는다. 아직 오지 않은 주는 future 로 표시한다 */
export const groupByWeek = (days: DailySales[]): Bucket[] => {
  if (days.length === 0) return [];
  const today = new Date(`${days[days.length - 1].date}T00:00:00`);
  const todayDate = today.getDate();
  const lastDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  return WEEK_STARTS.map((start, i) => {
    const end = i === WEEK_STARTS.length - 1 ? lastDate : WEEK_STARTS[i + 1] - 1;
    const sales = days.filter((d) => {
      const n = new Date(`${d.date}T00:00:00`).getDate();
      return n >= start && n <= end;
    }).reduce((sum, d) => sum + d.sales, 0);
    const state = todayDate < start ? 'future' : todayDate > end ? 'past' : 'current';
    return { label: `${start}~${end}일`, sales, state };
  });
};

/** 이번 달 매출 주 단위 막대. 이번 주는 브랜드색, 지난 주는 연한 색, 안 온 주는 점선 빈 막대. 라이브러리 없이 View 로 그린다 */
const MonthSalesChart: React.FC<MonthSalesChartProps> = ({ days }) => {
  const buckets = groupByWeek(days);
  const max = Math.max(1, ...buckets.map((b) => b.sales));

  return (
    <View style={styles.bars}>
      {buckets.map((b) => {
        const isCurrent = b.state === 'current';
        const isFuture = b.state === 'future';
        const h = isFuture ? BAR_AREA_HEIGHT * 0.35 : Math.max(b.sales > 0 ? 4 : 2, Math.round((b.sales / max) * BAR_AREA_HEIGHT));
        return (
          <View key={b.label} style={styles.col}>
            <Typography mode="caption2" color={isCurrent ? 'orange700' : 'gray400'} style={{ marginBottom: 4 }}>
              {isFuture ? ' ' : toLabel(b.sales)}
            </Typography>
            <View style={[styles.barTrack, { height: BAR_AREA_HEIGHT }]}>
              <View
                style={[
                  styles.bar,
                  { height: h },
                  isFuture ? styles.barFuture : { backgroundColor: isCurrent ? theme.colors.primary : theme.colors.orange200 },
                ]}
              />
            </View>
            <Typography mode="caption2" color={isCurrent ? 'orange700' : isFuture ? 'gray300' : 'gray500'} style={{ marginTop: 6 }}>
              {b.label}
            </Typography>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '60%', maxWidth: 40, borderRadius: 6 },
  barFuture: { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.gray200, backgroundColor: 'transparent' },
});

export default MonthSalesChart;
export { MonthSalesChart };
