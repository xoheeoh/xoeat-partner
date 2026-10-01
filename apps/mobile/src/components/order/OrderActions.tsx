import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { acceptOrder, advanceOrder, cancelOrder, rejectOrder } from '@apis/orderApi';
import { isOk } from '@apis/client';
import { useDialog } from '@contexts/DialogContext';
import { useStore } from '@contexts/StoreContext';
import { COOKING_MINUTES, REJECT_REASONS } from '@dt/constants';
import { loadingController } from '@utils/loadingController';
import type { Order } from '@typ/domain';
import { BottomSheet, PrimaryButton, Radio, SecondaryButton, Textarea, Typography } from '@components/common';
import { theme } from '@styles';

interface OrderActionsProps {
  order: Order;
  /** 상태가 바뀐 뒤 서버가 돌려준 최신 주문 */
  onChanged: (order: Order) => void;
  /** 목록 카드에서는 작은 버튼, 상세에서는 큰 버튼 */
  size?: 'md' | 'lg';
}

/**
 * 주문 상태에 따라 가능한 액션 버튼을 그리고, 수락(조리시간)·거절/취소(사유) 바텀시트를 가진다.
 * 상태 전이 규칙은 서버(advance_order 등)가 가지고, 여기서는 어떤 버튼을 보여 줄지만 정한다.
 */
const OrderActions: React.FC<OrderActionsProps> = ({ order, onChanged, size = 'md' }) => {
  const { store } = useStore();
  const { confirm } = useDialog();
  const [acceptSheet, setAcceptSheet] = useState(false);
  const [reasonSheet, setReasonSheet] = useState<null | 'reject' | 'cancel'>(null);
  const [reasonIdx, setReasonIdx] = useState('0');
  const [reasonText, setReasonText] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = (res: Awaited<ReturnType<typeof acceptOrder>>, successMsg: string) => {
    if (isOk(res) && res.order) {
      onChanged(res.order);
      Toast.show({ type: 'success', text1: successMsg });
      return true;
    }
    Toast.show({ type: 'error', text1: '처리하지 못했어요', text2: res.resultMsg });
    return false;
  };

  const call = async (fn: () => ReturnType<typeof acceptOrder>, successMsg: string) => {
    if (busy) return false;
    setBusy(true);
    loadingController.start();
    const res = await fn();
    loadingController.stop();
    setBusy(false);
    return finish(res, successMsg);
  };

  /* ── 수락 ───────────────────────────────────────── */
  const handleAccept = () => {
    if (order.orderType === 'DELIVERY') setAcceptSheet(true);
    else call(() => acceptOrder(order.id), '주문을 수락했어요. 조리를 시작해 주세요.');
  };

  const acceptWith = async (opts: { cookingMinutes?: number; selfDelivery?: boolean }) => {
    const ok = await call(
      () => acceptOrder(order.id, opts),
      opts.selfDelivery ? '주문을 수락했어요. 자체 배달로 진행합니다.' : `주문을 수락했어요. 예상 조리시간 ${opts.cookingMinutes}분`,
    );
    if (ok) setAcceptSheet(false);
  };

  /* ── 거절·취소 ──────────────────────────────────── */
  const openReason = (kind: 'reject' | 'cancel') => {
    setReasonIdx('0');
    setReasonText('');
    setReasonSheet(kind);
  };

  const isCustomReason = reasonIdx === String(REJECT_REASONS.length - 1);
  const reason = isCustomReason ? reasonText.trim() : REJECT_REASONS[Number(reasonIdx)];
  const reasonValid = reason.length > 0;

  const submitReason = async () => {
    if (!reasonSheet || !reasonValid) return;
    const kind = reasonSheet;
    const ok = await call(
      () => (kind === 'reject' ? rejectOrder(order.id, reason) : cancelOrder(order.id, reason)),
      kind === 'reject' ? '주문을 거절했어요. 고객에게 안내됩니다.' : '주문을 취소했어요. 결제가 환불됩니다.',
    );
    if (ok) setReasonSheet(null);
  };

  /* ── 다음 단계 ──────────────────────────────────── */
  const handleAdvance = async () => {
    const next = nextStepOf(order);
    if (!next) return;
    if (next.confirmTitle) {
      const yes = await confirm({ title: next.confirmTitle, message1: next.confirmMsg ?? '', confirmText: next.label, cancelText: '취소' });
      if (!yes) return;
    }
    call(() => advanceOrder(order.id), next.doneMsg);
  };

  const next = nextStepOf(order);
  const btnSize = size;

  return (
    <>
      <View style={styles.row}>
        {order.status === 'PENDING' && (
          <>
            <SecondaryButton label="거절" size={btnSize} onPress={() => openReason('reject')} style={styles.flex1} />
            <PrimaryButton label="주문 수락" size={btnSize} onPress={handleAccept} style={styles.flex2} />
          </>
        )}
        {(order.status === 'ACCEPTED' || order.status === 'READY') && (
          <SecondaryButton label="주문 취소" size={btnSize} onPress={() => openReason('cancel')} style={styles.flex1} />
        )}
        {next && <PrimaryButton label={next.label} size={btnSize} onPress={handleAdvance} style={styles.flex2} buttonColor={next.color} />}
      </View>

      {/* 배달 주문 수락: 예상 조리시간 */}
      <BottomSheet
        visible={acceptSheet}
        setVisible={setAcceptSheet}
        title="예상 조리시간을 선택해 주세요"
        content={
          <View style={{ gap: 10 }}>
            <Typography mode="body2" color="gray600" style={{ marginBottom: 6 }}>
              선택한 시간에 맞춰 배달 기사가 호출되고, 고객에게 도착 예정 시간이 안내됩니다.
            </Typography>
            {store?.selfDelivery && (
              <Pressable style={[styles.choice, styles.choiceSelf]} onPress={() => acceptWith({ selfDelivery: true })} disabled={busy}>
                <Typography mode="subtitle2" color="orange700">
                  자체 배달
                </Typography>
                <Typography mode="caption1" color="gray600">
                  배달 호출 없이 직접 배달
                </Typography>
              </Pressable>
            )}
            {COOKING_MINUTES.map((c) => (
              <Pressable key={c.minutes} style={styles.choice} onPress={() => acceptWith({ cookingMinutes: c.minutes })} disabled={busy}>
                <Typography mode="subtitle2" color="gray900">
                  {c.label}
                </Typography>
                <Typography mode="caption1" color="gray500">
                  {c.desc}
                </Typography>
              </Pressable>
            ))}
          </View>
        }
      />

      {/* 거절·취소 사유 */}
      <BottomSheet
        visible={reasonSheet !== null}
        setVisible={(v) => !v && setReasonSheet(null)}
        title={reasonSheet === 'cancel' ? '취소 사유를 선택해 주세요' : '거절 사유를 선택해 주세요'}
        content={
          <View style={{ gap: 12 }}>
            <Typography mode="body2" color="gray600">
              <Typography mode="subtitle3" color="orange700">
                {order.orderNo}
              </Typography>{' '}
              주문을 {reasonSheet === 'cancel' ? '취소' : '거절'}하면 고객에게 사유가 함께 안내되고 결제가 환불됩니다.
            </Typography>
            <Radio
              selectedId={reasonIdx}
              setSelectedId={setReasonIdx}
              radioButtons={REJECT_REASONS.map((r, i) => ({ id: String(i), label: r, value: r }))}
            />
            {isCustomReason && <Textarea value={reasonText} setValue={setReasonText} height={88} />}
            <PrimaryButton
              label={reasonSheet === 'cancel' ? '주문 취소' : '주문 거절'}
              onPress={submitReason}
              disabled={!reasonValid || busy}
              buttonColor={theme.colors.red500}
              style={{ marginTop: 4 }}
            />
          </View>
        }
      />
    </>
  );
};

