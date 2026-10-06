import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ORDER_STATUS, ORDER_TYPE } from '@dt/constants';
import { ago, timeOnly, won } from '@utils/formatter';
import type { Order } from '@typ/domain';
import { Badge, Typography } from '@components/common';
import { theme } from '@styles';
import { OrderActions } from './OrderActions';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  onChanged: (order: Order) => void;
  /** 지난 내역처럼 액션 없이 보여 줄 때 */
  readonly?: boolean;
}

/** 주문 1건 카드: 요약(종류·상태·시간·메뉴·금액) + 상태별 액션 버튼 */
const OrderCard: React.FC<OrderCardProps> = ({ order, onPress, onChanged, readonly }) => {
  const st = ORDER_STATUS[order.status];
  const ty = ORDER_TYPE[order.orderType];
  const firstItem = order.items[0];
  const itemSummary = firstItem
    ? `${firstItem.menuName}${firstItem.quantity > 1 ? ` ${firstItem.quantity}개` : ''}${order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ''}`
    : '';
  const isPending = order.status === 'PENDING';

  return (
    <View style={[styles.card, isPending && styles.cardPending]}>
      <Pressable onPress={onPress} style={{ gap: 10 }}>
        <View style={styles.topRow}>
          <View style={styles.badges}>
            <Badge label={ty.label} tone={ty.tone} size="medium" />
            <Badge label={st.label} tone={st.tone} size="medium" />
          </View>
          <Typography mode="caption1" color={isPending ? 'orange700' : 'gray500'}>
            {isPending ? `${ago(order.createdAt)} 접수` : timeOnly(order.createdAt)}
          </Typography>
        </View>

        <View>
          <Typography mode="subtitle2" color="gray900" numberOfLines={1}>
            {itemSummary}
          </Typography>
          <Typography mode="caption1" color="gray500" style={{ marginTop: 2 }}>
            {order.orderNo} · {order.customerName}
            {order.orderType === 'DELIVERY' && order.address ? ` · ${order.address}` : ''}
          </Typography>
        </View>

        {!!order.requestMemo && (
          <View style={styles.memo}>
            <MaterialCommunityIcons name="message-text-outline" size={14} color={theme.colors.gray500} />
            <Typography mode="caption1" color="gray600" numberOfLines={1} style={{ flex: 1 }}>
              {order.requestMemo}
            </Typography>
          </View>
        )}

        <View style={styles.amountRow}>
          <Typography mode="caption1" color="gray500">
            {order.items.reduce((s, i) => s + i.quantity, 0)}개 상품
            {order.orderType === 'DELIVERY' ? ` · 배달비 ${won(order.deliveryFee)}` : ''}
          </Typography>
          <Typography mode="subtitle1" color="gray900">
            {won(order.totalAmount)}
          </Typography>
        </View>
      </Pressable>

      {!readonly &&
        (order.status === 'PENDING' ||
          order.status === 'ACCEPTED' ||
          order.status === 'READY' ||
          order.status === 'DELIVERING') && (
          <View style={styles.actions}>
            <OrderActions order={order} onChanged={onChanged} size="md" />
          </View>
        )}
      {(order.status === 'REJECTED' || order.status === 'CANCELED') && !!order.rejectReason && (
        <Typography mode="caption1" color="red600" style={{ marginTop: 10 }}>
          사유: {order.rejectReason}
        </Typography>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    padding: 16,
    boxShadow: theme.shadow.card,
  },
  cardPending: { borderWidth: 1.5, borderColor: theme.colors.orange300 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', gap: 6 },
  memo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  actions: { marginTop: 14 },
});

export default OrderCard;
export { OrderCard };
