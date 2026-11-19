import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Field } from '../components/ui';
import { errorMessage, notify } from '../lib/notify';
import { useApp } from '../lib/session';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { colors, space } from '../lib/theme';

export default function SignIn() {
  const { session } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  async function submit() {
    if (!email.trim() || password.length < 6) {
      notify('Check your details', 'Enter an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          notify('Check your email', 'We sent you a link to confirm your address. Open it, then sign in here.');
          setMode('in');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      notify('Could not continue', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 80, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Text style={{ fontSize: 40, fontWeight: '900', color: colors.primary }}>Heritage</Text>
        <Text style={{ fontSize: 18, color: colors.ink, marginTop: 8, marginBottom: space.xl, lineHeight: 26 }}>
          Record the stories, names and proverbs of the people you love, in their own language, and turn them into a family book.
        </Text>

        {!isSupabaseConfigured && (
          <View style={{ backgroundColor: '#FFF3CD', padding: space.md, borderRadius: 12, marginBottom: space.md }}>
            <Text style={{ color: '#664D03' }}>
              This build has no backend configured yet. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
            </Text>
          </View>
        )}

        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        <Button title={mode === 'up' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
        <Button
          variant="ghost"
          style={{ marginTop: space.sm }}
          title={mode === 'up' ? 'I already have an account' : 'Create a new account'}
          onPress={() => setMode(mode === 'up' ? 'in' : 'up')}
        />
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: space.lg, lineHeight: 18 }}>
          Beta version. Recordings and transcripts are private to your family circle. Transcripts are machine drafts and may contain
          mistakes, so please check them while you listen.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
