import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { RECORDINGS_BUCKET, supabase } from './supabase';
import type { PendingRecording } from './types';

const KEY = 'heritage.pendingRecordings.v1';

export function newLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listPending(): Promise<PendingRecording[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as PendingRecording[]) : [];
}

async function savePending(items: PendingRecording[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

/** Copy the recording somewhere the OS will not clean up, then queue it. */
export async function enqueueRecording(
  item: Omit<PendingRecording, 'localId' | 'createdAt' | 'attempts' | 'localUri'> & { sourceUri: string },
): Promise<PendingRecording> {
  const localId = newLocalId();
  let localUri = item.sourceUri;
  if (Platform.OS !== 'web') {
    const ext = item.mime === 'audio/webm' ? 'webm' : 'm4a';
    const dest = new File(Paths.document, `recording-${localId}.${ext}`);
    new File(item.sourceUri).copy(dest);
    localUri = dest.uri;
  }
  const { sourceUri: _ignored, ...rest } = item;
  const entry: PendingRecording = { ...rest, localId, localUri, createdAt: Date.now(), attempts: 0 };
  const all = await listPending();
  await savePending([...all, entry]);
  return entry;
}

async function readBytes(item: PendingRecording): Promise<ArrayBuffer | Blob> {
  if (Platform.OS === 'web') {
    const res = await fetch(item.localUri);
    return res.blob();
  }
  return new File(item.localUri).arrayBuffer();
}

/** Upload one queued recording: story row, audio file, then machine transcription. */
async function uploadOne(item: PendingRecording): Promise<void> {
  const ext = item.mime === 'audio/webm' ? 'webm' : 'm4a';
  const path = `${item.familyId}/${item.localId}.${ext}`;

  const body = await readBytes(item);
  const { error: upErr } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .upload(path, body, { contentType: item.mime, upsert: true });
  if (upErr) throw upErr;

  const { data: story, error: insErr } = await supabase
    .from('stories')
    .insert({
      family_id: item.familyId,
      author_id: item.authorId,
      storyteller_name: item.storytellerName,
      language: item.language,
      prompt: item.prompt,
      chapter: item.chapter,
      duration_ms: item.durationMs,
      audio_path: path,
      status: 'uploaded',
    })
    .select('id')
    .single();
  if (insErr) throw insErr;

  // Transcription is best effort: the recording is already safe.
  supabase.functions.invoke('transcribe', { body: { story_id: story.id } }).catch(() => undefined);
}

let flushing = false;

/** Try to upload everything in the queue. Safe to call repeatedly. */
export async function flushQueue(): Promise<{ uploaded: number; remaining: number }> {
  if (flushing) return { uploaded: 0, remaining: (await listPending()).length };
  flushing = true;
  let uploaded = 0;
  try {
    const items = await listPending();
    const keep: PendingRecording[] = [];
    for (const item of items) {
      try {
        await uploadOne(item);
        uploaded += 1;
        if (Platform.OS !== 'web') {
          try {
            new File(item.localUri).delete();
          } catch {
            // Leaving the file behind is harmless.
          }
        }
      } catch {
        keep.push({ ...item, attempts: item.attempts + 1 });
      }
    }
    await savePending(keep);
    return { uploaded, remaining: keep.length };
  } finally {
    flushing = false;
  }
}
