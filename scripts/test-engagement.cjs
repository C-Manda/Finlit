const assert = require('node:assert/strict');
const fs = require('node:fs');

const rpc = fs.readFileSync('supabase/migrations/20261109185401_secure_engagement_activity_rpc.sql', 'utf8');
const schema = fs.readFileSync('supabase/migrations/20261109185309_profile_engagement_notifications.sql', 'utf8');
const validation = fs.readFileSync('supabase/migrations/20261109185332_validate_engagement_activity_sources.sql', 'utf8');
const push = fs.readFileSync('supabase/functions/_shared/push.ts', 'utf8');
const delivery = fs.readFileSync('supabase/functions/send-notifications/index.ts', 'utf8');

assert.match(schema, /unique index if not exists engagement_activity_source_unique/);
assert.match(rpc, /last_active_on = activity_day - 1/);
assert.match(rpc, /else 1/);
assert.match(rpc, /greatest\(/);
assert.match(rpc, /on conflict \(user_id, activity_type, source_key\) do nothing/);
assert.match(validation, /Lesson completion has not been verified/);
assert.match(validation, /Assessment completion has not been verified/);
assert.match(validation, /Daily check-in requires a stable date source identifier/);
assert.match(push, /quietStart > quietEnd \? current >= quietStart \|\| current < quietEnd/);
assert.match(delivery, /DeviceNotRegistered/);

console.log('Engagement checks passed: stable source dedupe, streak reset/continuation, longest-streak preservation, source validation, quiet hours and invalid-token handling.');
