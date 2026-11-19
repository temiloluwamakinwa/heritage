import { Redirect, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Text, type ColorValue } from 'react-native';

import { flushQueue } from '../../lib/queue';
import { useApp } from '../../lib/session';
import { colors } from '../../lib/theme';

function icon(glyph: string) {
  return ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { session, loading } = useApp();

  useEffect(() => {
    if (!session) return;
    flushQueue().catch(() => undefined);
    const t = setInterval(() => flushQueue().catch(() => undefined), 30000);
    return () => clearInterval(t);
  }, [session]);

  if (!loading && !session) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.ink },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Stories', tabBarIcon: icon('📖') }} />
      <Tabs.Screen name="record" options={{ title: 'Record', tabBarIcon: icon('🎙') }} />
      <Tabs.Screen name="book" options={{ title: 'Book', tabBarIcon: icon('📕') }} />
      <Tabs.Screen name="family" options={{ title: 'Family', tabBarIcon: icon('👪') }} />
    </Tabs>
  );
}
