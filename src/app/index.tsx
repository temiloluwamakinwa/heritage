import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useApp } from '../lib/session';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, loading } = useApp();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Redirect href={session ? '/(tabs)' : '/sign-in'} />;
}
