const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{}};
for(const file of ['math-input.js','construction-board.js','scene-audit.js','answer-relations.js','answer-geometry.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/'+file),'utf8'),sandbox);
const {DongConstruct:construct,DongSceneAudit:audit,DongAnswerGeometry:geometry}=sandbox.window;
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;const test=fn=>{fn();checks++;};
// These are elementary property fixtures, not generated example questions,
// reference answers loaded by the solver, or claimed model accuracy tests.
const base={type:'circle',h:2,k:1,r:3,showDynamic:false,points:{A:[5,1],B:[2,4],C:[-1,1],D:[2,-2],P:[8,6]},objects:[],lines:[]};
const parts=[{index:1,answer:'设N为线段AB的中点。点P到直线AC的垂足为H，连接PH。分别作圆在A、B两点处的切线，两条切线交于点T。直线AC与BD交于点Q。',steps:[]}];
const scene=copy(base),report=geometry.install(scene,parts,construct),resolve=label=>audit.frame(scene,construct).engine.resolve(scene.objects.find(n=>n.label===label).id);
test(()=>assert.equal(report.unresolved.length,0,JSON.stringify(report)));
test(()=>assert.deepEqual([resolve('N').x,resolve('N').y],[3.5,2.5]));
test(()=>assert.deepEqual([resolve('H').x,resolve('H').y],[8,1]));
test(()=>assert.deepEqual([resolve('Q').x,resolve('Q').y],[2,1]));
test(()=>assert.deepEqual([resolve('T').x,resolve('T').y],[5,4]));
test(()=>assert.equal(scene.objects.filter(n=>n.op==='tangent').length,2));
test(()=>assert.equal(scene.objects.find(n=>n.label==='PH').op,'segment'));
const size=scene.objects.length;geometry.install(scene,parts,construct);
test(()=>assert.equal(scene.objects.length,size,'Repeated answer enrichment is idempotent'));
const originalScene=copy(scene);scene.points.A=[2,-2];
test(()=>assert.deepEqual([resolve('N').x,resolve('N').y],[2,1],'Midpoint follows edited endpoints rather than freezing answer coordinates'));
test(()=>assert.equal(resolve('A 点切线').o.y,-2,'Tangent stays linked to the point'));
const translated={type:'ellipse',h:7,k:-4,a:5,b:3,showDynamic:false,points:{},objects:[]};
const frame=audit.frame(translated,construct);
test(()=>assert.deepEqual([frame.engine.resolve('feature:O').x,frame.engine.resolve('feature:O').y],[7,-4]));
test(()=>assert.equal(frame.engine.resolve('feature:F'),null,'An ellipse has F₁/F₂, not an invented F alias'));
const dynamic={type:'parabola',p:1,direction:-1,h:2,k:3,theta:90,showDynamic:true,lineThrough:'focus2',pairedChord:{labels:['C','D']},theta2:120,points:{},objects:[]};
test(()=>assert.deepEqual([audit.frame(dynamic,construct).origin.x,audit.frame(dynamic,construct).origin.y],[1,3],'Parabola focus fallback matches board origin'));
test(()=>assert(audit.frame(dynamic,construct).features.some(p=>p.name==='C')&&audit.frame(dynamic,construct).features.some(p=>p.name==='D')));
const shared=copy(base);geometry.install(shared,[{index:1,answer:'N为AB中点。',steps:[]},{index:2,answer:'N为AB中点，连接PN。',steps:[]}],construct);audit.prepare(shared,'已知点A、B、P。',[],construct);
test(()=>assert.deepEqual(Array.from(shared.objects.find(n=>n.label==='N').parts),[1,2]));
test(()=>assert.equal(audit.visible(shared.objects.find(n=>n.label==='N'),2),true));
const untouched=copy(base);untouched.objects.push({id:'manualN',kind:'point',x:42,y:9,label:'N',source:'user'});const preserved=geometry.install(untouched,parts,construct);
test(()=>assert.equal(untouched.objects.find(n=>n.id==='manualN').x,42,'Manual objects are never replaced'));
test(()=>assert(preserved.conflicts.some(n=>n.label==='N'),'Preserved conflicting points are explicitly reported, not silently called consistent'));
const uncertain=copy(base),unresolved=geometry.install(uncertain,[{index:1,answer:'设N为XY中点。作点P处的切线。直线AC与AC交于点R。',steps:[]}],construct);
test(()=>assert(!uncertain.objects.some(n=>['N','R','P 点切线'].includes(n.label)),'No invented endpoints, coincident-line intersection or off-curve tangent'));
test(()=>assert(unresolved.unresolved.some(n=>n.label==='N')&&unresolved.unresolved.some(n=>n.label==='P 点切线')));
const negative=copy(base);geometry.install(negative,[{index:1,answer:'点P不在圆上，不能作点P处的切线。如果N为AB中点，讨论其它情形。',steps:[]}],construct);
test(()=>assert.equal(negative.objects.length,0,'Negative and hypothetical statements are not construction commands'));
const partial=copy(base);partial.polygons=[{id:'triangle',label:'△PAN',labels:['P','A','N']}];
const missing=audit.inspect(partial,'点P(8,6)',[{answer:'N为AB中点。在A、B两点处的切线交于点T。',steps:[]}],construct);
test(()=>assert(missing.answerMissing.includes('N')&&missing.answerMissing.includes('T')));
test(()=>assert.equal(missing.answerMissingLines.length,2));
test(()=>assert(missing.missingPolygons.includes('△PAN')));
const restored=copy(originalScene),complete=audit.inspect(restored,'',parts,construct);
test(()=>assert.equal(complete.answerMissing.length,0,JSON.stringify(complete)));
test(()=>assert.equal(complete.answerMissingLines.length,0));
test(()=>assert(complete.checks.some(n=>n.kind==='foot'&&n.passed)));
const noIntersections={type:'circle',r:1,points:{P:[3,0]},lineThrough:'point:P',theta:90,showDynamic:true,objects:[]};
test(()=>assert.deepEqual(Array.from(audit.inspect(noIntersections,'交于A、B两点',[],construct).unavailable),['A','B'],'Declared dynamic labels do not imply two real intersections'));
const parse=text=>copy(sandbox.window.DongAnswerRelations.parse(text));
const bisector=(point='D',points=['A','B','C'])=>({op:'angle_bisector',points,point});
const foot=(point,from,line)=>({op:'foot',point,from,line});
const tangent=(point,line,conic,curveType)=>({op:'tangent',point,line,conic,curveType});
for(const left of ['ABD','DBA'])for(const right of ['DBC','CBD'])for(const angles of [[left,right],[right,left]]){
  test(()=>assert.deepEqual(parse('取D在边AC上，使得∠'+angles[0]+'＝∠'+angles[1]+'。'),[bisector()]));
}
for(const [input,expected] of [
  ['取D为线段CA上一点，使 $\\angle CBD=\\angle DBA$。',bisector('D',['C','B','A'])],
  ['在弦A₁C′上取点D_2，它满足 $\\angle D_2B A_1=\\angle C^{\\prime}B D_2$。',bisector('D2',['A1','B','C′'])],
  ['D\\in\\overline{AC}，且∠ABD与∠DBC相等。',bisector()],
  ['H在直线AB上且PH⊥AB。',foot('H','P','AB')],
  ['点H为直线l上一点，且直线l垂直于PH。',foot('H','P','l')],
  ['在直线A₁B′上取H，且线段HP垂直B′A1。',foot('H','P','A1B′')],
  ['点H在直线l上，$PH\\perp l$。',foot('H','P','l')],
  ['作直线l，在点A处与圆C相切。',tangent('A','l','C','circle')],
  ['直线l在A点与抛物线C相切。',tangent('A','l','C','parabola')],
  ['直线l与椭圆C相切于点A。',tangent('A','l','C','ellipse')],
  ['直线l与圆C在点A处相切。',tangent('A','l','C','circle')],
  ['双曲线C在A点处的切线记为l。',tangent('A','l','C','hyperbola')],
  ['在A点处作直线l，与主曲线相切。',tangent('A','l',null,null)],
  ['直线l与曲线C切于A。',tangent('A','l','C',null)]
])test(()=>assert.deepEqual(parse(input),[expected],input));
for(const input of [
  '取XD在边AC上，使得∠ABD＝∠DBC。',
  '取D在边AC上，使得∠ABD＝2∠DBC。',
  '取D在边AC上，使得∠ABD＝∠DBC+10°。',
  '取D在边AC上，使得∠ADB＝∠DBC。',
  '取D在直线AC上，使得∠ABD＝∠DBC。',
  '若D在边AC上，使得∠ABD＝∠DBC。',
  'H在线段AB上且PH⊥AB。',
  'H在直线AB上且PH⊥AC。',
  'H在直线AB上且PH不垂直于AB。',
  'H在直线AB上且PH⊥AB，H在直线AB上且QH⊥AB。',
  '直线l经过A，且与圆C相切。',
  '直线l在A点与圆相切。',
  '直线l与曲线C相切于A，直线l与曲线D相切于B。'
])test(()=>assert.deepEqual(parse(input),[],input));
const midpoint=(point,ends,vertices=[])=>({op:'midpoint',point,ends,vertices});
for(const [text,spec] of [
  ['AM是三角形ABC的一条中线。',midpoint('M',['B','C'],['A'])],
  ['在△ABC中，MA为CB边上的中线。',midpoint('M',['B','C'],['A'])],
  ['在△ABC中，作中线AM。',midpoint('M',['B','C'],['A'])],
  ['作 $\\triangle A_1 B C$ 的中线 $A_1 M^{\\prime}$。',midpoint('M′',['B','C'],['A1'])],
  ['在边BC上取点M，且BM=MC。',midpoint('M',['B','C'])],
  ['M在弦CB上，且 $\\lvert MC\\rvert=\\lvert MB\\rvert$。',midpoint('M',['C','B'])],
  ['取边BC的中点M。',midpoint('M',['B','C'])],
  ['线段BC的中点记为M。',midpoint('M',['B','C'])]
])test(()=>assert.deepEqual(parse(text),[spec],text));
for(const text of [
  '若AM为△ABC的中线。','求证AM是△ABC的中线。','不要作△ABC的中线AM。',
  'AB是△ABC的中线。','PQ是△ABC的中线。','AD是△AAB的中线。',
  '在△ABC中，AM为AB边上的中线。','M在边BC上，且BM=MC+1。','M在边BC上，且BM=2MC。',
  'M在边BC上，且AM=MC。','M在圆弧BC上，且BM=MC。','M是弦BC的中点轨迹上的一点。'
])test(()=>assert.deepEqual(parse(text),[],text));
test(()=>{
  const model=copy(base),steps=['M在边CB上，且BM=MC。','AM是△ABC的中线。','PM是△PCB的中线。'];
  const response=[{index:2,steps}];
  const install=()=>geometry.install(model,response,construct);
  assert.equal(install().unresolved.length,0);
  const get=label=>model.objects.find(node=>node.label===label);
  const m=get('M');
  assert.equal(m.op,'midpoint');assert.deepEqual(Array.from(m.parts),[2]);
  for(const [label,vertex] of [['AM','A'],['PM','P']]){
    assert.equal(get(label).op,'segment');assert.deepEqual(Array.from(get(label).refs),['feature:'+vertex,m.id]);
  }
  const count=model.objects.length;
  assert.equal(install().added.length,0);assert.equal(model.objects.length,count);
  model.points.C=[4,8];
  const engine=audit.frame(model,construct).engine,position=engine.resolve(m.id);
  assert.deepEqual([position.x,position.y],[3,6]);
  const segment=engine.resolve(get('AM').id);
  assert.deepEqual([segment.o.x+segment.d.x,segment.o.y+segment.d.y],[3,6]);
});
test(()=>{
  const model=copy(base),report=geometry.install(model,[{index:1,steps:['AM是△ABC的中线。','M是AB的中点。','连接PM。']}],construct);
  assert.equal(model.objects.length,0);
  assert(report.unresolved.some(item=>item.label==='M'&&item.dependencyUnconfirmed));
});
test(()=>{
  const model=copy(base),report=geometry.install(model,[{index:1,answer:'AM为△ABZ的中线。'}],construct);
  assert.equal(model.objects.length,0);assert(report.unresolved.some(item=>item.label==='M'));
});
for(const [text,ends,line] of [
  ['线段AB的垂直平分线为l。',['A','B'],'l'],
  ['直线l是弦AB的中垂线。',['A','B'],'l'],
  ['作BA的垂直平分线l。',['B','A'],'l'],
  ['作边AB的中垂线，记为直线m。',['A','B'],'m'],
  ['设 $\\ell_1$ 为线段 $\\overline{A_1 B^{\\prime}}$ 的垂直平分线。',['A1','B′'],'l1']
])test(()=>assert.deepEqual(parse(text),[{op:'perp_bisector',ends,line}],text));
for(const text of ['若直线l是弦AB的中垂线。','求证直线l是AB的中垂线。','判断线段AB的中垂线是否为l。',
  '作AA的中垂线l。','线段AB的中垂线为l的平行线。','直线l与AB的中垂线相交。','直线l是AB的垂线。','不要作AB的中垂线l。'])
  test(()=>assert.deepEqual(parse(text),[],text));
console.log('PASS answer geometry: '+checks+' dependency, exact-frame, idempotency, shared-part, rejected-fabrication and coverage checks');
