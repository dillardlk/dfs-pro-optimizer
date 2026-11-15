'use strict';
// Run with @electric-sql/pglite installed. This uses PostgreSQL's real RLS
// implementation with a small auth-schema fixture, not a mocked policy engine.
const {PGlite}=require('@electric-sql/pglite');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const db=new PGlite();
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`create schema auth; create role anon; create role authenticated;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth, public to authenticated, anon;
   grant execute on function auth.uid() to authenticated, anon;`);
  await db.query('insert into auth.users(id) values ($1),($2)',[a,b]);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/202611150001_private_optimizer_presets.sql'),'utf8'));
  async function as(role,id,action){
   await db.exec(`set role ${role}`);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
   try{return await action()}finally{await db.exec('reset role')}
  }
  async function save(id,name){
   return db.query(`insert into public.optimizer_presets(user_id,name,profile) values ($1,$2,$3)
    on conflict(user_id,name) do update set profile=excluded.profile returning name`,[id,name,JSON.stringify({version:1,name})]);
  }
  await as('authenticated',a,()=>save(a,'Desktop'));
  await assert.rejects(as('anon','',()=>db.query('select * from public.optimizer_presets')),/permission denied/);
  await as('authenticated',b,async()=>{
   assert.equal((await db.query('select * from public.optimizer_presets')).rows.length,0);
   await save(b,'iPad');
   await assert.rejects(save(a,'Attack'),/row-level security/);
   assert.equal((await db.query('update public.optimizer_presets set name=\'stolen\' where user_id=$1 returning name',[a])).rows.length,0);
   assert.equal((await db.query('delete from public.optimizer_presets where user_id=$1 returning name',[a])).rows.length,0);
   await assert.rejects(db.query('update public.optimizer_presets set user_id=$1 where user_id=$2',[a,b]),/row-level security/);
   assert.equal((await db.query('select name from public.optimizer_presets')).rows[0].name,'iPad');
  });
  await as('authenticated',a,async()=>{
   await assert.rejects(db.query('insert into public.optimizer_presets(user_id,name,profile) values ($1,$2,$3)',[a,'Bad','{"version":1}']),/check constraint/);
   for(let i=1;i<20;i++)await save(a,'Preset '+i);
   await assert.rejects(save(a,'Overflow'),/20 account presets/);
   await save(a,'Desktop'); // Upserting an existing name still works at quota.
   assert.equal((await db.query('select * from public.optimizer_presets')).rows.length,20);
  });
  console.log('PostgreSQL audit passed: anonymous access denied; two-account read/write isolation; ownership changes denied; schema validation and 20-preset quota enforced.');
 }finally{await db.close()}
})().catch(error=>{console.error(error.message);process.exitCode=1});
