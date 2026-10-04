/* Original sourced exam input. Replies are protocol fixtures, not paid-AI accuracy claims. */
module.exports=async({page,context,assert,screenshot})=>{
  const fs=require('node:fs'),path=require('node:path');
  const exam=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items.find(q=>q.id==='2023-ii-21');
  // Isolate continuation/backup protocol states on the original sourced text.
  // Production native recovery is exercised, without this fixture-only stub,
  // in vertex_secant_browser_smoke (including the captured real bad reply).
  await context.route('**/vertex-secant.js*',r=>r.fulfill({contentType:'application/javascript',body:'/* continuation state isolation only */'}));
  // Service-worker reloads may serve the production precache rather than a
  // route. Keep the isolation explicit and persistent ONLY in this test.
  await context.addInitScript(()=>Object.defineProperty(window,'DongVertexSecant',{get:()=>undefined,set:()=>{},configurable:false}));
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,installed:true,remote:true,models:['test-cloud']},default_model:'test-cloud'}}));
  const first={index:1,status:'answered',answer:'$C:\\frac{x^2}{4}-\\frac{y^2}{16}=1$',steps:['$c=2\\sqrt5,e=\\sqrt5$，所以 $a=2,b=4$。']};
  const incomplete={index:2,status:'needs_information',answer:'没有唯一的动直线，条件不足',steps:['没有确定唯一动线']};
  let requests=[],reply={title:'全国二卷分问协议回归',parts:[first,incomplete],scene:{type:'hyperbola',a:2,b:4,dynamicLine:false,points:{T:[-4,0]},lines:[{kind:'vertical',x:-4,label:'l',part:2}]}};
  let hold=false,release;
  await context.route('**/api/stream',async r=>{
    requests.push(r.request().postDataJSON());const sent=JSON.stringify(reply);
    if(hold)await new Promise(resolve=>release=resolve);
    await r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:sent}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
  await page.locator('#question').fill(exam.question);await page.locator('#solveButton').click();
  await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='partial'&&!document.querySelector('#solveButton').disabled);
  assert.equal(requests.length,1,'No automatic paid retry');
  assert.match(await page.locator('.solve-review').textContent(),/文字作答 1\/2/);
  assert.match(await page.locator('.solve-review').textContent(),/仍有缺失/);
  const previousAnswer=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution.parts[0].answer);
  await page.locator('[data-study-part="2"]').click();
  assert(await page.locator('[data-solution-continue="2"]').isVisible());
  assert.match(await page.locator('#solution').textContent(),/不代表原题缺少条件/);
  // Add a real native object and notebook metadata to ensure the pre-retry draft survives.
  await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem('zhigeometry:last'));
    saved.scene.objects.push({id:'manual-note-point',kind:'point',x:1,y:1,label:'Z',source:'user',visible:true});
    saved.solution.study={notes:'保留老师讲题笔记'};saved.solution.conversation=[{role:'user',content:'保留学生追问'}];
    localStorage.setItem('zhigeometry:last',JSON.stringify(saved));
  });
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
  await page.locator('[data-inspector-view="lesson"]').click();
  const rawScene={type:'hyperbola',a:2,b:4,dynamicLine:false,points:{T:[-4,0]},lines:[{id:'ma',kind:'through_points',a:'M',b:'A1',label:'MA₁',part:2},{id:'na',kind:'through_points',a:'N',b:'A2',label:'NA₂',part:2},{kind:'vertical',x:-1,label:'定直线',part:2}],constructions:[{id:'chord',op:'line_angle',refs:['feature:T'],angle:90,label:'l',part:2},{id:'M',op:'intersection',refs:['chord','$conic'],branch:1,label:'M',part:2},{id:'N',op:'intersection',refs:['chord','$conic'],branch:0,label:'N',part:2},{id:'P',op:'intersection',refs:['ma','na'],label:'P',part:2},{id:'MF',op:'segment',refs:['feature:M','feature:F1'],label:'MF₁',part:2}]};
  reply={title:'补全后的全国二卷解析',parts:[{...first,status:'partial',answer:'前问本次未重做'},{index:2,status:'answered',answer:'点 $P$ 在定直线 $x=-1$ 上。',steps:['设过 $(-4,0)$ 的弦为 $x=my-4$。由两个交点均在左支得 $|m|<1/2$，含竖直弦 $m=0$。','联立双曲线得 $(4m^2-1)y^2-32my+48=0$，韦达给出 $y_M+y_N=32m/(4m^2-1)$、$y_My_N=48/(4m^2-1)$。','分别联立 $MA_1$ 与 $NA_2$，将两根关系代入交点坐标，得到 $x_P=-1$，包括竖直弦情形。']}],scene:rawScene};
  hold=true;
  await page.locator('[data-solution-continue="2"]').click();
  await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='solving');
  assert(await page.locator('[data-solution-continue="2"]').isDisabled());
  for(let i=0;!release&&i<100;i++)await new Promise(r=>setTimeout(r,10));
  release();hold=false;
  await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete'&&!document.querySelector('#solveButton').disabled);
  assert.equal(requests.length,2);
  assert.equal(requests[1].text,exam.question,'Original conditions and preceding part retained');
  assert.equal(requests[1].focus_part,2);
  const data=JSON.parse(requests[1].repair_context);assert(data.diagram_issues.includes('P'));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
  assert.equal(saved.solution.parts[0].answer,previousAnswer,'A failed repeated part does not erase the previous accepted answer, including independent correction');
  assert.equal(saved.solution.study.notes,'保留老师讲题笔记');
  assert.equal(saved.solution.conversation[0].content,'保留学生追问');
  assert.equal(saved.solution.sceneAudit.invalid.length,0,JSON.stringify(saved.solution.sceneAudit));
  assert.equal(saved.solution.sceneAudit.missing.length,0,JSON.stringify(saved.solution.sceneAudit));
  assert(saved.scene.objects.some(n=>n.id==='P'&&n.op==='intersection'),JSON.stringify({scene:saved.scene,warnings:saved.solution.scene_warnings}));
  const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:lesson-backups:v1'))[0]);
  assert(backup.continuationBackup);assert(backup.scene.objects.some(n=>n.id==='manual-note-point'));
  assert(backup.solution.parts[1].status==='partial');
  assert(await page.locator('#solution .katex').count()>0);
  // A missing graph still offers continuation. Storage failure must be atomic.
  reply={...reply,parts:[first,{...incomplete,status:'partial'}],scene:null};
  await page.locator('#solveButton').click();await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='partial'&&!document.querySelector('#solveButton').disabled);
  await page.locator('[data-study-part="2"]').click();
  const before=await page.evaluate(()=>localStorage.getItem('zhigeometry:last'));
  await page.evaluate(()=>{window.__reviewSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='dongjiexi:lesson-backups:v1')throw new DOMException('quota','QuotaExceededError');return window.__reviewSetItem.call(this,key,value);};});
  await page.locator('[data-solution-continue="2"]').click();
  await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='error'&&!document.querySelector('#solveButton').disabled);
  assert.match(await page.locator('#solveProgress').textContent(),/备份失败/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('zhigeometry:last')),before);
  await page.evaluate(()=>Storage.prototype.setItem=window.__reviewSetItem);
  // Editing a question does not send stale context.
  await page.locator('#question').fill('另一题');
  const calls=requests.length;assert(await page.locator('[data-solution-continue="2"]').isDisabled());
  assert.equal(requests.length,calls);
  await page.locator('#question').fill(exam.question);
  reply={...reply,parts:[first,{index:2,status:'answered',answer:'$P$ 在定直线 $x=10$ 上。',steps:['联立得 $-3(x+2)=x-2$，解得 $x=10$。']}],scene:null};
  await page.locator('#solveButton').click();await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='partial'&&!document.querySelector('#solveButton').disabled);
  const contradicted=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution);
  assert.equal(contradicted.parts.find(p=>p.index===2).verification.status,'contradicted');
  assert(contradicted.sceneAudit.checks.some(c=>c.kind==='affine-algebra'&&c.expected===-1&&c.claimed===10));
  await page.locator('[data-study-part="2"]').click();assert.match(await page.locator('#solution').textContent(),/不能满足推导/);
  // Replay a captured real model response, not an invented positive answer.
  // Its summaries disagree with its derivation; independent modelling must
  // replace both conclusions AND the graph while retaining the raw model draft.
  const areaExam=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items.find(q=>q.id==='2024-i-16');
  reply=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/cloud-2024-i16-0520.json'),'utf8'));
  await page.locator('#question').fill(areaExam.question);await page.locator('#solveButton').click();
  await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete'&&!document.querySelector('#solveButton').disabled);
  const exact=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution);
  assert.equal(exact.parts.filter(p=>p.source==='symbolic-verified-override').length,2);
  assert.match(exact.parts[0].answer,/e=1\/2/);
  assert.match(exact.parts[1].answer,/\\frac\{1\}\{2\}x/);assert.match(exact.parts[1].answer,/\\frac\{3\}\{2\}x-3/);
  assert.equal(exact.sceneAudit.missing.length,0);assert.equal(exact.sceneAudit.invalid.length,0);assert.equal(exact.sceneAudit.missingLines.length,0);
  assert.equal(exact.scene.objects.filter(n=>n.id?.startsWith('area-candidate-')).length,2);
  assert(exact.model_scene,'The original valid model graph stays in the draft for review');
  await page.waitForFunction(()=>document.querySelector('#boardTitle .katex'));
  assert.equal(await page.locator('#boardTitle .katex-error').count(),0,'The title must not truncate inside a TeX delimiter or command');
  await page.locator('[data-study-part="2"]').click();await screenshot('cloud-sourced-area-corrected.png',null);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="lesson"]').click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await screenshot('solution-continuation-390px.png',null);
};
