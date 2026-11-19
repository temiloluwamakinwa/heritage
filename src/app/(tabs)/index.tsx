import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Pressable } from 'react-native';

import { Button, Card } from '../../components/ui';
import { listStories } from '../../lib/api';
import { flushQueue, listPending } from '../../lib/queue';
import { useApp } from '../../lib/session';
import { colors, space } from '../../lib/theme';
import { LANGUAGES, type PendingRecording, type Story } from '../../lib/types';

function statusLabel(s: Story): string {
  if (s.transcript_source === 'human') return 'Checked by family';
  if (s.transcript_text) return 'Draft text · please check';
  if (s.status === 'error') return 'Transcription failed · open to retry';
  return 'Transcribing…';
}

export default function Stories() {
  const { family } = useApp();
  const [stories, setStories] = useState<Story[]>([]);
  const [pending, setPending] = useState<PendingRecording[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setPending(await listPending());
    if (family) {
      try {
        setStories(await listStories(family.id));
      } catch {
        // Offline: keep showing what we have.
      }
    }
  }, [family]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await flushQueue().catch(() => undefined);
    await load();
    setRefreshing(false);
  }

  if (!family) {
    return (
      <View style={{ flex: 1, padding: space.lg, justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 8 }}>Start your family circle</Text>
        <Text style={{ color: colors.muted, marginBottom: space.md, lineHeight: 22 }}>
          Create a family circle, or join one with an invite code, so stories are kept together.
        </Text>
        <Button title="Set up family" onPress={() => router.push('/(tabs)/family')} />
      </View>
    );
  }

  return (
    <FlatList
      data={stories}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: space.md, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          {pending.length > 0 && (
            <Card style={{ backgroundColor: '#FFF3CD', borderColor: '#F1D58A' }}>
              <Text style={{ color: '#664D03', fontWeight: '700' }}>
                {pending.length} recording{pending.length > 1 ? 's' : ''} waiting to upload
              </Text>
              <Text style={{ color: '#664D03', marginTop: 4 }}>They are saved on this device and will upload when you are online. Pull down to retry.</Text>
            </Card>
          )}
          {stories.length === 0 && (
            <Card>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>No stories yet</Text>
              <Text style={{ color: colors.muted, marginVertical: 8, lineHeight: 21 }}>
                Begin with a name story: "How did you get your name, and what does it mean?"
              </Text>
              <Button title="Record the first story" onPress={() => router.push('/(tabs)/record')} />
            </Card>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id } })}>
          <Card>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{item.title || item.prompt || 'Untitled story'}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {item.storyteller_name} · {LANGUAGES.find((l) => l.code === item.language)?.label} · {Math.round(item.duration_ms / 1000)}s
            </Text>
            <Text style={{ color: colors.green, marginTop: 6, fontSize: 13, fontWeight: '600' }}>{statusLabel(item)}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
