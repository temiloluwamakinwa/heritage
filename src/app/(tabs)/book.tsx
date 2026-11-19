import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button, Card, Field, Heading } from '../../components/ui';
import { listStories } from '../../lib/api';
import { errorMessage, notify } from '../../lib/notify';
import { buildBookHtml, exportBook } from '../../lib/pdf';
import { useApp } from '../../lib/session';
import { colors, space } from '../../lib/theme';
import { CHAPTERS, type Story } from '../../lib/types';

export default function Book() {
  const { family } = useApp();
  const [stories, setStories] = useState<Story[]>([]);
  const [title, setTitle] = useState('Our Family Stories');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (family) listStories(family.id).then(setStories).catch(() => undefined);
    }, [family]),
  );

  const ready = stories.filter((s) => s.transcript_text || s.translation_text);

  async function exportPdf() {
    if (!family) return;
    if (ready.length === 0) return notify('Nothing to print yet', 'Stories need some text first. Open a story and check its transcript.');
    setBusy(true);
    try {
      await exportBook(buildBookHtml(title.trim() || 'Our Family Stories', family.name, stories));
    } catch (e) {
      notify('Could not make the PDF', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <Heading sub="Your stories, grouped into chapters, with the original language beside the English.">Storybook</Heading>
      <Field label="Book title" value={title} onChangeText={setTitle} />

      {CHAPTERS.map((c) => {
        const inChapter = stories.filter((s) => s.chapter === c);
        const withText = inChapter.filter((s) => s.transcript_text || s.translation_text).length;
        return (
          <Card key={c}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>{c}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>
              {inChapter.length} stor{inChapter.length === 1 ? 'y' : 'ies'} · {withText} with text
            </Text>
          </Card>
        );
      })}

      <Button title="Export as PDF" onPress={exportPdf} loading={busy} />
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: space.md, lineHeight: 18 }}>
        Tip: open each story first to fix any mistakes in the transcript. Stories marked "Checked by family" are the ones you can trust most.
      </Text>
    </ScrollView>
  );
}
