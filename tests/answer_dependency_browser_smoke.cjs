/* Sourced exam input + explicit auxiliary reply protocol properties.
 * No paid inference, invented exam item or general model-accuracy claim. */
module.exports=async({page,context,assert,screenshot})=>{
  const fs=require('node:fs'),path=require('node:path');
  const exam=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/sourced-exam-additions.json'),'utf8')).items.find(n=>n.id==='2022-beijing-10');
  await context.addInitScript(()=>{let learning;Object.defineProperty(window,'DongLearning',{configurable:true,get:()=>learning,set:value=>{learning=value;const attach=value.attach;value.attach=api=>{window.__answerDependencyApi=api;return attach(api);};}});});
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,remote:true,models:['fixture-cloud']}}}));
  let staticN=false;
  await context.route('**/api/stream',r=>{const reply={title:'原卷题辅助构造协议校核',parts:[{index:0,status:'answered',answer:'$[-4,6]$',steps:['R为P关于x轴的对称点。S为P关于点C的对称点。','在S点处的切线记为tS。在P点和R点处的切线分别为tP、tR，切线tP与tR交于点T。连接CT。','N为AB的中点。向量数量积为 $1-3x-4y$，范围为 $[-4,6]$。']}],scene:{type:'circle',h:0,k:0,r:1,dynamicLine:false,points:{A:[3,0],B:[0,4],C:[0,0],...(staticN?{N:[1.5,2]}:{})},curvePoints:[{name:'P',t:.9}]}};return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(reply)}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#cloudConnection').dataset.state==='connected');
  const read=()=>page.evaluate(()=>{const api=window.__answerDependencyApi,scene=api.sceneData(),frame=window.DongSceneAudit.frame(scene,window.DongConstruct),node=label=>scene.objects.find(n=>n.label===label);return{scene,view:api.state.view,points:Object.fromEntries(['P','R','S','T','N'].map(label=>[label,frame.engine.resolve(node(label)?.id)])),solution:api.state.solution};});
  const solve=async()=>{await page.locator('#question').fill(exam.question);await page.locator('#solveButton').click();await page.waitForFunction(()=>!document.querySelector('#solveButton').disabled&&document.querySelector('#solution')?.textContent.includes('原卷题辅助构造协议校核'));return read();};
  let data=await solve();
  for(const name of ['R','S','T','N'])assert(data.points[name],name+' appears from explicit answer construction');
  assert.equal(data.scene.objects.find(n=>n.label==='R').op,'reflect_axis');
  assert.equal(data.scene.objects.find(n=>n.label==='S').op,'reflect_center');
  assert.equal(data.scene.objects.filter(n=>n.op==='tangent').length,3);
  const target=data.scene.objects.find(n=>n.label==='T');assert.deepEqual(target.refs.map(id=>data.scene.objects.find(n=>n.id===id).aliases[0]),['tP','tR']);
  assert.equal(data.solution.sceneAudit.invalid.length,0,JSON.stringify(data.solution.sceneAudit));
  assert.equal(data.solution.sceneAudit.answerMissing.length,0,JSON.stringify(data.solution.sceneAudit));
  assert(!await page.locator('.geometry-notice').isVisible());
  const check=d=>{const {P,R,S,T}=d.points;assert(Math.abs(R.x-P.x)<1e-8&&Math.abs(R.y+P.y)<1e-8);assert(Math.abs(S.x+P.x)<1e-8&&Math.abs(S.y+P.y)<1e-8);assert(Math.abs(P.x*T.x+P.y*T.y-1)<1e-7);assert(Math.abs(R.x*T.x+R.y*T.y-1)<1e-7);};
  check(data);
  const linkage=await page.evaluate(()=>{const api=window.__answerDependencyApi,before=JSON.stringify(api.sceneData()),result=api.highlightStep({text:'切线tP与tR交于点T。',part:api.state.activePart,index:0});return{result,snapshot:window.DongBoardStep.snapshot(),unchanged:before===JSON.stringify(api.sceneData())};});
  assert(linkage.result.matched.includes('P 点切线')&&linkage.result.matched.includes('R 点切线'),'Answer aliases highlight their actual tangent objects');
  assert(linkage.snapshot.ids.includes(target.refs[0])&&linkage.snapshot.ids.includes(target.refs[1]));
  assert(linkage.unchanged,'Step highlighting does not mutate the graph');
  // Real pointer drag; test hook only reads the existing viewport and scene.
  await page.locator('#homeButton').click();data=await read();const box=await page.locator('#canvas').boundingBox(),v=data.view,xy=p=>({x:box.x+(p.x-v.xmin)/(v.xmax-v.xmin)*box.width,y:box.y+(v.ymax-p.y)/(v.ymax-v.ymin)*box.height});
  const from=xy(data.points.P),to=xy({x:Math.cos(1.2),y:Math.sin(1.2)}),before=data.points.P;
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up();data=await read();
  assert.notDeepEqual(data.points.P,before,'Actual dragging changes the curve-bound point');check(data);
  await page.locator('.diagram-audit summary').click();await page.locator('[data-diagram-recheck]').click();assert.match(await page.locator('.diagram-audit').textContent(),/对称点与指定轴或中心/);
  const moved=data.points.P;await page.reload({waitUntil:'domcontentloaded'});data=await read();assert.deepEqual(data.points.P,moved,'Saved dependencies survive reload');check(data);
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.locator('[data-mobile-panel="board"]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const labels=await page.evaluate(()=>window.DongBoardLabels.snapshot().placements.flatMap(n=>n.names||[]));for(const name of ['P','R','S','T'])assert(labels.includes(name),name+' has a visible mobile label');await screenshot('answer-dependency-'+width+'.png',null);}
  await page.setViewportSize({width:1600,height:1050});await page.locator('[data-inspector-view="lesson"]').click();staticN=true;data=await solve();
  assert(data.solution.sceneAudit.answerUnresolved.some(n=>n.label==='N'&&n.dependencyUnconfirmed));assert.match(await page.locator('.geometry-notice').textContent(),/N（依赖待确认）/);assert(!data.scene.objects.some(n=>n.op==='midpoint'&&n.label==='N'));
  await page.locator('.diagram-audit summary').click();await page.locator('[data-diagram-recheck]').click();assert.match(await page.locator('.geometry-notice').textContent(),/N（依赖待确认）/,'Recheck retains dependency warnings from original model steps');
  assert.equal(await page.locator('#solution .katex-error').count(),0);
  await screenshot('answer-dependency-warning.png',null);
  // Explicit scope integration fixture, not an additional exam or AI answer.
  await page.evaluate(()=>{
    const api=window.__answerDependencyApi;
    const result={title:'跨小问构造作用域校核',parts:[
      {index:1,label:'第一问',status:'answered',answer:'在P点和R点处的切线分别为tP、tR。',steps:[]},
      {index:2,label:'第二问',status:'answered',answer:'两条切线交于点T。',steps:[]}
    ],scene:{type:'circle',h:0,k:0,r:1,dynamicLine:false,points:{P:[.6,.8],R:[.6,-.8]},objects:[],lines:[]}};
    api.enrichSolvedScene(result,'已知圆上的点P、R。');
    api.installScene(api.modelFromJson(JSON.stringify(result.scene)),'作用域测试');
    api.showSolution(result);api.render();api.remember();
  });
  const visibleLabels=()=>page.evaluate(()=>window.DongBoardLabels.snapshot().placements.flatMap(n=>n.names||[]));
  assert(!(await visibleLabels()).includes('T'),'Part 1 does not display the intersection introduced in part 2');
  await page.locator('[data-inspector-view="lesson"]').click();
  await page.locator('[data-study-part="2"]').click();
  data=await read();assert(data.points.T,'Later part resolves the earlier tangent pair');
  assert((await visibleLabels()).includes('T'),'Part 2 draws the intersection label');
  const scoped=await page.evaluate(()=>{const api=window.__answerDependencyApi;return api.highlightStep({text:'切线tP与tR交于点T。',part:2,index:0});});
  assert(scoped.matched.includes('P 点切线')&&scoped.matched.includes('R 点切线'),'Both inherited tangents are available to actual step highlighting');
  await page.reload({waitUntil:'domcontentloaded'});
  data=await read();assert.equal(data.scene.activePart,2);assert(data.points.T);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="board"]').click();
  assert((await visibleLabels()).includes('T'),'Cross-part intersection survives reload and mobile layout');
  await screenshot('answer-dependency-cross-part.png',null);
  await page.evaluate(()=>{
    const api=window.__answerDependencyApi;
    const result={title:'同名构造冲突校核',parts:[
      {index:1,label:'第一问',status:'answered',answer:'N为AB的中点。',steps:[]},
      {index:2,label:'第二问',status:'answered',answer:'连接PN。M为PN的中点。N为AC的中点。',steps:[]}
    ],scene:{type:'circle',h:2,k:1,r:3,dynamicLine:false,points:{A:[5,1],B:[2,4],C:[-1,1],P:[8,6]},objects:[],lines:[]}};
    api.enrichSolvedScene(result,'已知点A、B、C、P。');
    api.installScene(api.modelFromJson(JSON.stringify(result.scene)),'冲突测试');
    api.showSolution(result);api.render();api.remember();
  });
  await page.setViewportSize({width:1600,height:1050});
  await page.locator('[data-inspector-view="lesson"]').click();
  await page.locator('[data-study-part="2"]').click();
  data=await read();assert(data.solution.sceneAudit.answerConflicts.some(n=>n.label==='N'));
  assert(!data.scene.objects.some(n=>n.label==='PN'||n.label==='M'),'Conflicting point is not used for downstream constructions');
  assert(!(await visibleLabels()).includes('N'),'Wrong earlier point is not silently drawn for the later question');
  assert.match(await page.locator('.geometry-notice').textContent(),/N（关系冲突）/);
  await page.locator('[data-study-part="1"]').click();
  assert((await visibleLabels()).includes('N'),'Original point remains available in its original part');
};
