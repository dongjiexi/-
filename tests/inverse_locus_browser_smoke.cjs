/* Original 2025 I Q18 via the public cloud UI; reply fixture is deliberately
 * incomplete. The local independent derivation must repair both text and graph. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async({page,context,assert,screenshot})=>{
  const q=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items.find(q=>q.id==='2025-i-18').question;let calls=0;
  const raw={title:'模型回复回放',restatement:q,answer:'尚未完成后两问',strategy:'原始模型策略',assumptions:['模型未完成的条件'],parts:[{index:1,status:'answered',answer:'椭圆为 x²/9+y²=1',steps:['模型已求出第一问']},{index:201,status:'partial',answer:'尚未完成坐标',steps:[]},{index:202,status:'partial',answer:'尚未完成最大值',steps:[]}],scene:{type:'ellipse',a:3,b:1,dynamicLine:false,points:{},constructions:[],lines:[]}};
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,installed:true,remote:true,models:['fixture-cloud']},default_model:'fixture-cloud'}}));
  await context.route('**/api/stream',r=>{calls++;return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(raw)}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
  await page.locator('#question').fill(q);await page.locator('#solveButton').click();await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete'&&!document.querySelector('#solveButton').disabled);
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last'))),record=await saved();
  assert.equal(calls,1);assert.equal(record.solution.completion.answered,3);assert(record.scene.inverseLocus);assert.equal(record.solution.parts.filter(p=>p.source==='symbolic-verified-override').length,3);
  assert.equal(record.solution.model_scene.type,'ellipse');assert.equal(record.solution.model_strategy,'原始模型策略');assert.equal(record.solution.sceneAudit.missing.length,0);assert.equal(record.solution.sceneAudit.invalid.length,0);
  assert.equal(await page.locator('#solution .katex-error').count(),0);
  await page.locator('[data-study-part="201"]').click();
  const get=()=>page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('zhigeometry:last')),s={...saved.scene,activePart:saved.activePart},f=window.DongSceneAudit.frame(s,window.DongConstruct);return{P:f.engine.resolve('inverse-locus-P'),R:f.engine.resolve('inverse-locus-R'),M:f.engine.resolve('inverse-locus-M'),active:saved.activePart};});
  let frame=await get();assert.equal(frame.active,201);assert(Math.abs(frame.P.x-3)<1e-7&&Math.abs(frame.P.y-1)<1e-7);
  // An actual mouse drag must use the plane profile and recompute R.
  await page.locator('#homeButton').click();const box=await page.locator('#canvas').boundingBox(),scale=Math.max(10.5/box.width,3.8/box.height),xy=p=>({x:box.x+box.width/2+p.x/scale,y:box.y+box.height/2-p.y/scale}),from=xy(frame.P),to=xy({x:3,y:2});
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();
  frame=await get();assert(Math.abs(frame.R.x-.5)<1e-7&&Math.abs(frame.R.y+.5)<1e-7);const planePose={...frame.P};assert(Math.abs(planePose.y-2)<1e-5,JSON.stringify(planePose));
  await page.locator('[data-study-part="202"]').click();await page.locator('#homeButton').click();
  frame=await get();assert(Math.abs(frame.P.x**2+(frame.P.y+4)**2-18)<1e-7);assert(Math.abs(frame.R.y/frame.R.x-3*frame.P.y/frame.P.x)<1e-7);
  await page.locator('[data-inspector-view="geometry"]').click();await page.locator('[data-inverse-jump="0"]').click();frame=await get();assert(Math.abs(Math.hypot(frame.P.x-frame.M.x,frame.P.y-frame.M.y)-3*(Math.sqrt(2)+Math.sqrt(3)))<1e-7);
  assert.match(await page.locator('#metrics').textContent(),/已到达最大值/);await screenshot('inverse-locus-maximum-desktop.png',null);
  await page.reload({waitUntil:'domcontentloaded'});frame=await get();assert(Math.abs(frame.P.y+4+3*Math.sqrt(6)/2)<1e-7,'Extremum position survives draft reload');
  await page.locator('[data-inspector-view="lesson"]').click();await page.locator('[data-study-part="201"]').click();frame=await get();assert(Math.hypot(frame.P.x-planePose.x,frame.P.y-planePose.y)<1e-10,'Part (i) retains its exact previous drag position');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="lesson"]').click();await page.locator('[data-study-part="202"]').click();await page.locator('[data-mobile-panel="board"]').click();await page.locator('#homeButton').click();await page.locator('#inverseDistancePanel summary').click();await page.locator('[data-inverse-board-jump="1"]').click();
  frame=await get();assert(frame.P.x>0&&frame.M.x<0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot('inverse-locus-maximum-390.png',null);
  await page.setViewportSize({width:320,height:740});await screenshot('inverse-locus-maximum-320.png',null);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
};
