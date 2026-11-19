import { supabase } from './supabase';
import type { Chapter, Family, Story } from './types';

export async function listStories(familyId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Story[];
}

export async function getStory(id: string): Promise<Story> {
  const { data, error } = await supabase.from('stories').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Story;
}

export async function updateStory(id: string, patch: Partial<Story>): Promise<void> {
  const { error } = await supabase.from('stories').update(patch).eq('id', id);
  if (error) throw error;
}

export async function saveTranscriptCorrection(id: string, text: string): Promise<void> {
  await updateStory(id, { transcript_text: text, transcript_source: 'human' });
}

export async function setChapter(id: string, chapter: Chapter): Promise<void> {
  await updateStory(id, { chapter });
}

export async function signedAudioUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('recordings').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function runTranscribe(storyId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('transcribe', { body: { story_id: storyId } });
  if (error) throw error;
}

export async function runTranslate(storyId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('translate', { body: { story_id: storyId } });
  if (error) throw error;
}

export async function createFamily(name: string): Promise<Family> {
  const { data, error } = await supabase.rpc('create_family', { family_name: name });
  if (error) throw error;
  return data as Family;
}

export async function joinFamily(code: string): Promise<Family> {
  const { data, error } = await supabase.rpc('join_family', { code: code.trim().toUpperCase() });
  if (error) throw error;
  return data as Family;
}

export async function memberCount(familyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('family_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('family_id', familyId);
  if (error) throw error;
  return count ?? 0;
}
