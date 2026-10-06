import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { RootStackParamList } from '@typ/navigation';
import type { Order } from '@typ/domain';
import { getOrder } from '@apis/orderApi';
import { isOk } from '@apis/client';
import { ORDER_STATUS, ORDER_TYPE } from '@dt/constants';
import { dateTime, phone, won } from '@utils/formatter';
import { OrderActions, OrderReceipt } from '@components/order';
import { Badge, ScreenWrapper, SkeletonList, Typography } from '@components/common';
import { theme } from '@styles';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Typography mode="subtitle3" color="gray500" style={{ marginBottom: 12 }}>
      {title}
    </Typography>
    {children}
  </View>
);

const InfoRow: React.FC<{ label: string; value: string; onPress?: () => void }> = ({ label, value, onPress }) => (
  <View style={styles.infoRow}>
    <Typography mode="body2" color="gray500" style={{ width: 84 }}>
      {label}
    </Typography>
    {onPress ? (
      <Pressable onPress={onPress} style={styles.link}>
        <Typography mode="body2" color="blue600">
          {value}
        </Typography>
        <MaterialCommunityIcons name="phone-outline" size={16} color={theme.colors.blue600} />
      </Pressable>
    ) : (
      <Typography mode="body2" color="gray900" style={{ flex: 1 }}>
        {value}
      </Typography>
    )}
  </View>
);

/** 주문 1건의 전체 정보 (영수증 + 고객·배달 정보 + 처리 이력) 와 상태별 액션 */
const OrderDetailScreen: React.FC<Props> = ({ route }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);

  useFocusEffect(
    useCallback(() => {
      getOrder(orderId).then((res) => {
        if (isOk(res) && res.order) setOrder(res.order);
      });
    }, [orderId]),
  );

  if (!order) {
    return (
      <ScreenWrapper backgroundColor={theme.colors.bg}>
        <View style={{ padding: 20 }}>
          <SkeletonList rows={4} />
        </View>
      </ScreenWrapper>
    );
  }

  const st = ORDER_STATUS[order.status];
  const ty = ORDER_TYPE[order.orderType];
  const timeline: { label: string; at: string | null }[] = [
    { label: '주문 접수', at: order.createdAt },
    { label: '수락', at: order.acceptedAt },
    ...(order.orderType === 'PICKUP'
      ? [{ label: '포장 준비 완료', at: order.readyAt }]
      : [{ label: '배달 시작', at: order.deliveringAt }]),
    { label: '완료', at: order.completedAt },
    { label: order.status === 'REJECTED' ? '거절' : '취소', at: order.canceledAt },
  ].filter((t) => t.at);

  return (
    <ScreenWrapper backgroundColor={theme.colors.bg}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 상단 요약 */}
        <View style={styles.section}>
          <View style={styles.badges}>
            <Badge label={ty.label} tone={ty.tone} size="medium" />
            <Badge label={st.label} tone={st.tone} size="medium" />
            {!!order.cookingMinutes && <Badge label={`조리 ${order.cookingMinutes}분`} tone="blue" size="medium" />}
          </View>
          <Typography mode="heading3" color="gray900" style={{ marginTop: 12 }}>
            {order.orderNo}
          </Typography>
          <Typography mode="body2" color="gray500">
            {dateTime(order.createdAt)} 접수
          </Typography>
          {(order.status === 'REJECTED' || order.status === 'CANCELED') && !!order.rejectReason && (
            <View style={styles.reasonBox}>
              <Typography mode="body2" color="red600">
                {st.label} 사유: {order.rejectReason}
              </Typography>
            </View>
          )}
        </View>

        <Section title="주문 내역">
          <OrderReceipt order={order} />
        </Section>

        <Section title={order.orderType === 'DELIVERY' ? '배달 정보' : '픽업 정보'}>
          <View style={{ gap: 10 }}>
            <InfoRow label="주문자" value={order.customerName} />
            <InfoRow
              label="연락처"
              value={phone(order.customerPhone)}
              onPress={() => Linking.openURL(`tel:${order.customerPhone.replace(/-/g, '')}`)}
            />
            {order.orderType === 'DELIVERY' && (
              <InfoRow label="배달 주소" value={`${order.address ?? ''} ${order.addressDetail ?? ''}`.trim()} />
            )}
            <InfoRow label="요청사항" value={order.requestMemo || '없음'} />
            <InfoRow
              label="결제"
              value={`${order.paymentMethod === 'CARD' ? '카드 결제' : order.paymentMethod} · ${won(order.totalAmount)}`}
            />
          </View>
        </Section>

        <Section title="처리 이력">
          <View style={{ gap: 8 }}>
            {timeline.map((t, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={[styles.dot, i === timeline.length - 1 && styles.dotActive]} />
                <Typography mode="body2" color={i === timeline.length - 1 ? 'gray900' : 'gray500'} style={{ flex: 1 }}>
                  {t.label}
                </Typography>
                <Typography mode="caption1" color="gray500">
                  {dateTime(t.at)}
                </Typography>
              </View>
            ))}
          </View>
        </Section>
      </ScrollView>

      {(order.status === 'PENDING' ||
        order.status === 'ACCEPTED' ||
        order.status === 'READY' ||
        order.status === 'DELIVERING') && (
        <View style={styles.bottom}>
          <OrderActions order={order} onChanged={setOrder} size="lg" />
        </View>
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 24 },
  section: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    padding: 16,
    boxShadow: theme.shadow.card,
  },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reasonBox: { marginTop: 12, backgroundColor: theme.colors.red50, borderRadius: theme.radius.sm, padding: 10 },
  infoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.gray200 },
  dotActive: { backgroundColor: theme.colors.primary },
  bottom: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
});

export default OrderDetailScreen;
