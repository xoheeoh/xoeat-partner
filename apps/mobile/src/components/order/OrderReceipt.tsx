import { StyleSheet, View } from 'react-native';

import { won } from '@utils/formatter';
import type { Order } from '@typ/domain';
import { Typography } from '@components/common';
import { theme } from '@styles';

/** 주문 항목과 금액 합계. 상세 화면과 목록 카드 확장에서 같이 쓴다 */
const OrderReceipt: React.FC<{ order: Order }> = ({ order }) => (
  <View style={{ gap: 12 }}>
    {order.items.map((item) => (
      <View key={item.id} style={{ gap: 4 }}>
        <View style={styles.row}>
          <Typography mode="subtitle3" color="gray900" style={{ flex: 1 }}>
            {item.menuName} <Typography mode="body2" color="gray500">× {item.quantity}</Typography>
          </Typography>
          <Typography mode="subtitle3" color="gray900">
            {won(item.lineAmount)}
          </Typography>
        </View>
        {item.options.map((o, i) => (
          <View key={i} style={styles.row}>
            <Typography mode="caption1" color="gray500" style={{ flex: 1 }}>
              └ {o.groupName}: {o.name}
            </Typography>
            {o.price > 0 && (
              <Typography mode="caption1" color="gray500">
                +{won(o.price)}
              </Typography>
            )}
          </View>
        ))}
      </View>
    ))}

    <View style={styles.divider} />

    <View style={styles.row}>
      <Typography mode="body2" color="gray600">
        상품 금액
      </Typography>
      <Typography mode="body2" color="gray900">
        {won(order.itemsAmount)}
      </Typography>
    </View>
    {order.orderType === 'DELIVERY' && (
      <View style={styles.row}>
        <Typography mode="body2" color="gray600">
          배달비
        </Typography>
        <Typography mode="body2" color="gray900">
          {won(order.deliveryFee)}
        </Typography>
      </View>
    )}
    <View style={styles.row}>
      <Typography mode="subtitle2" color="gray900">
        결제 금액
      </Typography>
      <Typography mode="heading3" color="orange600">
        {won(order.totalAmount)}
      </Typography>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  divider: { height: 1, backgroundColor: theme.colors.line },
});

export default OrderReceipt;
export { OrderReceipt };
