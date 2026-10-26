# KEVLAR

A personal money tracker that runs in the browser and keeps everything on your device. It looks like an old amber computer terminal, and it comes with BRIC, a butler who keeps an eye on your ledger.

Live at <https://kevlar011.github.io/PWA_BA-001/>. Open it on your phone and add it to your home screen to install it.

## What it does

- **Log money in and out.** Tap a category, type the amount. Your balance is your starting amount plus everything you've logged.
- **Budgets.** Give a category a monthly limit and watch the bar fill.
- **Goals, bills and debts.** Save toward targets, keep a list of recurring bills, and track debts. For debts, KEVLAR works out how long you'll take to pay them off if you clear the highest rate first or the smallest balance first.
- **Leak scan.** Finds charges that keep coming back like a subscription but aren't on your bills list, and spending categories that are creeping up. Shows what each one costs you a year.
- **Zakat.** With Islamic mode on (the default), it tracks your hawl against the nisab and flags anything that looks like interest.
- **BRIC.** If you add a DeepSeek API key, BRIC writes your daily briefing and monthly report, and you can talk to him. He can log entries, pay off debts and add bills for you from the chat, and every change he makes has an UNDO.
- **Sync and lock.** Optional encrypted sync between your devices through your own Supabase project, and an optional lock with a passphrase or Face ID.

## Your data

Everything lives in your browser's storage. Nothing is sent anywhere unless you turn something on:

- **Sync** encrypts your ledger on the device before it's uploaded. The server can't read it, and without your passphrase it can't be recovered.
- **BRIC** sends DeepSeek a summary of your ledger each time he replies. Your API key stays on the device and is never synced or put in backups.

Export a backup from Settings now and then. It's the only copy that's fully in your hands.

## Running it locally

You need Node.js.

```bash
npm install
npx expo start --web
```

Then open <http://localhost:8081>.

## Deploying

Pushing to `main` builds the web version and publishes it to GitHub Pages (see `.github/workflows/deploy.yml`). If you change what the service worker caches, bump the cache name in `public/sw.js` so installed copies pick up the new build.

## Built with

Expo and React Native for web, expo-router, zustand, and react-native-reanimated. BRIC talks to the DeepSeek API straight from the browser.
