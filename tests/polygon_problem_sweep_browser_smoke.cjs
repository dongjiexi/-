module.exports=async({page,assert,screenshot})=>{
  const solve=async question=>{
    await page.locator('#question').fill(question);
    await page.locator('#solveButton').click();
    await page.waitForFunction(()=>!document.querySelector('#solveButton')?.disabled,{timeout:12000});
    return JSON.parse(await page.locator('#sceneJson').inputValue());
  };
  let scene=await solve('已知椭圆 C：x²/9+y²/4=1，A(3,0)，B(0,2)，D(-3,0)。求△ABD 的面积。');
  assert.deepEqual(scene.polygons[0]?.labels,['A','B','D']);
  assert.match(await page.locator('#solution').innerText(),/面积为 6/);
  assert.match(await page.locator('#metrics').innerText(),/△ABD · 面积\s*6/);
  assert.match(await page.locator('#metrics').innerText(),/∠B（△ABD）\s*≈112\.6°/);
  assert.match(await page.locator('#layers').innerText(),/△ABD · 高亮/);
  await page.locator('[data-inspector-view="geometry"]').click();
  await page.locator('#layers .layer-row').filter({hasText:'△ABD · 高亮'}).locator('input').uncheck();
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).polygons[0].visible,false);

  scene=await solve('已知圆 C：x²+y²=25，A(3,4)，B(-3,4)，C(-3,-4)，D(3,-4)。求四边形 ABCD 的面积和周长。');
  assert.deepEqual(scene.polygons[0]?.labels,['A','B','C','D']);
  assert.match(await page.locator('#solution').innerText(),/面积为 48/);
  assert.match(await page.locator('#solution').innerText(),/周长为 28/);
  assert.match(await page.locator('#solution').innerText(),/\|AB\|=6/);
  assert.match(await page.locator('#metrics').innerText(),/四边形ABCD · 面积\s*48/);

  scene=await solve('已知双曲线 C：x²/9−y²/4=1，A(3,0)，B(0,2)，P(-3,0)。求三角形 ABP 的面积。');
  assert.equal(scene.type,'hyperbola');
  assert.match(await page.locator('#solution').innerText(),/面积为 6/);

  scene=await solve('已知椭圆 C：x²/9+y²/4=1，A(3,0)，B(0,2)，D(-3,0)，E(0,-2)。(1) 求△ABD的面积。(2) 求四边形ABDE的周长。');
  assert.equal(scene.polygons.length,2);
  assert.match(await page.locator('#metrics').innerText(),/△ABD · 面积/);
  assert.doesNotMatch(await page.locator('#metrics').innerText(),/四边形ABDE · 周长/);
  await page.locator('[data-study-part="2"]').click();
  assert.match(await page.locator('#metrics').innerText(),/四边形ABDE · 周长/);
  assert.doesNotMatch(await page.locator('#metrics').innerText(),/△ABD · 面积/);

  scene=await solve('已知抛物线 C：y²=4x，点 P(1,0)，过点 P 的直线 l 与 C 交于 A、B。观察△OAB 的面积随直线 l 的变化。');
  assert.deepEqual(scene.polygons[0]?.labels,['O','A','B']);
  const area=()=>page.locator('#metrics .metric').filter({hasText:'△OAB · 面积'}).locator('.metric-value').innerText();
  const before=await area();
  await page.locator('[data-inspector-view="geometry"]').click();
  await page.locator('#parameterTarget').selectOption('$dynamic');
  await page.locator('#params input[data-key="theta"][data-param-expression="true"]').evaluate(el=>{el.value='75';el.dispatchEvent(new Event('input',{bubbles:true}));});
  const after=await area();
  assert.notEqual(before,after,'动态三角形面积应随割线移动重算');
  scene=await solve('已知椭圆 C：x²/9+y²/4=1，A(3,0)，B(0,2)，D(-3,0)。当 A、B、D 运动时，求△ABD 面积的最大值以及何时取到。');
  assert.doesNotMatch(await page.locator('#solution').innerText(),/△ABD 的面积为 6/,'最值题不能把当前面积误报为完整答案');
  await solve('已知圆 C：x²+y²=25，A(3,4)，B(-3,-4)，C(-3,4)，D(3,-4)。求四边形ABCD的面积。');
  assert.match(await page.locator('#solution').innerText(),/边界相交/);
  assert.match(await page.locator('#metrics').innerText(),/边界相交/);
  assert.doesNotMatch(await page.locator('#solution').innerText(),/面积为 0/);
  await solve('已知圆 C：x²+y²=25，A(3,4)，B(-3,4)，C(-3,-4)，D(3,-4)。求四边形DCBA的面积。');
  assert.match(await page.locator('#solution').innerText(),/面积为 48/,'反向但不相交的顶点顺序仍应正确求面积');
  await solve('已知椭圆 C：x²/9+y²/4=1，A(3,0)，B(0,0)，D(-3,0)。求△ABD的面积。');
  assert.match(await page.locator('#solution').innerText(),/顶点共线/);
  assert.match(await page.locator('#metrics').innerText(),/∠B（△ABD）\s*退化，未定义/);
  await screenshot('polygon-question-sweep.png','.board-shell');

  // Legacy name-based dependencies in an imported construction.
  const question='分问图稿：分别查看两问的点 P、直线 AP 和三角形 ABP。';
  const scoped={
    format:'dongjiexi-lesson',version:1,question,activePart:99,
    solution:{title:'分问图稿',restatement:question,parts:[1,2].map(index=>({index,label:'第 '+index+' 问',answer:'',steps:['连接点 A 与点 P，得到直线 AP。']}))},
    scene:{type:'circle',r:4,showDynamic:false,problemMotion:false,activePart:2,points:{A:[0,0],B:[2,0]},objects:[
      {id:'p1',kind:'point',label:'P',x:1,y:1,part:1},
      {id:'p2',kind:'point',label:'P',x:1,y:3,parts:['2']},
      {id:'w',kind:'construction',op:'intersection',refs:['ap','horizontal'],label:'W'}
    ],lines:[
      {id:'ap',kind:'through_points',a:'A',b:'P',label:'AP',infinite:true},
      {id:'horizontal',kind:'slope',m:0,b:1,label:'h'}
    ],polygons:[{id:'triangle',labels:['A','B','P'],label:'△ABP'}]}
  };
  const importRecord=async record=>{
    await page.locator('#importLesson').setInputFiles({name:'scoped-lesson.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});
    await page.waitForFunction(()=>!document.querySelector('#notebookDialog').open&&document.querySelector('#question').value.startsWith('分问图稿'));
    await page.locator('[data-inspector-view="lesson"]').click();
  };
  const triangleArea=()=>page.locator('#metrics .metric').filter({hasText:'△ABP · 面积'}).locator('.metric-value').textContent();
  const position=()=>page.evaluate(()=>window.DongBoardLabels.snapshot().placements.find(row=>row.names?.includes('W'))?.worldX);
  await importRecord(scoped);
  assert.equal(await page.locator('#solution .part-body').count(),2,'An obsolete part number restores the combined explanation');
  assert.match(await triangleArea(),/暂未定位.*P/,'Combined view never guesses between the two point definitions');
  await page.locator('[data-study-part="1"]').click();
  assert.equal(await triangleArea(),'1');assert(Math.abs(await position()-1)<1e-8);
  await page.locator('[data-study-part="2"]').click();
  assert.equal(await triangleArea(),'3');assert(Math.abs(await position()-1/3)<1e-8);
  await page.locator('[data-step-graph-part="2"][data-step-graph-index="0"]').click();
  const ids=await page.evaluate(()=>window.DongBoardStep.snapshot().ids);
  assert(ids.includes('p2')&&ids.includes('ap')&&!ids.includes('p1'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-inspector-view="lesson"]').click();
  assert(await page.locator('[data-study-part="2"]').evaluate(el=>el.classList.contains('active')));
  assert.equal(await triangleArea(),'3');
  assert.equal(await page.evaluate(()=>window.DongBoardStep.snapshot()),null);
  delete scoped.activePart;
  await importRecord(scoped);
  assert(await page.locator('[data-study-part="2"]').evaluate(el=>el.classList.contains('active')),'Older imports can recover the part from their saved scene');
};
