const reflected=require('./reflected_chord_browser_smoke.cjs').question;
const focus=require('./focus_chord_browser_smoke.cjs').question;

module.exports=async({page,context,assert,screenshot})=>{
  let calls=0,raw;
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,remote:true,models:['fixture-cloud']}}}));
  await context.route('**/api/stream',r=>{
    calls++;
    return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(raw)}}]})+
      '\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
  const solve=async(question,scene,count)=>{
    raw={title:'云端静态图回放',strategy:'测试中有意用静态图',parts:[{index:1,status:'partial',answer:'云端待核对结论',steps:['只返回第一问的文字']}],scene};
    await page.locator('#question').fill(question);
    await page.locator('#solveButton').click();
    await page.waitForFunction(()=>['complete','partial','error'].includes(document.querySelector('#solveProgress').dataset.state)&&!document.querySelector('#solveButton').disabled);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
    assert.equal(saved.solution.completion.answered,count,await page.locator('#status').textContent());
    assert.equal(saved.solution.mode,'cloud-ai');
    assert(saved.solution.parts.every(part=>part.source==='symbolic-verified-override'));
    assert(saved.solution.model_scene?.lines?.length,'Keep the returned static graph in the archived reply');
    assert.equal(saved.solution.model_strategy,'测试中有意用静态图');
    assert(!Object.hasOwn(saved.scene.points,'A')&&!Object.hasOwn(saved.scene.points,'B'),'Do not freeze the dynamic intersections');
    assert(!saved.scene.lines.some(line=>line.label==='AI静态线'));
    return saved;
  };

  const staticLine={kind:'slope',label:'AI静态线',m:1,b:-1};
  const para=await solve(focus,{type:'parabola',p:1,dynamicLine:false,points:{P:[1,0],A:[1,2],B:[1,-2]},lines:[staticLine],constructions:[
    {id:'frozen-pa',op:'segment',refs:['feature:P','feature:A'],label:'静态 PA'},
    {id:'frozen-child',op:'distance',refs:['feature:P','frozen-mid'],label:'静态派生长度'},
    {id:'frozen-mid',op:'midpoint',refs:['feature:P','feature:A'],label:'U'}
  ]},4);
  const parabola=para.scene;
  assert(!parabola.objects.some(node=>node.id.startsWith('frozen-')));
  assert(para.solution.modelAuxiliaries.archived.some(item=>item.label==='静态 PA'&&item.reason.includes('无法对应')));
  assert.equal(parabola.focusChord.tangents.length,2);
  assert(parabola.lines.some(line=>line.id===parabola.focusChord.qLocus&&line.x===-1));
  assert(parabola.objects.some(node=>node.id===parabola.focusChord.mLocus));
  await page.locator('[data-study-part="1"]').click();
  await page.locator('#solution .part-body li').filter({hasText:/两条切线斜率/}).locator('[data-step-graph-index]').click();
  const selected=await page.evaluate(()=>window.DongBoardStep.snapshot()?.ids||[]);
  assert(parabola.focusChord.tangents.every(id=>selected.includes(id)));
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-mobile-panel="lesson"]').click();
  await page.locator('[data-step-graph-open]').click();
  await page.locator('#chordRelationPanel summary').click();
  assert.match(await page.locator('#chordRelationReadout').textContent(),/两切线方向点积（单位方向）0/);
  await screenshot('cloud-chord-alignment-mobile.png',null);
  await page.setViewportSize({width:1600,height:1050});

  const paired=await solve(reflected,{type:'ellipse',a:2,b:1,dynamicLine:true,lineThrough:'point:P',points:{P:[1,0],W:[99,99]},lines:[staticLine],constructions:[
    {id:'ai-length',op:'distance',refs:['mid-pa','feature:B'],label:'辅助长度',part:2},
    {id:'mid-pa',op:'midpoint',refs:['feature:P','feature:A'],label:'U',part:2},
    {id:'helper-pa',op:'segment',refs:['feature:P','feature:A'],label:'辅助线段',part:2},
    {id:'other-scope',op:'segment',refs:['mid-pa','feature:A'],label:'跨问线段',part:1},
    {id:'wrong-anchor',op:'segment',refs:['feature:P','feature:W'],label:'错误锚点',part:2},
    {id:'copied-m',op:'line',refs:['feature:A','feature:B'],label:'m',part:2}
  ]},2);
  const ellipse=paired.scene;
  assert.equal(ellipse.fixedPoint.x,4);
  assert.equal(ellipse.pairedChord.part,2);
  assert(ellipse.objects.some(node=>node.id==='reflected-chord-m-prime'&&node.part===2));
  assert(!paired.solution.sceneAudit.missingLines.includes('L′'),'The second dynamic chord already exists');
  assert.deepEqual(paired.solution.modelAuxiliaries.accepted.sort(),['U','辅助线段','辅助长度'].sort());
  assert.deepEqual(paired.solution.modelAuxiliaries.archived.map(item=>item.label).sort(),['AI静态线','跨问线段','错误锚点','m'].sort());
  assert(!Object.hasOwn(ellipse.points,'W'));
  assert(ellipse.objects.filter(node=>['ai-length','mid-pa','helper-pa'].includes(node.id)).every(node=>node.source==='model'&&node.part===2));
  const samples=await page.evaluate(scene=>[42,71].map(theta=>{
    const {engine}=window.DongSceneAudit.frame({...scene,theta,activePart:2},window.DongConstruct);
    const U=engine.resolve('mid-pa'),A=engine.resolve('feature:A'),P=engine.resolve('feature:P'),L=engine.resolve('ai-length');
    return {x:U.x,y:U.y,error:Math.hypot(U.x-(A.x+P.x)/2,U.y-(A.y+P.y)/2),length:L.value};
  }),ellipse);
  assert(samples.every(sample=>sample.error<1e-9));
  assert.notEqual(samples[0].length,samples[1].length,'An admitted dependent measurement updates with the chord');
  await page.locator('.diagram-audit > summary').click();
  const details=page.locator('[data-lesson-detail="model-auxiliaries"]');
  await details.locator('summary').click();
  assert.match(await details.textContent(),/跨问线段 · 依赖对象不在同一小问/);
  assert.match(await details.textContent(),/已保留，可随构造联动/);
  assert.equal(calls,2,'Each problem uses one cloud request before deterministic graph alignment');
};
