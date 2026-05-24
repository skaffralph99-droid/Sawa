-- =====================================================================
-- Sawa — WIPE DEMO DATA
-- Paste into Supabase Dashboard → SQL Editor → Run.
--
-- This deletes the old mock plans/moments/etc. so every account
-- starts clean. Real data created from the app is preserved unless
-- it matches the demo titles below.
-- =====================================================================

-- 1. Delete the seeded demo plans (matched by title) and their members/moments cascade.
delete from public.plans
where title in (
  '🏖️ عالبحر اليوم',
  '🍽️ عشاء بمار مخايل',
  '⚽ ماتش فوتبول بالشب',
  '☕ قهوة الصبح بالحمرا'
);

-- 2. (Optional, nuclear) wipe ALL plans, members, and moments.
--    Uncomment the next 3 lines if you want a completely empty database.
-- delete from public.moments;
-- delete from public.plan_members;
-- delete from public.plans;

-- 3. (Optional) wipe friendships if you want to reset all connections.
-- delete from public.friendships;

-- 4. (Optional) reset profile names that were auto-seeded to 'أنا'.
-- update public.profiles set name = null where name = 'أنا';

-- Sanity check — should return 0 rows if the demo plans are gone:
select count(*) as remaining_demo_plans
from public.plans
where title in (
  '🏖️ عالبحر اليوم',
  '🍽️ عشاء بمار مخايل',
  '⚽ ماتش فوتبول بالشب',
  '☕ قهوة الصبح بالحمرا'
);

-- Show what's left in the database so you can verify:
select id, title, location, owner_id, created_at
from public.plans
order by created_at desc;
