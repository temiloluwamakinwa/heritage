export type LanguageCode = 'yo' | 'ig' | 'ha' | 'pcm' | 'en';

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: 'yo', label: 'Yoruba', native: 'Yorùbá' },
  { code: 'ig', label: 'Igbo', native: 'Igbo' },
  { code: 'ha', label: 'Hausa', native: 'Hausa' },
  { code: 'pcm', label: 'Pidgin', native: 'Naijá' },
  { code: 'en', label: 'English', native: 'English' },
];

export const CHAPTERS = [
  'Names & Proverbs',
  'Childhood & Village',
  'Family & Marriage',
  'Food & Celebrations',
  'Journeys & Migration',
  'Advice & Blessings',
  'Other stories',
] as const;

export type Chapter = (typeof CHAPTERS)[number];

export type Family = {
  id: string;
  name: string;
  invite_code: string;
};

export type Story = {
  id: string;
  family_id: string;
  author_id: string;
  storyteller_name: string;
  language: LanguageCode;
  prompt: string | null;
  title: string | null;
  chapter: Chapter;
  duration_ms: number;
  audio_path: string | null;
  status: 'uploaded' | 'transcribing' | 'transcribed' | 'error';
  transcript_text: string | null;
  transcript_source: 'machine' | 'human' | null;
  translation_text: string | null;
  created_at: string;
};

export type PendingRecording = {
  localId: string;
  familyId: string;
  authorId: string;
  language: LanguageCode;
  prompt: string | null;
  chapter: Chapter;
  storytellerName: string;
  durationMs: number;
  localUri: string;
  mime: string;
  createdAt: number;
  attempts: number;
};
