const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
class D1{
  constructor(){this.reads=0;this.db=new DatabaseSync(':memory:');this.db.exec(fs.readFileSync(path.join(__dirname,'../deploy/cloudflare/schema.sql'),'utf8'));}
  prepare(sql){const owner=this;return{bind(...args){return{async first(){owner.reads++;return owner.db.prepare(sql).get(...args)||null;},async run(){return owner.db.prepare(sql).run(...args);}};}};}
}
(async()=>{
  const {createHandler}=await import('../deploy/cloudflare/worker.mjs');
  const {adminUsage}=await import('../deploy/cloudflare/usage-guard.mjs');
  const env={DB:new D1(),SESSION_SECRET:'session-only-fixture-secret-more-than-thirty-two-characters',DONGJIEXI_ACCESS_KEY:'fixture-access',DONGJIEXI_MODEL_API_KEY:'fixture-model-key',DONGJIEXI_ADMIN_TOKEN:'admin-only-fixture-secret-more-than-thirty-two-characters',DONGJIEXI_DAILY_JOBS:'10'};
  let upstreamCalls=0;const pending=[];
  const handler=createHandler(async()=>{upstreamCalls++;return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});});
  const ctx={waitUntil(p){pending.push(p);}};
  const request=(route,{token='',method='GET',body,origin='https://dongjiexi.github.io'}={})=>new Request('https://fixture.workers.dev'+route,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.66',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const admin=()=>request('/api/admin/usage',{token:env.DONGJIEXI_ADMIN_TOKEN});
  const dailyKey='global-day:'+Math.floor(Date.now()/86400000);
  env.DB.db.prepare('INSERT INTO counters VALUES (?, ?, ?)').run(dailyKey,3,9999999999);
  env.DB.db.prepare('INSERT INTO counters VALUES (?, ?, ?)').run('ip-hour:private-hashed-visitor:old',123,9999999999);
  env.DB.db.exec("INSERT INTO leases VALUES ('active-secret-id',9999999999),('expired-secret-id',1)");
  const beforeReads=env.DB.reads;
  for(const token of ['',env.DONGJIEXI_ACCESS_KEY,env.DONGJIEXI_MODEL_API_KEY,env.SESSION_SECRET,env.DONGJIEXI_ADMIN_TOKEN+'x','x'.repeat(600)])assert.equal((await handler(request('/api/admin/usage',{token}),env,ctx)).status,404);
  assert.equal(env.DB.reads,beforeReads,'Unauthorized callers cannot inspect counters or leases');
  assert.equal(await adminUsage(admin(),{...env,DONGJIEXI_ADMIN_TOKEN:undefined}),null);
  for(const credential of [env.SESSION_SECRET,'long-reused-model-secret-more-than-thirty-two-characters']){
    const reused={...env,DONGJIEXI_ADMIN_TOKEN:credential,DONGJIEXI_MODEL_API_KEY:credential};
    assert.equal(await adminUsage(request('/api/admin/usage',{token:credential}),reused),null,'Reusing a model/session/access secret for administration fails closed');
  }
  let response=await handler(admin(),env,ctx);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  let text=await response.text(),report=JSON.parse(text);
  assert.equal(report.usage.state,'normal');assert.equal(report.usage.used,3);assert.equal(report.usage.maximum,10);assert.equal(report.usage.remaining,7);assert.equal(report.usage.warning_at,8);assert.equal(report.usage.active_leases,1);assert.deepEqual(report.alerts,[]);
  for(const privateValue of [env.SESSION_SECRET,env.DONGJIEXI_MODEL_API_KEY,env.DONGJIEXI_ACCESS_KEY,env.DONGJIEXI_ADMIN_TOKEN,'private-hashed-visitor','active-secret-id','expired-secret-id'])assert(!text.includes(privateValue),'Aggregate report does not include credentials or client/lease IDs');
  assert.equal(upstreamCalls,0,'Private monitoring does not request models or inference');
  env.DB.db.prepare('UPDATE counters SET count=8 WHERE id=?').run(dailyKey);
  report=await adminUsage(admin(),env);assert.equal(report.usage.state,'warning');assert.equal(report.alerts[0].code,'DAILY_ADMISSION_WARNING');
  env.DB.db.prepare('UPDATE counters SET count=10 WHERE id=?').run(dailyKey);
  report=await adminUsage(admin(),env);assert.equal(report.usage.state,'exhausted');assert.equal(report.usage.remaining,0);assert.equal(report.alerts[0].code,'DAILY_ADMISSION_EXHAUSTED');
  report=await adminUsage(admin(),env,Date.now()+86400000);assert.equal(report.usage.used,0,'UTC reset looks up the new day, not cumulative old counters');assert.equal(report.usage.state,'normal');
  assert.equal((await adminUsage(admin(),{...env,DONGJIEXI_USAGE_WARNING_PERCENT:'50'})).usage.warning_at,5);
  assert.equal((await adminUsage(admin(),{...env,DONGJIEXI_USAGE_WARNING_PERCENT:'invalid'})).usage.warning_percent,80);
  assert.equal((await adminUsage(admin(),{...env,DONGJIEXI_DAILY_JOBS:'9999'})).usage.maximum,200,'Monitoring reports the enforced existing maximum');
  assert.equal((await handler(request('/api/admin/usage',{token:env.DONGJIEXI_ADMIN_TOKEN,origin:'https://attacker.invalid'}),env,ctx)).status,403);
  assert.equal((await handler(request('/api/admin/usage',{token:env.DONGJIEXI_ADMIN_TOKEN,method:'POST',body:{}}),env,ctx)).status,404,'Read-only admin route cannot mutate counters');
  const login=await handler(request('/api/session',{method:'POST',body:{access_key:env.DONGJIEXI_ACCESS_KEY}}),env,ctx);const {token}=await login.json();
  assert.equal((await handler(request('/api/admin/usage',{token}),env,ctx)).status,404,'A valid solve session is not an admin credential');
  env.DONGJIEXI_INFERENCE_PAUSED=' TRUE ';
  const health=await (await handler(request('/api/health',{token}),env,ctx)).json();
  assert.equal(health.engine.available,false);assert.equal(health.engine.health_status,'paused');assert.equal(health.engine.error_code,'INFERENCE_PAUSED');assert.equal(upstreamCalls,0);
  const beforePause=env.DB.db.prepare('SELECT * FROM counters ORDER BY id').all();
  for(const route of ['/api/stream','/api/recognize']){
    response=await handler(request(route,{token,method:'POST',body:{}}),env,ctx);
    assert.equal(response.status,503);assert.equal(response.headers.get('Retry-After'),'60');assert((await response.json()).error.includes('管理员已暂时暂停'));
  }
  assert.deepEqual(env.DB.db.prepare('SELECT * FROM counters ORDER BY id').all(),beforePause,'Paused inference does not spend quotas');assert.equal(upstreamCalls,0);
  assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM leases').get().n,2,'Paused inference does not acquire leases or affect in-flight work');
  report=await adminUsage(admin(),env);assert(report.inference_paused);assert.equal(report.alerts[0].code,'INFERENCE_PAUSED');
  env.DONGJIEXI_INFERENCE_PAUSED='false';env.DB.db.exec('DELETE FROM leases');env.DB.db.prepare('UPDATE counters SET count=8 WHERE id=?').run(dailyKey);
  response=await handler(request('/api/stream',{token,method:'POST',body:{kind:'solve',text:'求椭圆 x²/4+y²=1 的离心率。',model:'deepseek-flash'}}),env,ctx);
  assert.equal(response.status,200);await response.text();await Promise.all(pending);assert.equal(upstreamCalls,1);
  assert.equal((await adminUsage(admin(),env)).usage.used,9,'Resume retains counters and uses the original admission flow');
  env.DB.db.close();
  console.log('PASS private aggregate usage: independent admin auth, no secret/client leakage, UTC threshold states, inference pause without billing or quota mutations, and safe resume');
})().catch(error=>{console.error(error);process.exitCode=1;});
