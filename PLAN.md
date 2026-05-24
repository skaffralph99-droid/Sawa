# Connect Sawa to Supabase (auth, data, photo storage)

Your Supabase URL and key are already set as environment variables, so we just need to wire the app to them and create the database tables. Here's what I'll do:

## What you'll get
- **Real phone login** with SMS codes (replaces the demo code banner)
- **Cloud-saved plans, moments, friends, and profile** — synced across devices instead of stored only on the phone
- **Photo upload to the cloud** so mosaic photos and moments persist forever
- **Guest mode still works** — guests stay local until they sign up

## Setup steps (one-time, on your side)
1. **Enable phone auth in Supabase** — In your Supabase dashboard → Authentication → Providers → Phone, turn it on and connect a Twilio (or MessageBird/Vonage) account. Supabase sends the SMS through them. I'll show you exactly where to click.
2. **Run the database setup** — I'll give you one SQL script to paste into the Supabase SQL editor. It creates tables for profiles, plans, plan members, moments, friendships, and a storage bucket for photos, with row-level security so users only see their own + their friends' stuff.

## What I'll build in the app
- A small Supabase client layer that the rest of the app talks to
- A new `AuthProvider` that tracks the signed-in user, session, and profile (replaces the local-only state)
- Phone screen → calls Supabase `signInWithOtp` instead of generating a fake code
- OTP screen → verifies the code with Supabase; demo banner is removed (still shown only in guest dev mode)
- Profile setup → saves name + avatar to the `profiles` table
- Home (Plans / Moments) → loads from Supabase with React Query, with optimistic updates so it still feels instant
- Create plan → inserts into `plans` + invites friends via `plan_members`
- Camera / mosaic → uploads photos to the Supabase `photos` bucket, stores the URL in `moments`
- Friends search + QR add → reads/writes the `friendships` table
- Me / timeline → reads the current user's moments
- Settings → real sign-out that clears the Supabase session
- Guest mode → keeps the existing local-only behavior; a "Sign up to save" prompt appears when a guest tries to invite friends or sync

## Design / behavior
- Everything stays visually identical — no UI redesign, just real data instead of mock data
- Loading shimmers on first fetch, then cached instantly afterwards
- If a request fails (offline, etc.), the existing demo content shows as fallback so the app never looks broken
- The English/Arabic toggle and all current screens keep working unchanged

## After I'm done
You'll need to:
1. Add your Twilio credentials in Supabase (I'll point to the exact screen)
2. Paste the SQL script I provide into Supabase SQL editor and run it
3. Reload the app — real phone codes will start arriving

Want me to proceed?