// Drafts an English translation of a story transcript with an LLM.
//
// Choose the provider with the TRANSLATE_PROVIDER secret: "anthropic" (default) or "gemini".
//
// Secrets (supabase secrets set ...):
//   TRANSLATE_PROVIDER  anthropic | gemini
//   ANTHROPIC_API_KEY   + optional ANTHROPIC_MODEL (default claude-sonnet-5-5)
//   GEMINI_API_KEY      + optional GEMINI_MODEL (default gemini-flash-latest)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const LANGUAGE_NAMES: Record<string, string> = {
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
  pcm: 'Nigerian Pidgin',
  en: 'English',
};

const SYSTEM = `You translate family oral-history stories from Nigerian languages into clear, warm English.
Rules:
- Keep personal names, place names and titles exactly as written.
- Keep proverbs and sayings, then give their meaning in brackets, e.g. "Proverb (meaning: ...)".
- Never invent details that are not in the text. Do not add commentary.
- The text is a machine transcript and may contain errors. If a passage is unclear, translate your best reading and mark it with [?].
- Output only the English translation.`;

async function withAnthropic(userText: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Translation is not configured yet (ANTHROPIC_API_KEY).');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) throw new Error(`Translation service returned ${res.status}`);
  const out = await res.json();
  return (out.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
    .trim();
}

async function withGemini(userText: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Translation is not configured yet (GEMINI_API_KEY).');
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
    }),
  });
  if (!res.ok) throw new Error(`Translation service returned ${res.status}`);
  const out = await res.json();
  const parts = out.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: { text?: string }) => p.text ?? '').join('').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  try {
    const { story_id } = await req.json();
    if (!story_id) return json({ error: 'story_id is required' }, 400);

    const { data: story, error } = await userClient.from('stories').select('*').eq('id', story_id).single();
    if (error || !story) return json({ error: 'Story not found' }, 404);
    if (!story.transcript_text) return json({ error: 'There is no transcript to translate yet' }, 400);

    const language = LANGUAGE_NAMES[story.language] ?? story.language;
    const userText = `Language: ${language}\nStoryteller: ${story.storyteller_name}\nQuestion asked: ${story.prompt ?? 'n/a'}\n\nTranscript:\n${story.transcript_text}`;

    const provider = (Deno.env.get('TRANSLATE_PROVIDER') ?? 'anthropic').toLowerCase();
    const english = provider === 'gemini' ? await withGemini(userText) : await withAnthropic(userText);
    if (!english) throw new Error('The translation came back empty');

    const { error: upErr } = await userClient.from('stories').update({ translation_text: english }).eq('id', story_id);
    if (upErr) throw upErr;
    return json({ ok: true, provider });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