/** 다음 단계 버튼 정의. 서버 advance_order 와 같은 규칙 */
const nextStepOf = (o: Order): { label: string; doneMsg: string; color?: string; confirmTitle?: string; confirmMsg?: string } | null => {
  if (o.status === 'ACCEPTED' && o.orderType === 'PICKUP') {
    return {
      label: '포장 준비 완료',
      doneMsg: '고객에게 포장이 준비되었다고 알렸어요.',
      confirmTitle: '포장 준비 완료',
      confirmMsg: '완료를 누르면 고객에게 픽업 안내가 전송됩니다.',
    };
  }
  if (o.status === 'ACCEPTED' && o.orderType === 'DELIVERY') {
    return o.selfDelivery
      ? { label: '자체 배달 시작', doneMsg: '배달을 시작했어요.', color: theme.colors.purple600, confirmTitle: '자체 배달을 시작할까요?' }
      : { label: '배달 기사에게 전달', doneMsg: '배달이 시작되었어요.', color: theme.colors.purple600, confirmTitle: '조리가 끝났나요?', confirmMsg: '배달 기사에게 음식을 전달한 뒤 눌러 주세요.' };
  }
  if (o.status === 'READY') return { label: '고객 픽업 완료', doneMsg: '주문이 완료되었어요.', color: theme.colors.green600 };
  if (o.status === 'DELIVERING') return { label: '배달 완료', doneMsg: '주문이 완료되었어요.', color: theme.colors.green600, confirmTitle: '배달을 완료 처리할까요?' };
  return null;
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  choice: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.white,
    gap: 2,
  },
  choiceSelf: { borderColor: theme.colors.orange200, backgroundColor: theme.colors.orange50 },
});

export default OrderActions;
export { OrderActions };
