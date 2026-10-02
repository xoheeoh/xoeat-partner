import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { RootStackParamList } from '@typ/navigation';
import type { AppNotification } from '@typ/domain';
import { getNotifications } from '@apis/notificationApi';
import { isOk } from '@apis/client';
import { useNotifications } from '@contexts/NotificationContext';
import { ago } from '@utils/formatter';
import { ScreenWrapper, SkeletonList, TextButton, Typography } from '@components/common';
import { theme } from '@styles';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** 종류별 아이콘과 색. 주문은 브랜드 주황, 취소는 빨강, 공지는 파랑 */
const KIND_STYLE: Record<AppNotification['kind'], { icon: IconName; fg: string; bg: string }> = {
  NEW_ORDER: { icon: 'bell-ring-outline', fg: theme.colors.orange600, bg: theme.colors.orange50 },
  ORDER_CANCELED: { icon: 'cancel', fg: theme.colors.red600, bg: theme.colors.red50 },
  NOTICE: { icon: 'bullhorn-outline', fg: theme.colors.blue700, bg: theme.colors.blue50 },
};

/** 알림함: 내 가게에 일어난 일(새 주문·고객 취소·새 공지). 누르면 읽음 처리 후 해당 화면으로 간다 */
const NotificationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { unreadCount, lastArrived, markRead } = useNotifications();
  const [list, setList] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await getNotifications();
    if (isOk(res) && res.notifications) setList(res.notifications);
    else setList([]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 화면을 보고 있는 동안 새 알림이 오면 목록도 갱신
  useEffect(() => {
    if (lastArrived) load();
  }, [lastArrived, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = async (n: AppNotification) => {
    if (!n.readAt) {
      // 서버 응답을 기다리지 않고 먼저 읽음으로 표시해 반응이 빠르게 느껴지도록 한다
      setList((prev) => prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? prev);
      markRead([n.id]);
    }
    if (n.orderId) navigation.navigate('OrderDetail', { orderId: n.orderId });
    else if (n.noticeId !== null) navigation.navigate('Notice');
  };

  const readAll = async () => {
    setList((prev) => prev?.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })) ?? prev);
    await markRead();
  };

  return (
    <ScreenWrapper backgroundColor="white">
      {list === null ? (
        <View style={{ padding: 16 }}>
          <SkeletonList rows={5} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          ListHeaderComponent={
            list.length > 0 ? (
              <View style={styles.toolbar}>
                <Typography mode="caption1" color="gray500">
                  {unreadCount > 0 ? `안 읽음 ${unreadCount}개` : '모두 읽었어요'}
                </Typography>
                {unreadCount > 0 && <TextButton label="모두 읽음" size="sm" onPress={readAll} />}
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const k = KIND_STYLE[item.kind];
            const unread = !item.readAt;
            return (
              <Pressable
                onPress={() => open(item)}
                style={({ pressed }) => [styles.item, unread && styles.itemUnread, pressed && styles.itemPressed]}>
                <View style={[styles.icon, { backgroundColor: k.bg }]}>
                  <MaterialCommunityIcons name={k.icon} size={20} color={k.fg} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.titleRow}>
                    <Typography
                      mode={unread ? 'subtitle3' : 'body2'}
                      color="gray900"
                      numberOfLines={1}
                      style={{ flex: 1 }}>
                      {item.title}
                    </Typography>
                    <Typography mode="caption2" color="gray400">
                      {ago(item.createdAt)}
                    </Typography>
                  </View>
                  {!!item.body && (
                    <Typography mode="caption1" color="gray500" numberOfLines={2}>
                      {item.body}
                    </Typography>
                  )}
                </View>
                {unread && <View style={styles.dot} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="bell-sleep-outline" size={40} color={theme.colors.gray300} />
              <Typography mode="body1" color="gray500">
                아직 알림이 없어요
              </Typography>
              <Typography mode="caption1" color="gray400">
                새 주문, 고객 취소, 새 공지가 여기에 쌓여요
              </Typography>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 6,
    backgroundColor: theme.colors.gray50,
  },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  itemUnread: { backgroundColor: theme.colors.orange50 },
  itemPressed: { opacity: 0.7 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6 },
  sep: { height: 1, backgroundColor: theme.colors.gray100 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 80 },
});

export default NotificationsScreen;
