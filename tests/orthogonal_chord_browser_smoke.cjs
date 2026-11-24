const QUESTION=String.raw`已知椭圆 (C:\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}=1\ (a>b>0)) 的离心率为 (\dfrac{\sqrt2}{2})，且经过点 (P\left(1,\dfrac{\sqrt2}{2}\right))。
（1）求椭圆 (C) 的标准方程；
（2）设直线 (l) 与椭圆 (C) 交于 (A,B) 两点，(O) 为坐标原点。若 (OA\perp OB)，证明：直线 (l) 与一个定圆相切，并求该定圆的方程及 (\triangle OAB) 面积的最小值。`;
module.exports=async({page,assert,screenshot})=>{
  await page.addInitScript(()=>{
    window.__pairedGeometry={};
    for(const [name,key] of [['DongConstruct','native'],['DongLearning','learning'],['DongStepHighlight','steps']]){
      let module;
      Object.defineProperty(window,name,{configurable:true,get:()=>module,set:value=>{
        module=value;const attach=value.attach;
        value.attach=api=>{const controller=attach(api);window.__pairedGeometry[key]={api,controller};return controller;};
      }});
    }
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#question').fill(QUESTION);await page.locator('#solveButton').click();
  await page.waitForFunction(()=>!document.querySelector('#solveButton').disabled);
  const model=JSON.parse(await page.locator('#sceneJson').inputValue());
  assert.equal(model.type,'ellipse');assert(Math.abs(model.a*model.a-2)<1e-9);assert(Math.abs(model.b*model.b-1)<1e-9);
  assert.match(await page.locator('#solution').innerText(),/逐问作答：2 \/ 2/);
  await page.locator('[data-study-part="2"]').click();
  assert(model.orthogonalChord,'不能把原椭圆方程冒充定圆结论');
  assert(model.objects.some(o=>o.op==='orthogonal_chord_circle'));
  assert.equal(await page.locator('#motionPlay').isEnabled(),true,'切换到第二问后应能播放受约束的动弦');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#solution annotation')).some(n=>n.textContent==='x^2+y^2=\\frac{2}{3}'));
  assert.match(await page.locator('#solution').innerText(),/竖直线不能遗漏/);
  await page.locator('[data-inspector-view="geometry"]').click();
  await page.locator('#parameterTarget').selectOption('$dynamic');
  const theta=page.locator('#params input[data-key="theta"][data-param-expression]');
  for(const angle of [0,37,90,180,270]){
    await theta.fill(String(angle));
    assert.match(await page.locator('#metrics').innerText(),/垂直条件 · OA·OB\s*0（已核对）/);
    assert.match(await page.locator('#metrics').innerText(),/定圆半径平方\s*2\/3/);
  }
  await page.locator('#locateOrthogonalMinimum').click();
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).theta,0);
  assert.match(await page.locator('#metrics').innerText(),/△OAB · 面积\s*2\/3/);
  await screenshot('orthogonal-chord.png','.board-shell');
  await page.locator('#parameterTarget').selectOption('$conic');
  await page.locator('#unrestrictedMove').click();
  await page.locator('#params input[data-key="a"][data-param-expression]').fill('2');
  assert.match(await page.locator('#metrics').innerText(),/定圆半径平方\s*4\/5/,'改动半轴后定圆与最值须同步变化');
  await page.locator('[data-inspector-view="lesson"]').click();
  await page.locator('[data-study-part="1"]').click();
  assert.doesNotMatch(await page.locator('#metrics').innerText(),/定圆半径平方/);
  // Missing perpendicular premise must never become an answered fixed-circle proof.
  await page.locator('#question').fill('椭圆 C：x²/2+y²=1。直线l与椭圆交于A、B。证明直线l与一个定圆相切，并求定圆方程。');
  await page.locator('#solveButton').click();await page.waitForFunction(()=>!document.querySelector('#solveButton').disabled);
  assert.doesNotMatch(await page.locator('#solution').innerText(),/已生成完整作答/);

  // A geometric fixture exercises two independently tangent chords; this is
  // not a solved-question fixture or an expansion of recognized problem types.
  const paired=await page.evaluate(async()=>{
    const {native,learning,steps}=window.__pairedGeometry;
    const scene={type:'ellipse',a:4,b:2,h:0,k:0,theta:0,theta2:90,showConic:true,showDynamic:true,showFeatures:true,
      orthogonalChord:{},pairedChord:{labels:['C','D'],lineLabel:'l′',part:2},dynamicIntersectionLabels:['A','B'],points:{},objects:[],lines:[]};
    const state=learning.api.state;state.activePart=2;
    learning.api.installScene(learning.api.modelFromJson(JSON.stringify(scene)),'双动弦几何回归');
    const {api,controller}=native,ctx=api.ctx,paths=[],saved={};let path=[];
    for(const key of ['beginPath','moveTo','lineTo','stroke'])saved[key]=ctx[key];
    ctx.beginPath=function(...args){path=[];return saved.beginPath.apply(this,args);};
    ctx.moveTo=function(x,y){path.push(api.world({x,y}));return saved.moveTo.call(this,x,y);};
    ctx.lineTo=function(x,y){path.push(api.world({x,y}));return saved.lineTo.call(this,x,y);};
    ctx.stroke=function(...args){if(this.strokeStyle==='#4d86d1'&&path.length===2)paths.push(path.map(p=>({...p})));return saved.stroke.apply(this,args);};
    try{api.render();}finally{Object.assign(ctx,saved);}
    const line=controller.engine.resolve('$dynamic2'),entries=steps.api.entries(),highlight=entries.find(item=>item.id==='$dynamic2');
    const points=['C','D'].map(name=>api.features().find(point=>point.name===name));
    // PNG export snapshots this same native canvas. Decode it to verify that
    // the blue secondary line is actually at its independent tangent anchor.
    const radius=Math.sqrt(16*4/(16+4)),screen=api.xy(-radius,0.35),scale=api.canvas.width/state.cssW;
    const blob=await new Promise(resolve=>api.canvas.toBlob(resolve,'image/png')),bitmap=await createImageBitmap(blob),copy=document.createElement('canvas');
    copy.width=bitmap.width;copy.height=bitmap.height;const exported=copy.getContext('2d');exported.drawImage(bitmap,0,0);bitmap.close();
    const size=7,pixels=exported.getImageData(Math.round(screen.x*scale)-3,Math.round(screen.y*scale)-3,size,size).data;
    let blue=false;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-77)<16&&Math.abs(pixels[i+1]-134)<16&&Math.abs(pixels[i+2]-209)<16)blue=true;
    state.activePart=1;api.render();const firstPart=steps.api.entries().map(item=>item.id);
    state.activePart=2;api.render();
    return{line,highlight:highlight?.shape,points,paths,blue,firstPart};
  });
  const r=Math.sqrt(16*4/(16+4));
  assert(Math.abs(paired.line.o.x+r)<1e-9&&Math.abs(paired.line.o.y)<1e-9,'Second line uses theta2 for its anchor');
  assert.deepEqual(paired.highlight,paired.line,'Teaching highlights use the same secondary line as its intersections');
  assert(paired.paths.length,'The visible secondary chord is actually stroked on the canvas');
  for(const path of paired.paths)for(const p of path)assert(Math.abs(p.x+r)<1e-8,'Drawn vertical chord must pass through x=-R');
  for(const p of paired.points)assert(Math.abs(p.x+r)<1e-8,'Built-in C/D lie on that drawn chord');
  assert(paired.blue,'The exported PNG contains the blue line at x=-R');
  assert(!paired.firstPart.includes('$dynamic2'),'The secondary line is excluded outside its assigned part');

  await page.locator('#moveMode').click();
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  const targetAngle=125,rad=targetAngle*Math.PI/180;
  const target={x:-r*Math.sin(rad)+2.6*Math.cos(rad),y:r*Math.cos(rad)+2.6*Math.sin(rad)};
  const dragPoints=await page.evaluate(({r,target})=>{
    const api=window.__pairedGeometry.native.api;
    const box=api.canvas.getBoundingClientRect();
    return [{x:-r,y:2.6},target].map(point=>{
      const p=api.xy(point.x,point.y);
      return {x:box.left+p.x,y:box.top+p.y};
    });
  },{r,target});
  await page.mouse.move(dragPoints[0].x,dragPoints[0].y);
  await page.mouse.down();
  await page.mouse.move(dragPoints[1].x,dragPoints[1].y,{steps:14});
  await page.mouse.up();
  const dragged=await page.evaluate(()=>{
    const {native,learning}=window.__pairedGeometry;
    const {theta,theta2}=learning.api.state.p;
    return {theta,theta2,line:native.controller.engine.resolve('$dynamic2'),
      points:native.api.features().filter(p=>p.name==='C'||p.name==='D')};
  });
  assert.equal(dragged.theta,0,'Dragging the secondary line preserves the primary angle');
  assert(Math.abs(dragged.theta2-targetAngle)<.05,'The nearer tangent follows the drag continuously');
  assert(Math.abs((target.x-dragged.line.o.x)*dragged.line.d.y-(target.y-dragged.line.o.y)*dragged.line.d.x)<.002);
  const [c,d]=dragged.points;
  assert(Math.abs(c.x*d.x+c.y*d.y)<1e-8,'Dragging preserves the perpendicular-radii premise');
};
