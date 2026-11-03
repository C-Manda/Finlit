// Full migration replay on disposable Postgres. Supabase Auth is the only platform stub.
const fs=require('node:fs');
const files=()=>fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
async function migrate(db,file){await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;','-- gen_random_uuid is built in; pgcrypto is not needed by this test.'));}
async function setup(db,{through}={}){
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
 grant usage on schema public,auth to anon,authenticated;
 grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
 for(const file of files())if(!through||file<=through)await migrate(db,file);
}
module.exports={setup,migrate,files};
