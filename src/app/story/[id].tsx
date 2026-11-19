import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, Field, Heading, styles as ui } from '../../components/ui';
import {
  getStory,
  runTranscribe,
  runTranslate,
  saveTranscriptCorrection,
  setChapter,
  signedAudioUrl,
  updateStory,
} from '../../lib/api';
import { errorMessage, notify } from '../../lib/notify';
import { colors, space } from '../../lib/theme';
import { CHAPTERS, LANGUAGES, type Story } from '../../lib/types';

// Tone marks and special letters that phone keyboards make hard to type.
const MARKS: Record<string, string[]> = {
  yo: ['à', 'á', 'è', 'é', 'ẹ', 'ẹ̀', 'ẹ́', 'ì', 'í', 'ò', 'ó', 'ọ', 'ọ̀', 'ọ́', 'ù', 'ú', 'ṣ', 'ń', 'ǹ'],
  ig: ['ị', 'ọ', 'ụ', 'ṅ', 'à', 'á', 'è', 'é', 'ì', 'í', 'ò', 'ó', 'ù', 'ú'],
  ha: ['ɓ', 'ɗ', 'ƙ', "ʼ", 'ƴ'],
  pcm: [],
  en: [],
};

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [busy, setBusy] = useState<'save' | 'transcribe' | 'translate' | null>(null);
  const [audioError, setAudioError] = useState(false);

  const player = useAudioPlayer(undefined);
  const status = useAudioPlayerStatus(player);

  const load = useCallback(async () => {
    const s = await getStory(id);
    setStory(s);
    setText(s.transcript_text ?? '');
    setTranslation(s.translation_text ?? '');
    return s;
  }, [id]);

  useEffect(() => {
    load()
      .then(async (s) => {
        if (s.audio_path) {
          try {
            player.replace(await signedAudioUrl(s.audio_path));
          } catch {
            setAudioError(true);
          }
        }
      })
      .catch((e) => notify('Could not open story', errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!story) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const marks = MARKS[story.language] ?? [];

  function insert(ch: string) {
    const { start, end } = selection;
    setText(text.slice(0, start) + ch + text.slice(end));
    const pos = start + ch.length;
    setSelection({ start: pos, end: pos });
  }

  async function save() {
    setBusy('save');
    try {
      await saveTranscriptCorrection(story!.id, text);
      await updateStory(story!.id, { translation_text: translation || null });
      await load();
      notify('Saved', 'Thank you for checking this story.');
    } catch (e) {
      notify('Could not save', errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function transcribe() {
    setBusy('transcribe');
    try {
      await runTranscribe(story!.id);
      await load();
    } catch (e) {
      notify('Transcription is not available yet', errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function translate() {
    if (!text.trim()) return notify('Add the text first', 'Transcribe or type the story before translating.');
    setBusy('translate');
    try {
      await saveTranscriptCorrection(story!.id, text);
      await runTranslate(story!.id);
      await load();
    } catch (e) {
      notify('Translation failed', errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const lang = LANGUAGES.find((l) => l.code === story.language);

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, maxWidth: 720, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Heading sub={`${story.storyteller_name} · ${lang?.label}`}>{story.title || story.prompt || 'Story'}</Heading>

      <Card>
        <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Listen</Text>
        {audioError ? (
          <Text style={{ color: colors.danger }}>The audio is not available right now.</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Button
              title={status.playing ? 'Pause' : 'Play'}
              variant="secondary"
              disabled={!status.isLoaded}
              onPress={() => (status.playing ? player.pause() : player.play())}
              style={{ width: 100 }}
            />
            <Text style={{ marginLeft: space.md, color: colors.muted }}>
              {Math.floor(status.currentTime)}s / {Math.floor(status.duration || story.duration_ms / 1000)}s
            </Text>
            {!status.isLoaded && <ActivityIndicator style={{ marginLeft: 8 }} color={colors.primary} />}
          </View>
        )}
      </Card>

      <Text style={ui.label}>Chapter</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
        {CHAPTERS.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={story.chapter === c}
            onPress={() => {
              setStory({ ...story, chapter: c });
              setChapter(story.id, c).catch(() => undefined);
            }}
          />
        ))}
      </View>

      <Field label="Title (optional)" defaultValue={story.title ?? ''} onEndEditing={(e) => updateStory(story.id, { title: e.nativeEvent.text || null }).catch(() => undefined)} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={ui.label}>
          Transcript · {story.transcript_source === 'human' ? 'checked by family' : 'machine draft, please check'}
        </Text>
        {!story.transcript_text && <Button title="Transcribe" variant="secondary" onPress={transcribe} loading={busy === 'transcribe'} style={{ minHeight: 36 }} />}
      </View>
      {marks.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {marks.map((m) => (
            <Pressable key={m} onPress={() => insert(m)} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.soft, borderRadius: 8, marginRight: 6 }}>
              <Text style={{ fontSize: 18, color: colors.ink }}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <TextInput
        multiline
        value={text}
        onChangeText={setText}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder={story.status === 'transcribing' ? 'Transcribing… pull back to this screen in a moment.' : 'Type or paste the story text here.'}
        placeholderTextColor={colors.muted}
        style={[ui.input, { minHeight: 180, textAlignVertical: 'top', lineHeight: 24, marginBottom: space.md }]}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={ui.label}>English (draft translation)</Text>
        <Button title="Translate" variant="secondary" onPress={translate} loading={busy === 'translate'} style={{ minHeight: 36 }} />
      </View>
      <TextInput
        multiline
        value={translation}
        onChangeText={setTranslation}
        placeholder="The English translation appears here. Words marked [?] need a fluent speaker to check."
        placeholderTextColor={colors.muted}
        style={[ui.input, { minHeight: 140, textAlignVertical: 'top', lineHeight: 24, marginBottom: space.md }]}
      />

      <Button title="Save my corrections" onPress={save} loading={busy === 'save'} />
    </ScrollView>
  );
}
