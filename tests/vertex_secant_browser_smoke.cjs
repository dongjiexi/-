/* Sourced originals and captured real SSE replay; no paid requests or bank-answer dispatch. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async({page,context,assert,screenshot})=>{
  const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items;
  const exam=bank.find(q=>q.id==='2023-ii-21');let raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/cloud-2023-ii21-0520.json'),'utf8')),calls=0;
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,installed:true,remote:true,models:['captured-cloud']},default_model:'captured-cloud'}}));
  await context.route('**/api/stream',r=>{calls++;return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(raw)}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:"stop"}]})+'\n\ndata: [DONE]\n\n'});});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
  async function solve(q){await page.locator('#question').fill(q);await page.locator('#solveButton').click();await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete'&&!document.querySelector('#solveButton').disabled);return page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));}
  const saved=await solve(exam.question);
  assert.equal(calls,1);assert.equal(saved.solution.parts.filter(p=>p.source==='symbolic-verified-override').length,2);
  assert.equal(saved.solution.sceneAudit.missing.length,0);assert.equal(saved.solution.sceneAudit.invalid.length,0);
  assert.match(saved.solution.parts[1].steps.join(' '),/D<0/);assert.match(saved.solution.parts[1].steps.join(' '),/y_2<0/);
  assert(saved.solution.parts[1].model_steps.some(s=>s.includes('4t^2-1>0')),'Retain incorrect real model derivation for review');
  assert(!saved.solution.parts[1].steps.some(s=>s.includes('4t^2-1>0')),'Do not retain a false branch inference as verified proof');
  assert(saved.solution.model_scene_warnings.length,'Retain rejection of the malformed raw graph for review');
  assert.equal(saved.solution.scene_warnings.length,0,'Rejected and replaced raw graph is not the current graph');
  assert.equal(saved.solution.sceneAudit.missingLines.length,0,'Indexed endpoints are not truncated into a different line name');
  assert.equal(saved.solution.sceneAudit.answerMissingLines.length,0);
  assert.equal(saved.scene.vertexSecant.fixedX,-1);assert(!Object.hasOwn(saved.scene.points,'P'),'The dependent P is not frozen at the unnamed given point');
  await page.locator('[data-study-part="2"]').click();await page.locator('#homeButton').click();
  const scene=()=>page.locator('#sceneJson').inputValue().then(JSON.parse);
  const get=async()=>page.evaluate(s=>{const f=window.DongSceneAudit.frame(s,window.DongConstruct);return{features:f.features,M:f.engine.resolve('vertex-secant-M'),N:f.engine.resolve('vertex-secant-N'),P:f.engine.resolve('vertex-secant-P')};},await scene());
  let initial=await get();assert(Math.abs(initial.M.y-4*Math.sqrt(3))<1e-7);assert(Math.abs(initial.P.y+2*Math.sqrt(3))<1e-7);
  const box=await page.locator('#canvas').boundingBox(),m=await scene();let rx=m.a*1.75,ry=m.b*1.9;
  for(const q of [...initial.features,initial.M,initial.N,initial.P]){rx=Math.max(rx,Math.abs(q.x)*1.18);ry=Math.max(ry,Math.abs(q.y)*1.18);}
  const scale=Math.max(2*rx/box.width,2*ry/box.height),xy=p=>({x:box.x+box.width/2+p.x/scale,y:box.y+box.height/2-p.y/scale});
  const target={x:-2*Math.cosh(1.5),y:4*Math.sinh(1.5)},a=xy(initial.M),b=xy(target);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
  const changed=await get();assert(Math.abs(changed.M.y-initial.M.y)>.2,'Actual mouse drag changes the driver');
  assert(changed.M.x<0&&changed.M.y>0&&changed.N.x<0&&changed.N.y<0);assert(Math.abs(changed.P.x+1)<1e-6);
  assert(Math.abs(changed.N.y-initial.N.y)>.1&&Math.abs(changed.P.y-initial.P.y)>.1,'Dependent endpoint and intersection follow the drag');
  assert.equal(await page.locator('#solution .katex-error').count(),0);
  await page.locator('#homeButton').click();await screenshot('vertex-secant-linked-desktop.png',null);
  assert.match(await page.locator('.solve-review').textContent(),/未发现已覆盖项缺失/);
  await page.reload({waitUntil:'domcontentloaded'});const restored=await get();assert(Math.abs(restored.P.y-changed.P.y)<1e-7,'Reload preserves linked driver');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="board"]').click();await page.locator('[data-study-part="2"]').evaluate(e=>e.click());await page.locator('#homeButton').click();
  await screenshot('vertex-secant-linked-390.png',null);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // Named candidates must not receive redundant J aliases on the sourced area graph.
  await page.setViewportSize({width:1600,height:1050});raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/cloud-2024-i16-0520.json'),'utf8'));
  const area=await solve(bank.find(q=>q.id==='2024-i-16').question);await page.locator('[data-study-part="2"]').click();await page.locator('#homeButton').click();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const labels=await page.evaluate(()=>window.DongBoardLabels.snapshot());
  for(const name of ['P','B1','B2'])assert(labels.placements.some(p=>p.names.includes(name)),`Named candidate ${name} is visible`);
  for(const p of labels.placements)if(p.names.some(n=>['P','B1','B2'].includes(n)))assert(!p.names.some(n=>/^J\d+$/.test(n)),`No redundant automatic alias at ${p.text}`);
  assert.equal(calls,2);assert.equal(area.solution.sceneAudit.invalid.length,0);await screenshot('area-named-intersections-clean.png',null);
  const augmented=await scene();augmented.objects.push({id:'manual-same-P',kind:'point',label:'Z',x:3,y:1.5,source:'user',visible:true},{id:'manual-near-P',kind:'point',label:'W',x:3.00001,y:1.5,source:'user',visible:true});
  augmented.lines.push({id:'manual-anonymous-intersections',kind:'slope',m:0,b:1,label:'测试手动线',source:'user',visible:true});
  const apply=async s=>{await page.locator('#sceneJson').evaluate((e,json)=>{e.value=json;document.querySelector('#applyJson').click();},JSON.stringify(s));await page.locator('#homeButton').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return page.evaluate(()=>window.DongBoardLabels.snapshot());};
  const augmentedLabels=await apply(augmented);
  for(const name of ['P','Z','W'])assert(augmentedLabels.placements.some(p=>p.names.includes(name)),`Manual alias or neighbouring point ${name} is preserved`);
  assert(augmentedLabels.placements.some(p=>p.names.some(n=>/^J\d+$/.test(n))),'Previously unnamed intersections still receive automatic labels');
  const after=await scene();assert.equal(after.objects.find(o=>o.id==='manual-near-P').x,3.00001,'Label avoidance does not alter coordinates');
  after.objects.find(o=>o.label==='B1').visible=false;const hiddenLabels=await apply(after);
  assert(!hiddenLabels.placements.some(p=>p.names.includes('B1')),'Hidden named point is not drawn');
  assert(hiddenLabels.placements.some(p=>p.names.some(n=>/^J\d+$/.test(n))&&Math.hypot(p.worldX+3,p.worldY+1.5)<1e-7),'A hidden candidate must not hide a distinct visible line intersection');
};
