const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
class D1{constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(fs.readFileSync(path.join(__dirname,'../deploy/cloudflare/schema.sql'),'utf8'));}prepare(sql){const db=this.db;return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}};}}
(async()=>{
  const questionParts=require('../dist/question-parts.js');
  const {merge,inspectParts}=require('../dist/recognition-pages.js');
  const {inspect}=require('../dist/recognition-review.js');
  const {raw,checked}=require('./fixtures/ocr-math-review.json');
  const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items;
  const source=bank.find(q=>q.id==='2022-ii-21-1').question;
  assert.deepEqual(inspect(raw).map(({kind,start,end})=>[kind,raw.slice(start,end)]),[
    ['polygon','A4BC'],['segment','4C'],['angle','ZC=90"'],['vector','1 PA-PB'],['choices','SC 44 D. [4,6]']
  ]);
  assert.deepEqual(inspect(checked),[]);
  for(const item of bank)assert.deepEqual(inspect(item.question),[],item.id+' intact exam text');
  for(const intact of [
    '点 F1(2,0)，取点 P_1 使得 x²/4+y²=1。',
    '△ABC 中，设 4C=3，已知 BC=4，求 |AB-CD|。',
    '求向量 AB-CD 与向量 AC 的数量积。',
    '方程 x²/\n4+y²/2=1。',
    '题目的结论为（ ）\nA. 否 B. 是 C. 仅正数 D. 任意\n11. 已知直线，求交点。'
  ])assert.deepEqual(inspect(intact),[],intact);
  const selection=(value,kind)=>inspect(value).filter(f=>f.kind===kind).map(f=>value.slice(f.start,f.end));
  assert.deepEqual(selection('定点 0(0,0)，过点 1A。','point'),['0','1A']);
  assert.deepEqual(selection('数量积：PA-PB','vector'),['PA-PB']);
  assert.deepEqual(selection('C：x²\r\n4\r\n+y²=1，或 $\\dfrac{x^2}{}$','fraction'),['x²\r\n4','\\dfrac{x^2}{}']);
  assert.deepEqual(selection('结果是（ ）\nB. 1 A. 2 C. 3 D. 4','choices'),['B. 1 A. 2 C. 3 D. 4']);
  assert.deepEqual(inspect('定点 0(0,0)。'.repeat(2000)),[],'Reject oversized review input');
  const first=source.indexOf('\n（1）'),second=source.indexOf('\n（2）');
  const setup=source.slice(0,first),page1=source.slice(0,second),page2=source.slice(second).trimStart();
  assert.deepEqual(merge([page1,'数学试题 第 2 页（共 2 页）\n'+setup+'\n'+page2]),{text:source,removed:1});
  assert.deepEqual(merge([page1,page1+'\n'+page2]),{text:source,removed:1});
  const changed=merge([page1,setup.replace('F(2,0)','F(3,0)')+'\n'+page2]).text;
  assert(changed.includes('F(2,0)')&&changed.includes('F(3,0)'), 'Conflicting conditions remain reviewable');
  assert.match(inspectParts(merge([page1,'（1）求椭圆方程。']).text).message,/重复小问编号/);
  assert.equal(inspectParts(merge([page2,page1]).text).blocking,false);
  assert.match(inspectParts(source.replace('（2）','（3）')).message,/跳号/);
  const wrapped=merge(['已知椭圆 C：$x^2/4','数学试题 第 2 页（共 2 页）\n+y^2/2=1$。\n（1）求焦点。']);
  assert.equal(wrapped.text,'已知椭圆 C：$x^2/4 +y^2/2=1$。\n（1）求焦点。');
  assert.deepEqual(questionParts.splitParts(wrapped.text).map(part=>part.index),[1]);
  assert.throws(()=>merge(['甲'.repeat(12000),'乙'.repeat(12000)]),/18000/);
  const {recognitionResult,validateImage,VISION_SYSTEM,IMAGE_LIMIT}=await import('../dist/recognition-contract.mjs');
  const {modelPayload,createHandler}=await import('../deploy/cloudflare/worker.mjs');
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1kAAAAASUVORK5CYII=';
  assert.equal(validateImage(png),png);
  for(const invalid of ['https://attacker.invalid/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,'+png.split(',')[1],png+'?',png.slice(0,-1),'data:image/png;base64,'+'A'.repeat(Math.ceil(IMAGE_LIMIT/3)*4+4)])assert.throws(()=>validateImage(invalid));
  assert.match(VISION_SYSTEM,/不.*猜/);assert.match(VISION_SYSTEM,/向量箭头/);
  const payload=modelPayload({kind:'recognize',image:png,model:'deepseek-flash'},{});
  assert.equal(payload.messages[1].content[1].type,'image_url');assert.equal(payload.messages[1].content[1].image_url.detail,'original');assert.equal(payload.stream,true);
  assert.equal(payload.thinking.type,'disabled');assert.equal(payload.response_format.type,'json_object');
  assert.throws(()=>modelPayload({kind:'recognize',image:png,model:'deepseek-v4-pro'},{}));
  assert.throws(()=>modelPayload({kind:'recognize',image:png,model:'deepseek-flash'},{DONGJIEXI_ALLOWED_MODELS:'deepseek-v4-pro'}));
  const text='（1）求方程；（2）若 $\\overrightarrow{PM}\\cdot\\overrightarrow{PN}$ 为定值；（3）二面角 $\\frac{2\\pi}{3}$。';
  assert.deepEqual(recognitionResult({text,uncertainties:[]}).uncertainties,[]);assert.equal(recognitionResult({text}).text,text);
  for(const invalid of [{text:''},{text:'x'.repeat(18001)},[],{text,uncertainties:'x'},{text,uncertainties:[{}]},{text,uncertainties:Array(31).fill('x')}])assert.throws(()=>recognitionResult(invalid));
  const env={DB:new D1(),SESSION_SECRET:'fixture-signing-secret-at-least-thirty-two-characters',DONGJIEXI_ACCESS_KEY:'fixture',DONGJIEXI_MODEL_API_KEY:'private-fixture',DONGJIEXI_DAILY_JOBS:'1'};
  let calls=0,pending=[];const ctx={waitUntil(p){pending.push(p);}};
  const handler=createHandler(async(url,init)=>{assert.equal(init.headers.Authorization,'Bearer private-fixture');if(url.endsWith('/models'))return Response.json({data:[{id:'deepseek-flash'}]});calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(JSON.parse(init.body).messages[1].content[1].image_url.url,png);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});});
  const req=(route,data,token='')=>new Request('https://fixture.workers.dev'+route,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://dongjiexi.github.io',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const token=(await (await handler(req('/api/session',{access_key:'fixture'}),env,ctx)).json()).token;
  const health=await (await handler(req('/api/health',undefined,token),env,ctx)).json();assert.equal(health.engine.vision,true);assert.equal(health.engine.vision_model,'deepseek-flash');
  const input={kind:'recognize',image:png,model:'deepseek-flash'};
  assert.equal((await handler(req('/api/recognize',input),env,ctx)).status,401);
  assert.equal((await handler(req('/api/stream',input,token),env,ctx)).status,400);
  assert.equal((await handler(req('/api/recognize',{kind:'solve',text:'fixture',model:'deepseek-flash'},token),env,ctx)).status,400);
  assert.equal((await handler(req('/api/recognize',{...input,image:'https://private.invalid'},token),env,ctx)).status,400);
  assert.equal((await handler(req('/api/recognize',{...input,image:'x'.repeat(3*1024*1024)},token),env,ctx)).status,413);assert.equal(calls,0);
  const result=await handler(req('/api/recognize',input,token),env,ctx);assert.equal(result.status,200);await result.text();await Promise.all(pending);
  assert.equal(calls,1);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM leases').get().n,0);
  assert.equal((await handler(req('/api/stream',{kind:'solve',text:'fixture',model:'deepseek-flash'},token),env,ctx)).status,429,'Vision and solve share the existing daily budget');
  env.DB.db.close();console.log('PASS image signature/size, Flash-only multimodal payload, transcription contract, protected endpoint and shared quotas');
})().catch(error=>{console.error(error);process.exitCode=1;});
