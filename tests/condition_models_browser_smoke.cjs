/* Sourced originals; incomplete replies test independent answer/scene recovery. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async({page,context,assert,screenshot})=>{
 const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items;let question='',calls=0,parts=1;
 await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
 await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,remote:true,models:['fixture-cloud']}}}));
 await context.route('**/api/stream',r=>{calls++;const raw={title:'未完成模型回复',restatement:question,strategy:'原模型待解策略',parts:Array.from({length:parts},(_,i)=>({index:parts===1?0:i+1,status:'partial',answer:'尚未求解',steps:['尚未推导。']})),scene:{type:'ellipse',a:3,b:1,points:{},lines:[],constructions:[]}};return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(raw)}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
 for(const id of ['2022-beijing-3','2025-beijing-11','2025-beijing-19-1','2025-ii-16']){
  question=bank.find(q=>q.id===id).question;parts=id==='2025-ii-16'?2:1;await page.locator('#question').fill(question);await page.locator('#solveButton').click();await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete'&&!document.querySelector('#solveButton').disabled);
  const r=await read();assert.equal(r.solution.restatement,question);assert.equal(r.solution.completion.answered,parts);assert(r.solution.parts.every(p=>p.source==='symbolic-verified-override'));assert.equal(r.solution.model_strategy,'原模型待解策略');assert.equal(r.solution.model_scene.a,3);
  assert.equal(await page.locator('#solution .katex-error').count(),0);for(const k of ['missing','answerMissing','missingLines','answerMissingLines','invalid','missingPolygons'])assert.equal(r.solution.sceneAudit[k].length,0,k);
  if(id==='2022-beijing-3'){assert.equal(r.scene.type,'circle');assert.equal(r.scene.h,.5);assert(r.scene.lines.some(l=>l.label==='对称轴'));}
  if(id==='2025-beijing-11'){assert.equal(r.scene.p,3);assert.match(r.solution.parts[0].answer,/p=6/);}
 }
 assert.equal(calls,4);await page.locator('[data-study-part="2"]').click();await page.locator('#homeButton').click();await page.locator('#areaChordPanel summary').click();assert.match(await page.locator('#areaChordReadout').textContent(),/面积条件已保持/);
 assert.match(await page.locator('#metrics').textContent(),/△OAB · 面积/);assert.doesNotMatch(await page.locator('#metrics').textContent(),/暂未定位/,'Native A/B triangle is not suppressed by the hidden legacy chord');
 const geometry=()=>page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('zhigeometry:last')),f=window.DongSceneAudit.frame({...r.scene,activePart:r.activePart},window.DongConstruct);return{scene:r.scene,A:f.engine.resolve('area-chord-A'),B:f.engine.resolve('area-chord-B')};});
 let old=await geometry();await page.locator('[data-area-chord-choice="1"]').click();let now=await geometry();assert(Math.abs(now.A.x+old.B.x)<1e-7);assert(Math.abs(now.B.x+old.A.x)<1e-7);assert(Math.abs(Math.hypot(now.A.x-now.B.x,now.A.y-now.B.y)-Math.sqrt(5))<1e-7);
 await page.locator('[data-study-part="1"]').click();assert(!await page.locator('#areaChordPanel').isVisible());await page.locator('[data-study-part="2"]').click();assert.deepEqual((await geometry()).A,now.A);
 await screenshot('area-chord-desktop.png',null);await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-inspector-view="lesson"]').click();await page.locator('[data-study-part="2"]').click();assert.deepEqual((await geometry()).A,now.A);
 await page.locator('#unrestrictedMove').click();assert.match(await page.locator('#areaChordReadout').textContent(),/自由探索/);await page.locator('#unrestrictedMove').click();assert.match(await page.locator('#areaChordReadout').textContent(),/面积条件已保持/);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.locator('[data-mobile-panel="board"]').click();await page.locator('#homeButton').click();if(!await page.locator('#areaChordPanel').evaluate(e=>e.open))await page.locator('#areaChordPanel summary').click();await page.locator('[data-area-chord-choice="0"]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot('area-chord-'+width+'.png',null);}
 await page.locator('#areaChordPanel summary').click();assert(!await page.locator('#areaChordPanel').evaluate(e=>e.open));
};
