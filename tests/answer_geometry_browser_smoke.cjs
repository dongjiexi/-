module.exports=async({page,context,assert,screenshot})=>{
  const fs=require('node:fs'),path=require('node:path');
  const input=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/sourced-exam-additions.json'),'utf8')).items.find(n=>n.id==='2022-beijing-10');
  await page.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of await caches.keys())await caches.delete(k);});
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',default_model:'test-cloud',capabilities:{transport:'sse'},engine:{available:true,remote:true,models:['test-cloud']}}}));
  // Original 2022 Beijing question; explicit reply fixtures exercise integration,
  // not a paid model call, automatic proof, or new production lookup answer.
  let answer={title:'原卷题答案构造协议回归',parts:[{index:0,status:'answered',answer:'$[-4,6]$',steps:['取C为原点、A(3,0)、B(0,4)，由PC=1知P在单位圆上。','设N为AB的中点。点P到直线AB的垂足为H，连接PH。作点P处的切线。','向量数量积等于 $1-3x-4y$，由 $x^2+y^2=1$ 得范围 $[-4,6]$。观察△PAB。']}],scene:{type:'circle',h:0,k:0,r:1,dynamicLine:false,points:{A:[3,0],B:[0,4],C:[0,0]},curvePoints:[{name:'P',t:.9}]}};
  await context.route('**/api/stream',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(answer)}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'}));
  await page.evaluate(()=>localStorage.setItem('dongjiexi:solve-mode:v1','cloud'));await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#engineStatus').classList.contains('ready'));
  await page.locator('#question').fill(input.question);await page.locator('#solveButton').click();
  await page.waitForFunction(()=>!document.querySelector('#solveButton').disabled&&document.querySelector('#solution').textContent.includes('原卷题答案构造协议回归'));
  const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution);
  assert(result.scene.objects.some(n=>n.label==='N'&&n.op==='midpoint'));
  assert(result.scene.objects.some(n=>n.label==='H'&&n.op==='foot'));
  assert(result.scene.objects.some(n=>n.label==='P 点切线'&&n.op==='tangent'));
  assert(result.scene.objects.some(n=>n.label==='PH'&&n.op==='segment'));
  assert(result.scene.polygons.some(n=>n.label==='△PAB'));
  assert.equal(result.sceneAudit.answerMissing.length,0,JSON.stringify(result.sceneAudit));
  assert.equal(result.sceneAudit.answerMissingLines.length,0);
  assert.equal(result.sceneAudit.invalid.length,0);
  assert(!await page.locator('.geometry-notice').isVisible());
  const visibleLabels=await page.evaluate(()=>window.DongBoardLabels.snapshot().placements.flatMap(n=>n.names||[]));
  for(const name of ['A','B','P','N','H'])assert(visibleLabels.includes(name),'Auto-fit must display '+name+', not crop it outside the conic-only viewport');
  await page.locator('.diagram-audit summary').click();
  assert.match(await page.locator('.diagram-audit').textContent(),/切点在曲线上/);
  await page.locator('[data-step-graph-index="1"]').click();
  assert.match(await page.locator('[data-step-graph-status]').textContent(),/高亮/);
  await screenshot('answer-auxiliary-point-foot-tangent.png',null);
  answer.parts[0].steps.push('作 $\\angle ACB$ 的内角平分线，与对边 AB 交于点 T。');
  await page.locator('#solveButton').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution?.scene?.objects?.some(n=>n.op==='angle_bisector'));
  const savedSolution=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution);
  function bisectorConstruction(scene){
    const dividers=scene.objects.filter(n=>n.op==='angle_bisector');
    const [divider]=dividers;
    assert.equal(dividers.length,1,'The answer should produce one angle bisector');
    const onSide=scene.objects.find(n=>n.label==='T');
    assert.deepEqual(divider.refs,['feature:A','feature:C','feature:B']);
    assert.equal(onSide?.op,'intersection','The named point must follow its construction');
    assert(onSide.refs.includes(divider.id));
    const side=scene.objects.find(n=>n.id===onSide.refs.find(id=>id!==divider.id));
    assert.equal(side?.op,'segment','The equality is conditioned on the opposite side, not its extension');
    assert.deepEqual([...side.refs].sort(),['feature:A','feature:B']);
    assert.deepEqual(onSide.parts,[0]);
    return onSide;
  }
  bisectorConstruction((await savedSolution()).scene);
  const steps=answer.parts[0].steps;
  const equality='取点T在线段AB上，使得 $\\angle ACT=\\angle TCB$。';
  steps[steps.length-1]=equality;
  await page.locator('#solveButton').click();
  await page.waitForFunction(()=>{
    const solution=JSON.parse(localStorage.getItem('zhigeometry:last'))?.solution;
    const part=solution?.parts[0];
    return !document.querySelector('#solveButton').disabled&&[...(part?.steps||[]),...(part?.model_steps||[])].some(step=>step.includes('取点T在线段AB上'));
  });
  const equalAngles=await savedSolution();
  const point=bisectorConstruction(equalAngles.scene);
  assert.equal(equalAngles.sceneAudit.answerMissing.length,0,JSON.stringify(equalAngles.sceneAudit));
  assert.equal(equalAngles.sceneAudit.invalid.length,0,JSON.stringify(equalAngles.sceneAudit));
  assert(!await page.locator('.geometry-notice').isVisible());
  // This sourced question independently verifies the displayed solution and
  // keeps the fixture text in model_steps. Select against its applied diagram.
  const highlighted=await page.evaluate(equality=>{
    const scene=JSON.parse(document.querySelector('#sceneJson').value),entries=scene.objects.map(n=>({id:n.id,label:n.label,angleSideParents:n.angleSide?n.refs:undefined}));
    return window.DongStepHighlight.select(equality,entries).ids;
  },equality);
  assert([point.id,...point.refs].every(id=>highlighted.includes(id)));

  const resolved=()=>page.locator('#sceneJson').evaluate((element,id)=>{
    const scene=JSON.parse(element.value);
    const {engine}=window.DongSceneAudit.frame(scene,window.DongConstruct);
    return {a:engine.resolve('feature:A'),b:engine.resolve('feature:B'),c:engine.resolve('feature:C'),t:engine.resolve(id)};
  },point.id);
  function checkPoint({a,b,c,t}){
    assert.equal(t?.type,'point');
    const ca=Math.hypot(a.x-c.x,a.y-c.y),cb=Math.hypot(b.x-c.x,b.y-c.y);
    assert(Math.abs(t.x-(cb*a.x+ca*b.x)/(ca+cb))<1e-8);
    assert(Math.abs(t.y-(cb*a.y+ca*b.y)/(ca+cb))<1e-8);
  }
  const initial=await resolved();
  checkPoint(initial);
  // This exam fixes A and B. Deliberately enable exploration to check the
  // relation across a real drag, then restore the original problem.
  await page.locator('#unrestrictedMove').click();
  const canvas=page.locator('#canvas');
  await canvas.scrollIntoViewIfNeeded();
  const {a,b,c}=await page.evaluate(()=>{
    const {placements}=window.DongBoardLabels.snapshot();
    const find=name=>placements.find(item=>item.names?.includes(name));
    return {a:find('A'),b:find('B'),c:find('C')};
  });
  const box=await canvas.boundingBox();
  const scale=(a.x-c.x)/(initial.a.x-initial.c.x);
  await page.mouse.move(box.x+b.x,box.y+b.y);
  await page.mouse.down();
  await page.mouse.move(box.x+b.x+scale*2,box.y+b.y,{steps:8});
  await page.mouse.up();
  const moved=await resolved();
  assert(Math.abs(moved.b.x-initial.b.x)>1,'Dragging must move an input vertex');
  assert(Math.abs(moved.t.x-initial.t.x)>0.1,'T should update when the vertex moves');
  checkPoint(moved);
  await page.locator('#unrestrictedMove').click();
  assert.deepEqual(await resolved(),initial,'Closing exploration restores the original construction');
  await screenshot('answer-angle-bisector-equality.png',null);
  answer.parts[0].steps.push('作点A处的切线。设点Z为未知线段UV的中点。观察△PAZ。');
  await page.locator('#solveButton').click();
  await page.waitForFunction(()=>!document.querySelector('#solveButton').disabled&&document.querySelector('.geometry-notice')?.textContent.includes('A 点切线'));
  const gap=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution);
  assert(!gap.scene.objects.some(n=>n.label==='A 点切线'));
  assert(gap.sceneAudit.answerMissing.includes('Z'));
  assert(gap.sceneAudit.missingPolygons.includes('△PAZ'));
  assert.match(await page.locator('.geometry-notice').textContent(),/文字作答完成不代表画板完整/);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="lesson"]').click();
  assert(await page.locator('.geometry-notice').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.locator('#solution .katex-error').count(),0);
  await screenshot('answer-geometry-gap-mobile.png',null);
  // Keep the published source and number on the input. This exercises the
  // displayed cloud steps, including an auxiliary median named in reverse.
  await page.setViewportSize({width:1600,height:1000});
  const medianStep='MC 是三角形 ABC 的中线。';
  answer.parts[0].steps=[medianStep,'以 C 为原点，数量积为 1−3x−4y，由柯西不等式得范围为 [−4,6]。'];
  await page.locator('#question').fill('2022 年北京卷第 10 题\n'+input.question);
  await page.locator('#solveButton').click();
  const medianButton=page.locator('#solution li').filter({hasText:medianStep}).locator('[data-step-graph-index]');
  await medianButton.click();
  assert.equal(await medianButton.getAttribute('aria-pressed'),'true');
  const diagram=(await savedSolution()).scene;
  const middle=diagram.objects.find(item=>item.label==='M'&&item.op==='midpoint');
  const median=diagram.objects.find(item=>item.op==='segment'&&item.refs.includes(middle?.id)&&item.refs.includes('feature:C'));
  assert(middle&&median,'Page solve installs a midpoint and the segment to the opposite vertex');
  const selection=await page.evaluate(()=>window.DongBoardStep.snapshot());
  for(const id of [middle.id,median.id])assert(selection.ids.includes(id),'Actual step button should highlight '+id);
  const medianState=()=>page.locator('#sceneJson').evaluate((element,{middle,median})=>{
    const scene=JSON.parse(element.value),{engine}=window.DongSceneAudit.frame(scene,window.DongConstruct);
    return {a:engine.resolve('feature:A'),b:engine.resolve('feature:B'),m:engine.resolve(middle),cm:engine.resolve(median)};
  },{middle:middle.id,median:median.id});
  const checkMedian=({a,b,m,cm})=>{
    assert(Math.abs(m.x-(a.x+b.x)/2)<1e-8&&Math.abs(m.y-(a.y+b.y)/2)<1e-8);
    assert(Math.abs(cm.o.x+cm.d.x-m.x)<1e-8&&Math.abs(cm.o.y+cm.d.y-m.y)<1e-8);
  };
  const beforeDrag=await medianState();checkMedian(beforeDrag);
  await page.locator('#unrestrictedMove').click();
  await canvas.scrollIntoViewIfNeeded();
  const where=await page.evaluate(()=>window.DongBoardLabels.snapshot().placements.find(p=>p.names?.includes('B')));
  const bounds=await canvas.boundingBox();
  await page.mouse.move(bounds.x+where.x,bounds.y+where.y);
  await page.mouse.down();
  await page.mouse.move(bounds.x+where.x+55,bounds.y+where.y,{steps:8});
  await page.mouse.up();
  const afterDrag=await medianState();checkMedian(afterDrag);
  assert(Math.abs(afterDrag.m.x-beforeDrag.m.x)>.1,'The midpoint must actually move');
  await page.locator('#unrestrictedMove').click();
  assert.deepEqual(await medianState(),beforeDrag);
};
