/* Sourced originals; incomplete replies test independent answer/scene recovery. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async({page,context,assert,screenshot})=>{
 const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items;let question='',calls=0,parts=1;
 await context.addInitScript(()=>{
  let learning;
  Object.defineProperty(window,'DongLearning',{configurable:true,get:()=>learning,set:value=>{
   learning=value;const attach=value.attach;
   value.attach=api=>{window.__conditionApi=api;return attach(api);};
  }});
 });
 await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
 await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,remote:true,models:['fixture-cloud']}}}));
 await context.route('**/api/stream',r=>{calls++;const raw={title:'未完成模型回复',restatement:question,strategy:'原模型待解策略',parts:Array.from({length:parts},(_,i)=>({index:parts===1?0:i+1,status:'partial',answer:'尚未求解',steps:['尚未推导。']})),scene:{type:'ellipse',a:3,b:1,points:{},lines:question.includes('OMA')?[{id:'wrong-cloud-line',kind:'slope',m:0,b:9,label:'云端错误线'}]:[],constructions:[]}};return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(raw)}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
 for(const id of ['2022-beijing-3','2025-beijing-11','2025-beijing-19-1','2025-ii-16']){
  question=bank.find(q=>q.id===id).question;parts=['2025-beijing-19-1','2025-ii-16'].includes(id)?2:1;await page.locator('#question').fill(question);await page.locator('#solveButton').click();await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete'&&!document.querySelector('#solveButton').disabled);
  const r=await read();assert.equal(r.solution.restatement,question);assert.equal(r.solution.completion.answered,parts);assert(r.solution.parts.every(p=>p.source==='symbolic-verified-override'));assert.equal(r.solution.model_strategy,'原模型待解策略');assert.equal(r.solution.model_scene.a,3);
  assert.equal(await page.locator('#solution .katex-error').count(),0);for(const k of ['missing','answerMissing','missingLines','answerMissingLines','invalid','missingPolygons'])assert.equal(r.solution.sceneAudit[k].length,0,k);
  if(id==='2022-beijing-3'){assert.equal(r.scene.type,'circle');assert.equal(r.scene.h,.5);assert(r.scene.lines.some(l=>l.label==='对称轴'));}
  if(id==='2025-beijing-11'){assert.equal(r.scene.p,3);assert.match(r.solution.parts[0].answer,/p=6/);}
  if(id==='2025-beijing-19-1'){
   assert.equal(r.scene.objects.filter(n=>n.op==='tangent').length,1);
   assert(r.scene.lines.every(line=>line.b!==9),'Replace the incomplete cloud scene even when it contains its own line');
   const labels=()=>page.evaluate(()=>window.DongBoardLabels.snapshot().placements.flatMap(n=>n.names||[]));
   await page.locator('[data-study-part="1"]').click();
   assert(!(await labels()).includes('M'));assert.doesNotMatch(await page.locator('#metrics').textContent(),/距离比/);
   await page.locator('[data-study-part="2"]').click();await page.locator('#homeButton').click();
   const readGeometry=()=>page.evaluate(()=>{
    const api=window.__conditionApi,scene=api.sceneData(),engine=window.DongSceneAudit.frame(scene,window.DongConstruct).engine;
    const point=id=>engine.resolve('tangent-ratio-'+id);
    return{view:api.state.view,M:point('driver'),A:point('upper-point'),B:point('lower-point'),H:point('foot')};
   });
   const before=await readGeometry(),{view:v}=before,box=await page.locator('#canvas').boundingBox();
   const xy=p=>({x:box.x+(p.x-v.xmin)/(v.xmax-v.xmin)*box.width,y:box.y+(v.ymax-p.y)/(v.ymax-v.ymin)*box.height});
   const drag=async(from,to)=>{
    const p=xy(from),q=xy(to);
    await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:10});await page.mouse.up();
   };
   await drag(before.M,{x:1.6,y:-.8});
   const moved=await readGeometry();
   for(const key of ['M','A','B','H'])assert.notDeepEqual(moved[key],before[key],key+' follows the dragged contact point');
   const {M,A,B,H}=moved,near=(a,b)=>assert(Math.abs(a-b)<1e-7,a+' ≠ '+b);
   near(M.x**2/4+M.y**2/2,1);near(A.y,2);near(B.y,-2);
   for(const P of [A,B,H])near(M.x*P.x/4+M.y*P.y/2,1);
   const det=P=>Math.abs(M.x*P.y-M.y*P.x);
   near(det(A)/det(B),Math.hypot(A.x,A.y)/Math.hypot(B.x,B.y));
   assert.match(await page.locator('#metrics').textContent(),/面积比 S1\/S2.*距离比 \|OA\|\/\|OB\|/s);
   await screenshot('ellipse-tangent-ratio-desktop.png',null);
   await drag(M,{x:0,y:Math.SQRT2});
   assert(Math.abs((await readGeometry()).M.x)>1e-7,'The excluded y-axis point never becomes the contact point');
   await page.locator('[data-study-part="1"]').click();
   assert(!(await labels()).includes('M'));assert.doesNotMatch(await page.locator('#metrics').textContent(),/距离比/);
   await page.locator('[data-study-part="2"]').click();
   for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    await page.locator('[data-mobile-panel="board"]').click();await page.locator('#homeButton').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.match(await page.locator('#metrics').textContent(),/距离比/);
    await screenshot('ellipse-tangent-ratio-'+width+'.png',null);
   }
   await page.setViewportSize({width:1600,height:1050});
  }
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
