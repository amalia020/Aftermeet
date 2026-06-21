# Demo Auth Operations

Aftermeet demo auth uses a passcode-gated Supabase anonymous session. Anonymous
users keep row-level security isolation because their requests still run as the
`authenticated` role with a unique `auth.uid()`.

Enable Anonymous Sign-Ins in Supabase Auth before using `/api/auth/demo`.

Optional cleanup, only when old demo users should be removed:

```sql
delete from auth.users
where is_anonymous is true
  and created_at < now() - interval '30 days';
```

Run cleanup manually after confirming no demo data needs to be kept.
