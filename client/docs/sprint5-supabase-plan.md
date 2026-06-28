# Sprint 5 - Supabase Production Schema + Feature Lock Foundation

This sprint follows the architecture decision: Supabase only.

- No MongoDB
- No Express backend
- Frontend remains React + Vite + Tailwind

## 1) Current Supabase Usage (Confirmed in code)

Current frontend already uses:

- `profiles` table
- `posts` table
- `comments` table
- `avatars` storage bucket
- Supabase Auth (`auth.users`) via `supabase.auth`
- Supabase Realtime channels on `posts` and `comments`

Main references:

- [src/context/auth_context.jsx](src/context/auth_context.jsx)
- [src/services/profile_service.js](src/services/profile_service.js)
- [src/services/post_service.js](src/services/post_service.js)
- [src/components/center_feed/post_card.jsx](src/components/center_feed/post_card.jsx)
- [src/pages/admin_page.jsx](src/pages/admin_page.jsx)

## 2) Missing Tables for Full Feature Set

Required and not fully implemented in frontend yet:

1. `likes`
2. `stories`
3. `messages`
4. `notifications`
5. `announcements`
6. `admin_configs`
7. `sales_updates`

`profiles`, `posts`, `comments` already exist in usage and are included in schema upgrade.

## 3) Sprint 5 Database Deliverable

Created migration:

- [supabase/migrations/20260628_sprint5_supabase_production_schema.sql](supabase/migrations/20260628_sprint5_supabase_production_schema.sql)

This migration includes:

1. All required tables:
   - `profiles`
   - `posts`
   - `comments`
   - `likes`
   - `stories`
   - `messages`
   - `notifications`
   - `announcements`
   - `admin_configs`
   - `sales_updates`
2. Role model for `admin`, `hr`, `accountant`, `employee`
3. Sales/target fields in `profiles`:
   - `monthly_target_amount`
   - `daily_sales_amount`
   - `monthly_sales_accumulated`
   - computed `target_percentage`
4. Feature lock foundation in `admin_configs` with seed key `feature_locks`
5. RLS policies by role and ownership
6. Triggers for `updated_at`
7. Trigger to keep `posts.comments_count` synced
8. Storage buckets:
   - `avatars`
   - `post-images`
   - `story-images`

## 4) Frontend Compatibility Notes

To avoid breaking current admin/dashboard behavior:

1. Existing fields used by current pages remain supported.
2. `posts.comments_count` is maintained by DB trigger.
3. `profiles.role` remains central for route guards and sidebar visibility.
4. Existing `avatars` bucket path pattern (`<userId>/avatar-...`) remains valid.

## 5) Naming Bridge (Current UI vs Sprint Schema)

Current React code uses camelCase names in requirement docs, while DB uses snake_case.

Mapping:

- `monthlyTargetAmount` -> `profiles.monthly_target_amount`
- `dailySalesAmount` -> `profiles.daily_sales_amount`
- `monthlySalesAccumulated` -> `profiles.monthly_sales_accumulated`
- `targetPercentage` -> `profiles.target_percentage`

No frontend change is required immediately for this sprint foundation.

## 6) Recommended Execution Order

1. Run migration in Supabase SQL editor.
2. Verify existing app still loads login, profile, feed, admin summary.
3. Confirm RLS access with at least:
   - 1 admin
   - 1 hr
   - 1 accountant
   - 1 employee
4. Enable Realtime on tables needed for live UI:
   - `posts`, `comments`, `messages`, `notifications`, `stories`
5. Next sprint: wire UI modules for stories/messages/notifications/announcements/sales updates and feature lock checks from `admin_configs`.

## 7) Quick Validation Queries

Use Supabase SQL editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','posts','comments','likes','stories','messages',
    'notifications','announcements','admin_configs','sales_updates'
  )
order by table_name;
```

```sql
select key, value
from public.admin_configs
where key = 'feature_locks';
```

```sql
select id, email, role, monthly_target_amount, daily_sales_amount, monthly_sales_accumulated, target_percentage
from public.profiles
limit 20;
```
