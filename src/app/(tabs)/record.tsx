import * as DocumentPicker from 'expo-document-picker';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, Field, Heading } from '../../components/ui';
import { errorMessage, notify } from '../../lib/notify';
import { PROMPTS } from '../../lib/prompts';
import { enqueueRecording, flushQueue } from '../../lib/queue';
import { useApp } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { colors, space } from '../../lib/theme';
import { LANGUAGES, type LanguageCode } from '../../lib/types';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Record() {
  const { session, family } = useApp();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [language, setLanguage] = useState<LanguageCode>('yo');
  const [promptId, setPromptId] = useState(PROMPTS[0].id);
  const [teller, setTeller] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState<'upload' | 'text' | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(t);
  }, [recording]);

  const prompt = PROMPTS.find((p) => p.id === promptId) ?? PROMPTS[0];

  async function start() {
    if (!family) {
      notify('Set up your family first', 'Open the Family tab to create or join a family circle.');
      return;
    }
    if (!teller.trim()) {
      notify('Who is telling the story?', "Please enter the storyteller's name.");
      return;
    }
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        notify('Microphone needed', 'Allow microphone access in your settings to record stories.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
    } catch (e) {
      notify('Could not start recording', errorMessage(e));
    }
  }

  function ready(): boolean {
    if (!family || !session) {
      notify('Set up your family first', 'Open the Family tab to create or join a family circle.');
      return false;
    }
    if (!teller.trim()) {
      notify('Who is telling the story?', "Please enter the storyteller's name.");
      return false;
    }
    return true;
  }

  /** For a recording that was made earlier, e.g. a voice note or a file from another app. */
  async function uploadFile() {
    if (!ready()) return;
    setBusy('upload');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      await enqueueRecording({
        sourceUri: asset.uri,
        familyId: family!.id,
        authorId: session!.user.id,
        language,
        prompt: prompt.text,
        chapter: prompt.chapter,
        storytellerName: teller.trim(),
        durationMs: 0,
        mime: asset.mimeType ?? 'audio/mp4',
      });
      flushQueue().catch(() => undefined);
      notify('Saved', 'Your audio file is saved. It will upload and be turned into text shortly.');
      router.push('/(tabs)');
    } catch (e) {
      notify('Could not add the audio file', errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  /** For a story that is already written down, or a transcript typed while listening. */
  async function saveText() {
    if (!ready()) return;
    if (!pasted.trim()) {
      notify('Nothing to save', 'Type or paste the story first.');
      return;
    }
    setBusy('text');
    try {
      const { data, error } = await supabase
        .from('stories')
        .insert({
          family_id: family!.id,
          author_id: session!.user.id,
          storyteller_name: teller.trim(),
          language,
          prompt: prompt.text,
          chapter: prompt.chapter,
          duration_ms: 0,
          audio_path: null,
          transcript_text: pasted.trim(),
          transcript_source: 'human',
          status: 'transcribed',
        })
        .select('id')
        .single();
      if (error) throw error;
      setPasted('');
      router.push({ pathname: '/story/[id]', params: { id: data.id } });
    } catch (e) {
      notify('Could not save the story', errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    setRecording(false);
    setSaving(true);
    try {
      const durationMs = Date.now() - startedAt.current;
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || !session || !family) throw new Error('No recording was captured.');
      await enqueueRecording({
        sourceUri: uri,
        familyId: family.id,
        authorId: session.user.id,
        language,
        prompt: prompt.text,
        chapter: prompt.chapter,
        storytellerName: teller.trim(),
        durationMs,
        mime: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
      });
      // Try straight away; if offline it stays queued and retries later.
      flushQueue().catch(() => undefined);
      notify('Saved', 'Your recording is saved. It will upload and be turned into text shortly.');
      router.push('/(tabs)');
    } catch (e) {
      notify('Could not save recording', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <Heading sub="Pick a language and a question, then tap the big button and let them talk.">Record a story</Heading>

      <Text style={{ fontWeight: '700', color: colors.muted, marginBottom: 6 }}>Language spoken</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
        {LANGUAGES.map((l) => (
          <Chip key={l.code} label={`${l.label}`} selected={language === l.code} onPress={() => setLanguage(l.code)} />
        ))}
      </View>

      <Field label="Storyteller's name" value={teller} onChangeText={setTeller} placeholder="e.g. Grandma Folake" />

      <Text style={{ fontWeight: '700', color: colors.muted, marginBottom: 6 }}>Question to ask</Text>
      {PROMPTS.map((p) => (
        <Chip key={p.id} label={p.text.length > 52 ? `${p.text.slice(0, 50)}…` : p.text} selected={promptId === p.id} onPress={() => setPromptId(p.id)} />
      ))}

      <Card style={{ marginTop: space.md, alignItems: 'center' }}>
        <Text style={{ fontSize: 17, color: colors.ink, textAlign: 'center', lineHeight: 25, marginBottom: space.md }}>{prompt.text}</Text>
        <Text style={{ fontSize: 34, fontWeight: '800', color: recording ? colors.danger : colors.ink, marginBottom: space.md }}>
          {fmt(elapsed)}
        </Text>
        {recording ? (
          <Button title="Stop and save" variant="danger" onPress={stop} style={{ alignSelf: 'stretch' }} />
        ) : (
          <Button title="Start recording" onPress={start} loading={saving} style={{ alignSelf: 'stretch' }} />
        )}
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: space.md, textAlign: 'center' }}>
          Works offline. If there is no signal, the recording waits on your phone and uploads later.
        </Text>
      </Card>

      <Card style={{ marginTop: space.md }}>
        <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 4 }}>Already have a recording?</Text>
        <Text style={{ color: colors.muted, marginBottom: space.sm }}>
          Add a voice note or audio file from your phone or computer. It is turned into text the same way.
        </Text>
        <Button title="Choose an audio file" variant="secondary" onPress={uploadFile} loading={busy === 'upload'} />
      </Card>

      <Card style={{ marginTop: space.md }}>
        <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 4 }}>Type or paste the story</Text>
        <Text style={{ color: colors.muted, marginBottom: space.sm }}>
          Write as they speak, or paste a story you already have. Use the same language and storyteller above.
        </Text>
        <TextInput
          multiline
          value={pasted}
          onChangeText={setPasted}
          placeholder="Type or paste the story text here."
          placeholderTextColor={colors.muted}
          style={{ minHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink, textAlignVertical: 'top', marginBottom: space.sm, backgroundColor: colors.card }}
        />
        <Button title="Save this story" variant="secondary" onPress={saveText} loading={busy === 'text'} />
      </Card>
    </ScrollView>
  );
}
