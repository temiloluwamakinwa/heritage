// Transcribes a story's recording.
//
// TRANSCRIBE_PROVIDER=spitch  uses Spitch (https://api.spitch.app/v1/transcriptions); set SPITCH_API_KEY.
// Otherwise any OpenAI-compatible speech-to-text endpoint is used:
// Secrets (supabase secrets set ...):
//   TRANSCRIBE_URL    e.g. https://<your-host>/v1/audio/transcriptions
//   TRANSCRIBE_KEY    API key for that host
//   TRANSCRIBE_MODEL  model name the host expects (default: whisper-1)
//
// Swap providers by changing these secrets; the app does not change.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let story_id: string | undefined;
  try {
    ({ story_id } = await req.json());
    if (!story_id) return json({ error: 'story_id is required' }, 400);

    // Row-level security means this only succeeds for members of the story's family.
    const { data: story, error } = await userClient.from('stories').select('*').eq('id', story_id).single();
    if (error || !story) return json({ error: 'Story not found' }, 404);
    if (!story.audio_path) return json({ error: 'This story has no recording' }, 400);

    const provider = (Deno.env.get('TRANSCRIBE_PROVIDER') ?? 'openai').toLowerCase();
    const spitch = provider === 'spitch';
    const endpoint = spitch ? 'https://api.spitch.app/v1/transcriptions' : Deno.env.get('TRANSCRIBE_URL');
    const key = spitch ? Deno.env.get('SPITCH_API_KEY') : Deno.env.get('TRANSCRIBE_KEY');
    if (!endpoint || !key) {
      return json(
        { error: spitch ? 'Transcription is not configured yet (SPITCH_API_KEY).' : 'Transcription service is not configured yet (TRANSCRIBE_URL / TRANSCRIBE_KEY).' },
        503,
      );
    }

    await admin.from('stories').update({ status: 'transcribing' }).eq('id', story_id);

    const { data: audio, error: dlErr } = await admin.storage.from('recordings').download(story.audio_path);
    if (dlErr || !audio) throw new Error('Could not read the recording');

    const ext = story.audio_path.endsWith('.webm') ? 'webm' : 'm4a';
    const file = new File([audio], `story.${ext}`, { type: audio.type || 'audio/mp4' });
    const form = new FormData();
    if (spitch) {
      // Spitch supports yo, ig, ha and en. Pidgin is not a Spitch language: English is the closest fit.
      form.append('content', file);
      form.append('language', story.language === 'pcm' ? 'en' : story.language);
    } else {
      form.append('file', file);
      form.append('model', Deno.env.get('TRANSCRIBE_MODEL') ?? 'whisper-1');
      form.append('response_format', 'json');
      // Nigerian Pidgin has no ISO-639-1 code in most providers: let them auto-detect.
      if (story.language !== 'pcm') form.append('language', story.language);
    }

    const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!res.ok) throw new Error(`Transcription provider returned ${res.status}`);
    const out = await res.json();
    const text = String(out.text ?? '').trim();

    await admin
      .from('stories')
      .update({ transcript_text: text, transcript_source: 'machine', status: 'transcribed' })
      .eq('id', story_id);
    return json({ ok: true, characters: text.length });
  } catch (e) {
    if (story_id) await admin.from('stories').update({ status: 'error' }).eq('id', story_id);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
