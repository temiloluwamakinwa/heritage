// Transcribes a story's recording.
//
// TRANSCRIBE_PROVIDER=gemini  uses Gemini audio understanding; set GEMINI_API_KEY (+ optional GEMINI_MODEL).
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
    const gemini = provider === 'gemini';
    const spitch = provider === 'spitch';
    const endpoint = spitch ? 'https://api.spitch.app/v1/transcriptions' : Deno.env.get('TRANSCRIBE_URL');
    const key = spitch ? Deno.env.get('SPITCH_API_KEY') : Deno.env.get('TRANSCRIBE_KEY');
    if (gemini && !Deno.env.get('GEMINI_API_KEY')) {
      return json({ error: 'Transcription is not configured yet (GEMINI_API_KEY).' }, 503);
    }
    if (!gemini && (!endpoint || !key)) {
      return json(
        { error: spitch ? 'Transcription is not configured yet (SPITCH_API_KEY).' : 'Transcription service is not configured yet (TRANSCRIBE_URL / TRANSCRIBE_KEY).' },
        503,
      );
    }

    await admin.from('stories').update({ status: 'transcribing' }).eq('id', story_id);

    const { data: audio, error: dlErr } = await admin.storage.from('recordings').download(story.audio_path);
    if (dlErr || !audio) throw new Error('Could not read the recording');

    const ext = story.audio_path.endsWith('.webm') ? 'webm' : 'm4a';

    if (gemini) {
      // Gemini takes audio inline (under ~20 MB per request) and follows a transcription prompt.
      const bytes = new Uint8Array(await audio.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const lang = ({ yo: 'Yoruba', ig: 'Igbo', ha: 'Hausa', pcm: 'Nigerian Pidgin', en: 'English' } as Record<string, string>)[story.language] ?? story.language;
      const prompt = `Transcribe this recording of a family story, spoken in ${lang}, exactly as spoken. Do not translate. Write ${lang} with correct tone marks and diacritics. Keep names as spoken. If a word is unclear, give your best reading followed by [?]. Output only the transcript, with speakers on separate lines if more than one.`;
      const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
      const gres = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: ext === 'webm' ? 'audio/webm' : 'audio/mp4', data: btoa(bin) } }] },
          ],
        }),
      });
      if (!gres.ok) throw new Error(`Transcription provider returned ${gres.status}`);
      const gout = await gres.json();
      const gtext = ((gout.candidates?.[0]?.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? '').join('').trim();
      if (!gtext) throw new Error('The transcript came back empty');
      await admin
        .from('stories')
        .update({ transcript_text: gtext, transcript_source: 'machine', status: 'transcribed' })
        .eq('id', story_id);
      return json({ ok: true, provider, characters: gtext.length });
    }

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

    const res = await fetch(endpoint!, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
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
