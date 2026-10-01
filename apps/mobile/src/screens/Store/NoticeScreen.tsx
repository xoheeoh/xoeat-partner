import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { Notice } from '@typ/domain';
import { getNotices } from '@apis/storeApi';
import { isOk } from '@apis/client';
import { NOTICE_KIND } from '@dt/constants';
import { dateDot } from '@utils/formatter';
import { Badge, ScreenWrapper, SkeletonList, Typography } from '@components/common';
import { theme } from '@styles';

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
          renderItem={({ item }) => {
            const open = openId === item.id;
            const kind = NOTICE_KIND[item.kind] ?? NOTICE_KIND.NEWS;
            return (
              <Pressable onPress={() => setOpenId(open ? null : item.id)} style={styles.item}>
                <View style={styles.head}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Badge label={kind.label} tone={kind.tone} />
                      <Typography mode="caption1" color="gray500">
                        {dateDot(item.createdAt)}
                      </Typography>
                    </View>
                    <Typography mode="subtitle2" color="gray900">
                      {item.title}
                    </Typography>
                  </View>
                  <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.gray400} />
                </View>
                {open && (
                  <Typography mode="body2" color="gray700" style={styles.body}>
                    {item.body}
                  </Typography>
                )}
              </Pressable>
            );
          }}
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
  body: { marginTop: 12, backgroundColor: theme.colors.gray50, borderRadius: theme.radius.sm, padding: 12 },
  sep: { height: 1, backgroundColor: theme.colors.gray100 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
});

export default NoticeScreen;
