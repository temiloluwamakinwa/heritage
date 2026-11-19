import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { CHAPTERS, LANGUAGES, type Story } from './types';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

export function buildBookHtml(title: string, familyName: string, stories: Story[]): string {
  const sections = CHAPTERS.map((chapter) => {
    const inChapter = stories
      .filter((s) => s.chapter === chapter && (s.transcript_text || s.translation_text))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (inChapter.length === 0) return '';
    const items = inChapter
      .map((s) => {
        const lang = LANGUAGES.find((l) => l.code === s.language)?.label ?? s.language;
        const original = s.transcript_text
          ? `<div class="col"><div class="label">${esc(lang)}</div><p>${esc(s.transcript_text)}</p></div>`
          : '';
        const english = s.translation_text
          ? `<div class="col"><div class="label">English</div><p>${esc(s.translation_text)}</p></div>`
          : '';
        return `
        <section class="story">
          <h3>${esc(s.title || s.prompt || 'A story')}</h3>
          <div class="by">Told by ${esc(s.storyteller_name)}</div>
          <div class="cols">${original}${english}</div>
        </section>`;
      })
      .join('');
    return `<h2 class="chapter">${esc(chapter)}</h2>${items}`;
  }).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #2B1D14; }
  .cover { text-align: center; padding-top: 38vh; page-break-after: always; }
  .cover h1 { font-size: 40px; margin: 0 0 12px; color: #9A3B1F; }
  .cover p { font-size: 18px; color: #7A6A5C; }
  h2.chapter { font-size: 26px; color: #9A3B1F; border-bottom: 2px solid #D9A441; padding-bottom: 6px; margin-top: 36px; page-break-before: always; }
  .story { margin: 22px 0; page-break-inside: avoid; }
  h3 { font-size: 19px; margin: 0; }
  .by { font-size: 13px; color: #7A6A5C; margin-bottom: 10px; font-style: italic; }
  .cols { display: flex; gap: 22px; }
  .col { flex: 1; }
  .label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #2F5D50; margin-bottom: 4px; }
  p { font-size: 14px; line-height: 1.6; margin: 0; }
</style></head>
<body>
  <div class="cover"><h1>${esc(title)}</h1><p>${esc(familyName)}</p></div>
  ${sections || '<p>No stories with text yet.</p>'}
</body></html>`;
}

export async function exportBook(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share your storybook' });
  }
}
