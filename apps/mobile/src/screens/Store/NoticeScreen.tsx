import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { Notice } from '@typ/domain';
import { getNotices } from '@apis/storeApi';
import { isOk } from '@apis/client';
import { NOTICE_KIND } from '@dt/constants';
import { dateDot } from '@utils/formatter';
import { Badge, ScreenWrapper, SkeletonList, Typography } from '@components/common';
import { theme } from '@styles';

const OPEN_MS = 220;

/**
 * 공지 한 줄. 제목은 그대로 두고 본문 영역의 높이만 0 ↔ 실제 높이로 열고 닫는다(슬라이드 토글).
 * 본문은 항상 그려 두고 바깥 상자의 높이로 가린다. 안쪽 onLayout 으로 실제 높이를 재서 목표값으로 쓴다.
 */
const NoticeItem: React.FC<{ notice: Notice; open: boolean; onToggle: () => void }> = ({ notice, open, onToggle }) => {
  const kind = NOTICE_KIND[notice.kind] ?? NOTICE_KIND.NEWS;
  const [bodyHeight, setBodyHeight] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(open ? bodyHeight : 0, { duration: OPEN_MS });
    opacity.value = withTiming(open ? 1 : 0, { duration: OPEN_MS });
  }, [open, bodyHeight, height, opacity]);

  const bodyBoxStyle = useAnimatedStyle(() => ({ height: height.value, opacity: opacity.value }));

  return (
    <Pressable onPress={onToggle} style={styles.item}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge label={kind.label} tone={kind.tone} />
            <Typography mode="caption1" color="gray500">
              {dateDot(notice.createdAt)}
            </Typography>
          </View>
          <Typography mode="subtitle2" color="gray900">
            {notice.title}
          </Typography>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.gray400} />
      </View>
      <Animated.View style={[styles.bodyBox, bodyBoxStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <View style={styles.bodyInner} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
          <View style={styles.body}>
            <Typography mode="body2" color="gray700">
              {notice.body}
            </Typography>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

/** 플랫폼 공지. 누르면 본문이 펼쳐진다 */
const NoticeScreen = () => {
  const [list, setList] = useState<Notice[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    getNotices().then((res) => setList(isOk(res) && res.notices ? res.notices : []));
  }, []);

  return (
    <ScreenWrapper backgroundColor="white">
      {list === null ? (
        <View style={{ padding: 16 }}>
          <SkeletonList rows={4} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => <NoticeItem notice={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Typography mode="body1" color="gray500">
                등록된 공지가 없어요
              </Typography>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  item: { paddingHorizontal: 20, paddingVertical: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bodyBox: { overflow: 'hidden' },
  // 본문 위 여백(12)은 안쪽에 둔다. 바깥 상자 높이가 0 일 때 여백까지 함께 사라져야 닫힌 상태가 원래 높이와 같다
  bodyInner: { paddingTop: 12 },
  body: { backgroundColor: theme.colors.gray50, borderRadius: theme.radius.sm, padding: 12 },
  sep: { height: 1, backgroundColor: theme.colors.gray100 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
});

export default NoticeScreen;
