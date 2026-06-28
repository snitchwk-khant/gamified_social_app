# create-user

Supabase Edge Function for Admin-created employee accounts.

## Required secrets

Set these in the Supabase project environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

## Deploy

1. Set the service role key in Supabase secrets.
2. Deploy the function with the Supabase CLI.
3. Confirm the function is reachable at the `create-user` Edge Function URL in your project.

Example:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase functions deploy create-user
```

## Test

Use a valid admin access token in the `Authorization: Bearer <token>` header.

```bash
curl -i \
  -X POST "<YOUR_SUPABASE_FUNCTION_URL>/create-user" \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "password": "TempPass123!",
    "employee_id": "EMP-1001",
    "department": "Sales",
    "position": "Associate",
    "role": "employee",
    "monthly_target_amount": 5000
  }'
```

The function should return the created profile fields only.