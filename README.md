# Heritage

Record the stories, names and proverbs of the people you love, in their own language, and turn them into a family storybook. Built for Yoruba, Igbo, Hausa and Nigerian Pidgin first.

One Expo (React Native, TypeScript) codebase runs on **Android, iOS and the web**.

## How it works

1. Sign up, create a **family circle** and share the invite code.
2. Pick a language and a question (the first ones are "How did you get your name?" and "Share a proverb"), then **record**. Recording works offline and uploads later.
3. A speech model drafts the **transcript**. A family member listens and **fixes it**, with a tone-mark keyboard row for Yoruba, Igbo and Hausa letters.
4. Claude drafts an **English translation** beside the original.
5. Stories are grouped into chapters and exported as a **PDF storybook**.

Transcripts are machine drafts. The app marks stories "Checked by family" once a person has corrected them.

## Project layout

```
src/app/            screens (Expo Router)
src/components/     shared UI
src/lib/            Supabase client, offline upload queue, API calls, PDF export
supabase/migrations database schema + security rules
supabase/functions  transcribe (speech-to-text) and translate (Claude) server functions
eas.json            build profiles
.github/workflows   one-click Android APK build
```

## Setup

### 1. Supabase (backend)

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Under Authentication, for a quick beta you may switch off "Confirm email".
4. Copy the project URL and anon key into `.env` (see `.env.example`).
5. Deploy the functions with the Supabase CLI:

   ```bash
   supabase functions deploy transcribe
   supabase functions deploy translate
   supabase secrets set ANTHROPIC_API_KEY=...            # translation
   supabase secrets set TRANSCRIBE_URL=... TRANSCRIBE_KEY=... TRANSCRIBE_MODEL=...   # speech-to-text
   ```

`TRANSCRIBE_URL` is any speech-to-text endpoint that follows the OpenAI `/v1/audio/transcriptions` format. Changing provider or model is only a change to these secrets.

### 2. Run it

```bash
npm install
npm run web        # in the browser
npm run android    # needs a device or emulator
```

### 3. Build the Android beta (APK)

1. Create a free account at expo.dev and an **access token** (Account settings > Access tokens).
2. In this repo: Settings > Secrets and variables > Actions > New repository secret, name `EXPO_TOKEN`.
3. In the Expo project's Environment variables, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the **preview** environment.
4. Actions tab > "Build Android beta (APK)" > Run workflow. The log ends with a download link; share it with testers.

The first Android build must create a signing key. If the non-interactive build stops on credentials, run `npx eas-cli build --platform android --profile preview` once from a computer and answer yes when it offers to generate a keystore. After that the workflow works on its own.

Testers open the link on an Android phone and allow "install unknown apps".

### 4. iPhone testers

iPhones cannot install an APK. Until you join the Apple Developer Program (for TestFlight), iPhone testers can use the web version in Safari and choose Share > Add to Home Screen.

## Roadmap

- Tap a word to hear that moment of the recording (needs word timestamps)
- Human review service for translations
- Print-on-demand ordering and QR codes in the book that play the original audio
- Weekly prompt reminders
- Landing page
