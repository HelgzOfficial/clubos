# ClubOS

The operating system for your football club — built with Next.js, TypeScript, and Tailwind CSS.

## What's in this version (v1)

- Dashboard — today's schedule, next match countdown, availability, injuries, weather, KPIs
- Match Centre — upcoming fixtures and results
- Calendar — monthly view of matches, training, and meetings
- Full sidebar navigation for all future modules (Opposition, Analysis, Training, Players, Medical, Recruitment, Documents, Settings) with "coming soon" placeholders
- Light and dark mode

All data on this version is **sample data** (see `lib/sample-data.ts`) so the app looks and feels real. Connecting it to your own live data (via Supabase) is the next step.

## Running it

This project deploys automatically via Vercel once connected to this GitHub repository — no local setup needed. If you ever want to run it on your own computer, you'd need Node.js installed, then:

```
npm install
npm run dev
```
