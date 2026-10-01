import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { PopupModal } from '@components/common';

type ShowArgs = {
  title?: string;
  message1: string;
  message2?: string;
  confirmText?: string; // 기본: '확인'
  cancelText?: string; // 없으면 단일 버튼(alert 스타일)
  onConfirm?: () => void; // 기본: 닫기
  onCancel?: () => void; // 기본: 닫기
};

type DialogContextType = {
  /** 단일 버튼 알림. 어떤 방식으로 닫혀도 resolve 됨 */
  alert: (args: { title?: string; message1: string; message2?: string; confirmText?: string }) => Promise<void>;

  /** 확인/취소 분기. 확인=true, 취소=false 로 resolve */
  confirm: (args: {
    title?: string;
    message1: string;
    message2?: string;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<boolean>;

  /** 완전 수동 제어(show 후 onConfirm/onCancel에서 원하는 동작) */
  show: (args: ShowArgs) => void;

  /** 강제 닫기 */
  close: () => void;
};

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog는 반드시 <DialogProvider> 안에서 사용되어야 합니다.');
  }
  return ctx;
}

type DialogState = {
  open: boolean;
  title?: string;
  message1: string;
  message2?: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>({
    open: false,
    title: '',
    message1: '',
    confirmText: '확인',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  /** 공용 오픈 헬퍼: 핸들러가 없으면 기본적으로 닫기만 수행 */
  const openDialog = useCallback(
    (args: ShowArgs) => {
      setState({
        open: true,
        title: args.title ?? '',
        message1: args.message1,
        message2: args.message2,
        confirmText: args.confirmText ?? '확인',
        cancelText: args.cancelText,
        onConfirm: args.onConfirm ?? close,
        onCancel: args.onCancel ?? close,
      });
    },
    [close],
  );

  /** 어떤 경로(X/뒤로가기/확인)로 닫혀도 resolve */
  const alert = useCallback(
    (args: { title?: string; message1: string; message2?: string; confirmText?: string }) => {
      return new Promise<void>((resolve) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          resolve();
          close();
        };
        openDialog({
          title: args.title,
          message1: args.message1,
          message2: args.message2,
          confirmText: args.confirmText ?? '확인',
          cancelText: undefined,
          onConfirm: settle,
          onCancel: settle,
        });
      });
    },
    [openDialog, close],
  );

  /** 확인/취소를 true/false로 명확히 분기 (cancelText 없으면 단일 버튼) */
  const confirm = useCallback(
    (args: { title?: string; message1: string; message2?: string; confirmText?: string; cancelText?: string }) => {
      return new Promise<boolean>((resolve) => {
        const onConfirm = () => {
          resolve(true);
          close();
        };
        const onCancel = () => {
          resolve(false);
          close();
        };
        openDialog({
          title: args.title,
          message1: args.message1,
          message2: args.message2,
          confirmText: args.confirmText ?? '확인',
          cancelText: args.cancelText,
          onConfirm,
          onCancel,
        });
      });
    },
    [openDialog, close],
  );

  /** 완전 수동 show (콜백 직접 제어) */
  const show = useCallback(
    (args: ShowArgs) => {
      openDialog(args);
    },
    [openDialog],
  );

  const value = useMemo<DialogContextType>(() => ({ alert, confirm, show, close }), [alert, confirm, show, close]);

  return (
    <DialogContext.Provider value={value}>
      {children}

      {/* Host: 전역 하나만 렌더 */}
      <PopupModal
        visible={state.open}
        close={state.onCancel}
        title={state.title}
        message1={state.message1}
        message2={state.message2}
        button1Label={state.confirmText}
        button1Event={state.onConfirm}
        button2Label={state.cancelText}
        button2Event={state.cancelText ? state.onCancel : undefined}
      />
    </DialogContext.Provider>
  );
}
