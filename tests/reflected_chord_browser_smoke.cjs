const QUESTION = "已知椭圆 C:\\dfrac{x^{2}}{4}+y^{2}=1，定点 P(1,0)。过点 P 作任意一条不与 x 轴重合的直线 l，与椭圆 C 交于 A(x_1,y_1),B(x_2,y_2) 两点。设 A' 为点 A 关于 x 轴的对称点，即 A'(x_1,-y_1)，连接 A'B，所得直线记为 m。(1) 证明：直线 m 恒过定点，并求出该定点坐标；(2) 另取一条也过点 P 的直线 l'（与 l 不重合），交椭圆于 C,D，按同样方式得到直线 m'。证明直线 m 与 m' 交于同一定点。";

module.exports = async ({page,assert,screenshot}) => {
  await page.locator('#question').fill(QUESTION);
  await page.locator('#solveButton').click();
  await page.waitForFunction(() => !document.querySelector('#solveButton')?.disabled);
  const scene=JSON.parse(await page.locator('#sceneJson').inputValue());
  assert.deepEqual(scene.dynamicIntersectionLabels,['A','B']);
  assert.deepEqual(scene.pairedChord?.labels,['C','D']);
  assert.equal(scene.fixedPoint?.x,4);
  assert.equal(scene.lineThrough,'point:P');
  assert.ok(scene.objects.some(item=>item.op==='reflect_axis'&&item.label==='A′'));
  assert.ok(scene.objects.some(item=>item.op==='line'&&item.label==='m'));
  assert.ok(scene.objects.some(item=>item.op==='reflect_axis'&&item.label==='C′'));
  assert.ok(scene.objects.some(item=>item.op==='line'&&item.label==='m′'));
  const solution=await page.locator('#solution').innerText();
  assert.match(solution,/T\(4,0\)/);
  assert.match(solution,/竖直线/);
  assert.match(solution,/两条所得直线可能重合/);
  const read=()=>page.locator('#sceneJson').inputValue().then(JSON.parse);
  const partLabels=()=>page.evaluate(()=>window.DongBoardLabels.snapshot().placements.flatMap(item=>item.names||[]));
  await page.locator('[data-study-part="1"]').click();
  assert((await partLabels()).includes('T'));
  assert(!(await partLabels()).some(label=>['D','C′','l′','m′'].includes(label)),'The second chord belongs to the second part');
  await page.locator('[data-study-part="2"]').click();
  await page.locator('#homeButton').click();
  const findStep=page.locator('#solution li').filter({hasText:/第二条直线/});
  await findStep.locator('[data-step-graph-index]').click();
  const ids=()=>page.evaluate(()=>window.DongBoardStep.snapshot()?.ids||[]);
  assert((await ids()).includes('fixed')&&(await ids()).includes('reflected-chord-m-prime'));
  await page.locator('[data-inspector-view="geometry"]').click();
  await page.locator('#parameterTarget').selectOption('$dynamic');
  assert.match(await page.locator('#params').innerText(),/第二条直线角度/);
  const dragAngle=async(key,degrees)=>{
    const saved=await read(),box=await page.locator('#canvas').boundingBox();
    const scale=Math.max(2*saved.a*1.75/box.width,2*saved.b*1.9/box.height,2*saved.fixedPoint.x*1.18/box.width);
    const origin={x:box.x+box.width/2+scale**-1,y:box.y+box.height/2};
    const point=(angle,radius)=>({x:origin.x+radius*Math.cos(angle*Math.PI/180),y:origin.y-radius*Math.sin(angle*Math.PI/180)});
    const from=point(saved[key],110),to=point(degrees,105);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();
    const next=await read(),other=key==='theta'?'theta2':'theta';
    assert(Math.abs(next[key]-degrees)<1,JSON.stringify({key,want:degrees,got:next[key]}));
    assert.equal(next[other],saved[other],'The other chord angle remains independent');
  };
  await dragAngle('theta2',133);
  await dragAngle('theta',30);
  assert.equal(await page.locator('#chordRelationReadout').getByText('0（当前构型通过定点）',{exact:true}).count(),2);
  assert((await ids()).includes('fixed'),'Dragging does not clear valid highlights');
  const angle=page.locator('#params [data-key="theta2"][data-param-expression]');
  await angle.fill('90');
  assert.match(await page.locator('#chordRelationReadout').textContent(),/直线未定义/);
  assert(!(await ids()).includes('reflected-chord-m-prime'),'A degenerate line cannot stay highlighted');
  await angle.fill('133');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-mobile-panel="board"]').click();
  await page.locator('#chordRelationPanel summary').click();
  assert.equal(await page.locator('#chordRelationReadout').getByText('0（当前构型通过定点）',{exact:true}).count(),2);
  await screenshot('reflected-chord-fixed-point-mobile.png',null);
  await page.setViewportSize({width:1600,height:1050});
  const geometry=await page.evaluate(model=>{
    const q={A:1/4,B:0,C:1,D:0,E:0,F:-1},conic={type:'conic',q},origin={x:1,y:0},samples=[];
    for(const [first,second] of [[42,116],[125,55],[90,116]]){
      const makeLine=angle=>{const t=angle*Math.PI/180;return{type:'line',o:origin,d:{x:Math.cos(t),y:Math.sin(t)}};};
      const ab=window.DongConstruct.intersect(makeLine(first),conic),cd=window.DongConstruct.intersect(makeLine(second),conic);
      const feature=()=>[...ab.map((p,i)=>({...p,name:i?'B':'A'})),...cd.map((p,i)=>({...p,name:i?'D':'C'})),{...origin,name:'P'}];
      const engine=window.DongConstruct.createEngine({model:()=>model,features:feature,coeffs:()=>q,origin:()=>origin,angle:()=>first,angle2:()=>second,conicPoint:()=>null,conicProject:()=>null});
      const m=engine.resolve('reflected-chord-m'),mPrime=engine.resolve('reflected-chord-m-prime'),distance=line=>line?Math.abs((4-line.o.x)*line.d.y+line.o.y*line.d.x)/Math.hypot(line.d.x,line.d.y):null;
      samples.push({first,second,m:distance(m),mPrime:distance(mPrime)});
    }
    return samples;
  },scene);
  for(const sample of geometry){if(sample.first===90){assert.equal(sample.m,null,'竖直线处 A′=B，m 不应被虚构');continue;}assert.ok(sample.m<1e-8&&sample.mPrime<1e-8,JSON.stringify(sample));}
  await page.locator('#parameterTarget').selectOption('$conic');
  await page.locator('#unrestrictedMove').click();
  const major=page.locator('#params input[data-key="a"][data-param-expression="true"]');
  await major.evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).fixedPoint.x,9,'半轴变化时定点必须同步重算');
};
