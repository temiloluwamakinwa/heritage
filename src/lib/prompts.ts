import type { Chapter } from './types';

export type StoryPrompt = { id: string; chapter: Chapter; text: string };

// The first two prompts are the heart of the app: names and proverbs.
export const PROMPTS: StoryPrompt[] = [
  {
    id: 'name',
    chapter: 'Names & Proverbs',
    text: 'How did you get your name? Who gave it to you, and what does it mean?',
  },
  {
    id: 'proverb',
    chapter: 'Names & Proverbs',
    text: 'Share a proverb your parents or grandparents used. When did they say it, and what did it teach you?',
  },
  {
    id: 'village',
    chapter: 'Childhood & Village',
    text: 'Describe the place you grew up. What did the day look, sound and smell like?',
  },
  {
    id: 'game',
    chapter: 'Childhood & Village',
    text: 'What games, songs or chores do you remember from when you were small?',
  },
  {
    id: 'meeting',
    chapter: 'Family & Marriage',
    text: 'How did you meet your husband or wife, and how was the wedding?',
  },
  {
    id: 'parents',
    chapter: 'Family & Marriage',
    text: 'Tell us about your parents. What were they like, and what did they do?',
  },
  {
    id: 'festival',
    chapter: 'Food & Celebrations',
    text: 'Tell us about a festival or celebration your family kept. Which food do you remember most?',
  },
  {
    id: 'journey',
    chapter: 'Journeys & Migration',
    text: 'Tell us about a long journey or a time you left home. What did you carry with you?',
  },
  {
    id: 'blessing',
    chapter: 'Advice & Blessings',
    text: 'What blessing or advice would you like your grandchildren to hear from you?',
  },
  {
    id: 'free',
    chapter: 'Other stories',
    text: 'Tell any story you would like to be remembered.',
  },
];
