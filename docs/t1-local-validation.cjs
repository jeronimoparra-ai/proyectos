/* Local-only integration harness. See t1-postgres-report.md for setup and limitations. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { tmpdir } = require('node:os');
const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const tools = createRequire(path.join(process.env.T1_TOOLS || '/tmp/t1-postgres-tools', 'package.json'));
const backend = createRequire(path.join(root, 'backend/package.json'));
const { Client } = tools('pg');
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const taskA = '11111111-1111-4111-8111-111111111111';
const taskB = '22222222-2222-4222-8222-222222222222';
const reminder = '33333333-3333-4333-8333-333333333333';
const dbConfig = { host:'127.0.0.1', port:55432, user:'postgres', password:'synthetic-local-only' };
const sql = file => fs.readFileSync(path.join(root, 'backend/src/database/migrations', file), 'utf8');
const files = fs.readdirSync(path.join(root, 'backend/src/database/migrations')).sort();
const migration = sql(files.find(f=>f.startsWith('004_')));
const secret = 'synthetic-local-jwt-secret-at-least-32-characters';
const jwt = (role, sub) => {
  const parts = [{alg:'HS256',typ:'JWT'},{role,sub,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated'}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
  return parts.join('.')+'.'+createHmac('sha256', secret).update(parts.join('.')).digest('base64url');
};
const tokenA = jwt('authenticated', userA), tokenB = jwt('authenticated', userB);
const serviceToken = jwt('service_role');
const dbNames = { clean: `t1_clean_${process.pid}`, incremental: `t1_incremental_${process.pid}` };
async function rejection(db, query, code) {
  try { await db.query(query); assert.fail('Unexpected success: '+query); }
  catch (e) { assert.equal(e.code, code, e.message); }
}
async function seed(db) {
  await db.query(`INSERT INTO auth.users VALUES ('${userA}'), ('${userB}');
  INSERT INTO tasks(id,user_id,title) VALUES ('${taskA}','${userA}','A private'), ('${taskB}','${userB}','B private');`);
}
async function setup(db) {
  await db.query(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
  for (const file of files.filter(f=>!f.startsWith('004_'))) await db.query(sql(file));
}
async function main() {
  const admin = new Client(dbConfig); await admin.connect();
  await admin.query(`DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticator LOGIN PASSWORD 'synthetic-api-only' NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    GRANT anon,authenticated,service_role TO authenticator;`);
  for (const name of Object.values(dbNames)) await admin.query(`CREATE DATABASE ${name}`);
  const clean = new Client({...dbConfig,database:dbNames.clean}); await clean.connect();
  const prior = new Client({...dbConfig,database:dbNames.incremental}); await prior.connect();
  await setup(clean); await clean.query(migration); await seed(clean);
  await setup(prior); await seed(prior);
  await prior.query(`INSERT INTO reminders(id,task_id,user_id,remind_at) VALUES ('${reminder}','${taskB}','${userA}',now())`);
  await rejection(prior,migration,'P0001'); await prior.query('ROLLBACK');
  assert.equal((await prior.query('SELECT count(*)::int n FROM reminders')).rows[0].n,1);
  assert.equal((await prior.query(`SELECT count(*)::int n FROM pg_constraint WHERE conname='reminders_task_id_fkey'`)).rows[0].n,1);
  await prior.query(`UPDATE reminders SET task_id='${taskA}' WHERE id='${reminder}' AND user_id='${userA}'`);
  await prior.query(migration);
  assert.equal((await prior.query('SELECT count(*)::int n FROM reminders')).rows[0].n,1);
  console.log('PASS clean 001–004; historical mismatch aborts atomically; reviewed repair preserves row; incremental 004');
  for (const db of [clean,prior]) {
    await db.query(`SET ROLE service_role`);
    await rejection(db,`INSERT INTO reminders(task_id,user_id,remind_at) VALUES ('${taskB}','${userA}',now())`,'23503');
    await db.query(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claims','{"sub":"${userA}"}',false)`);
    assert.equal((await db.query('SELECT count(*)::int n FROM tasks')).rows[0].n,1);
    await rejection(db,`INSERT INTO reminders(task_id,user_id,remind_at) VALUES ('${taskB}','${userA}',now())`,'42501');
    await db.query(`INSERT INTO reminders(task_id,user_id,remind_at) VALUES ('${taskA}','${userA}',now())`);
    await rejection(db,`UPDATE reminders SET task_id='${taskB}' WHERE user_id='${userA}'`,'42501');
    await db.query(`RESET ROLE; SET ROLE service_role`);
    await rejection(db,`UPDATE tasks SET user_id='${userB}' WHERE id='${taskA}'`,'23503');
    await rejection(db,`UPDATE reminders SET task_id='${taskB}' WHERE user_id='${userA}'`,'23503');
    await db.query(`RESET ROLE; SET ROLE anon`);
    await rejection(db,'SELECT * FROM reminders','42501');
    await db.query('RESET ROLE');
    assert.equal((await db.query(`SELECT bool_and(convalidated) ok FROM pg_constraint WHERE conname='reminders_task_id_user_id_fkey'`)).rows[0].ok,true);
  }
  console.log('PASS RLS own CRUD/cross-owner rejection; service_role FK rejection on child and parent updates; anon denied');
  const postgrest = spawn(path.join(process.env.T1_TOOLS || '/tmp/t1-postgres-tools','postgrest'), [], {env:{...process.env,
    PGRST_DB_URI:`postgresql://authenticator:synthetic-api-only@127.0.0.1:55432/${dbNames.clean}`,
    PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_SERVER_PORT:'55433'},stdio:'ignore'});
  let gateway, api;
  try {
    for(let i=0;i<50;i++) {try {await fetch('http://127.0.0.1:55433/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
    const express = backend('express'); const gatewayApp = express(); gatewayApp.use(express.json());
    let adminSignouts=0;
    let corruptCheckerJoin=false;
    gatewayApp.all('/auth/v1/user', (req,res)=> {
      const token = req.headers.authorization?.slice(7);
      const id = token===tokenA ? userA : token===tokenB ? userB : null;
      if(!id) return res.status(401).json({message:'invalid token'});
      res.json({id,aud:'authenticated',email:id+'@example.test',user_metadata:req.body?.data ?? {},app_metadata:{},created_at:new Date().toISOString()});
    });
    gatewayApp.post('/auth/v1/token',(req,res)=>res.json({access_token:tokenB,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:userB,email:'b@example.test',user_metadata:{},app_metadata:{}}}));
    gatewayApp.post('/auth/v1/logout',(req,res)=> {adminSignouts++; res.status(204).end();});
    gatewayApp.use('/rest/v1',async(req,res)=> {
      const headers = {...req.headers}; delete headers.host; delete headers['content-length'];
      const response=await fetch('http://127.0.0.1:55433'+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:JSON.stringify(req.body)});
      for(const [key,value] of response.headers) if(!['content-length','content-encoding','transfer-encoding'].includes(key)) res.setHeader(key,value);
      const buffer=Buffer.from(await response.arrayBuffer());
      if(corruptCheckerJoin && req.headers.authorization==='Bearer '+serviceToken && req.method==='GET' && req.url.startsWith('/reminders')) {
        const rows=JSON.parse(buffer.toString()); for(const row of rows) if(row.tasks) row.tasks.user_id=userB;
        return res.status(response.status).json(rows);
      }
      res.status(response.status).send(buffer);
    });
    gateway=await new Promise(r=>{const s=gatewayApp.listen(55434,'127.0.0.1',()=>r(s));});
    process.env.SUPABASE_URL='http://127.0.0.1:55434'; process.env.SUPABASE_ANON_KEY=jwt('anon'); process.env.SUPABASE_SERVICE_ROLE_KEY=serviceToken;
    backend('tsx/cjs');
    const {reminderRoutes}=backend('./src/modules/reminders/reminder.routes.ts');
    const {authRoutes}=backend('./src/modules/auth/auth.routes.ts');
    const {errorHandler}=backend('./src/middleware/error.middleware.ts');
    const clients=backend('./src/database/supabase.ts');
    const app=express(); app.use(express.json()); app.use('/reminders',reminderRoutes); app.use('/auth',authRoutes); app.use(errorHandler);
    api=await new Promise(r=>{const s=app.listen(55435,'127.0.0.1',()=>r(s));});
    async function request(route,token,method='GET',body) {const r=await fetch('http://127.0.0.1:55435'+route,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
    for (const [token,own,other] of [[tokenA,taskA,taskB],[tokenB,taskB,taskA]]) {
      const created=await request('/reminders',token,'POST',{task_id:own,remind_at:new Date(Date.now()+60000).toISOString()});
      assert.equal(created.status,201,JSON.stringify(created));
      const cross=await request('/reminders',token,'POST',{task_id:other,remind_at:new Date().toISOString()});
      assert.equal(cross.status,404);
      const updated=await request('/reminders/'+created.body.id,token,'PATCH',{type:'alarm'});
      assert.equal(updated.status,200); assert.equal(updated.body.type,'alarm');
      const otherToken=token===tokenA?tokenB:tokenA;
      assert.equal((await request('/reminders/'+created.body.id,otherToken,'PATCH',{type:'notification'})).status,404);
      assert.equal((await request('/reminders/'+created.body.id,otherToken,'DELETE')).status,200);
      assert((await request('/reminders/task/'+own,token)).body.some(r=>r.id===created.body.id));
      assert.equal((await request('/reminders/'+created.body.id,token,'DELETE')).status,200);
      // Leave an upcoming reminder so concurrent-list checks cannot pass vacuously.
      assert.equal((await request('/reminders',token,'POST',{task_id:own,remind_at:new Date(Date.now()+60000).toISOString()})).status,201);
      assert.equal((await request('/reminders/task/'+other,token)).body.length,0);
    }
    const profile=await request('/auth/profile',tokenA,'PATCH',{displayName:'Account A'});
    assert.equal(profile.status,200,JSON.stringify(profile)); assert.equal(profile.body.user.id,userA); assert.equal(profile.body.user.displayName,'Account A');
    const lists=await Promise.all(Array.from({length:20},(_,i)=>request('/reminders/upcoming',i%2?tokenA:tokenB)));
    lists.forEach((r,i)=> {assert.equal(r.status,200); assert(r.body.length>0); for(const row of r.body) assert.equal(row.user_id,i%2?userA:userB);});
    // Real PostgREST embedding must remain unambiguous after replacing the FK.
    const joined=await clients.createUserClient(tokenA).from('reminders').select('*,tasks(id,user_id,title)');
    assert.equal(joined.error,null); assert(joined.data.every(r=>r.tasks.user_id===userA));
    const login=await clients.supabase.auth.signInWithPassword({email:'b@example.test',password:'synthetic-only'}); assert.equal(login.error,null);
    const anonymous=await clients.supabase.from('reminders').select('*'); assert(anonymous.error);
    await clients.runWithUserClient(clients.createUserClient(tokenA),userA,()=>clients.signOutVerifiedUser(tokenA));
    await assert.rejects(()=>clients.runWithUserClient(clients.createUserClient(tokenA),userA,()=>clients.signOutVerifiedUser(tokenB)));
    assert.equal(adminSignouts,1);
    assert.throws(()=>clients.runWithUserClient(clients.createUserClient(tokenA),userA,()=>clients.runWithSystemUser(userA,()=>{})));
    assert.throws(()=>clients.runWithUserClient(clients.createUserClient(tokenA),userA,()=>clients.createReminderCheckerClient()));
    const mismatch=await clients.runWithSystemUser(userA,()=>clients.supabase.from('notifications').insert({user_id:userB,title:'bad',body:'bad'}));
    assert(mismatch.error);
    const own=await clients.runWithSystemUser(userA,()=>clients.supabase.from('notifications').insert({user_id:userA,title:'own',body:'own'})); assert.equal(own.error,null);
    const isolated=await clients.runWithSystemUser(userB,()=>clients.supabase.from('notifications').select('*')); assert.deepEqual(isolated.data,[]);
    let tick;
    const interval=global.setInterval; global.setInterval=callback=>{tick=callback;return 0;};
    try {backend('./src/modules/reminders/reminder-checker.ts').startReminderChecker();} finally {global.setInterval=interval;}
    const sentBefore=(await clean.query('SELECT count(*)::int n FROM notifications')).rows[0].n;
    corruptCheckerJoin=true;
    const logError=console.error; let rejected=0; console.error=()=>{rejected++;};
    try {await tick();} finally {console.error=logError;corruptCheckerJoin=false;}
    assert(rejected>0); assert.equal((await clean.query('SELECT count(*)::int n FROM notifications')).rows[0].n,sentBefore);
    await tick();
    assert.equal((await clean.query(`SELECT count(*)::int n FROM reminders WHERE remind_at<=now() AND NOT is_sent`)).rows[0].n,0);
    assert((await clean.query(`SELECT count(*)::int n FROM notifications WHERE type='reminder' AND user_id='${userA}'`)).rows[0].n>0);
    console.log('PASS real Express + PostgREST own/cross API, concurrent users, FK embedding, no privileged fallback, logout scope, internal recipient scope, checker delivery');
  } finally {
    if(api) await new Promise(r=>api.close(r)); if(gateway) await new Promise(r=>gateway.close(r));
    postgrest.kill(); await clean.end(); await prior.end(); await admin.end();
  }
}
async function run() {
  const {default: EmbeddedPostgres} = await import(pathToFileURL(tools.resolve('embedded-postgres')).href);
  const pg = new EmbeddedPostgres({databaseDir:fs.mkdtempSync(path.join(tmpdir(),'t1-pg-')),user:dbConfig.user,password:dbConfig.password,port:dbConfig.port,persistent:false,onLog:()=>{},onError:console.error});
  await pg.initialise(); await pg.start();
  try { await main(); } finally { await pg.stop(); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
