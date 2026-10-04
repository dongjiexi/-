const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{}};
for(const name of ['math-input','number-display','equation-builder','question-parts','ellipse-distance','motion-domain','construction-board','scene-audit','inverse-locus'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/'+name+'.js'),'utf8'),sandbox);
const {DongInverseLocus:solver,DongSceneAudit:audit,DongConstruct:construct}=sandbox.window;
const question=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items.find(q=>q.id==='2025-i-18').question;
const copy=x=>JSON.parse(JSON.stringify(x)),close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);let count=0;
const result=solver.solve(question);assert(result);assert.equal(result.completion.answered,3);assert.deepEqual(Array.from(result.parts,p=>p.index),[1,201,202]);count++;
close(result.scene.a**2,9);close(result.scene.b**2,1);assert.match(result.parts[2].answer,/3\\sqrt\{2\}\+3\\sqrt\{3\}/);assert(!result.parts[2].answer.includes('7.674'),'Equality coordinates retain radicals, not rounded decimals');count++;
const diagram=audit.inspect(copy(result.scene),question,result.parts,construct);assert.equal(diagram.missing.length,0);assert.equal(diagram.invalid.length,0);count++;
const s=copy(result.scene);s.activePart=201;let frame=audit.frame(s,construct),P=frame.engine.resolve('inverse-locus-P'),R=frame.engine.resolve('inverse-locus-R');
close(P.x,3);close(P.y,1);close(R.x,9/13);close(R.y,-7/13);assert(frame.engine.moveDriver('inverse-locus-P',{x:3,y:2}));frame=audit.frame(s,construct);R=frame.engine.resolve('inverse-locus-R');close(R.x,.5);close(R.y,-.5);assert(!frame.engine.moveDriver('inverse-locus-P',{x:0,y:2}),'The excluded y axis cannot be dragged onto');count++;
s.activePart=202;frame=audit.frame(s,construct);const spec=s.inverseLocus,extent=solver.extrema(spec);close(extent.center,-4);close(extent.radius2,18);close(extent.distance2,27);count++;
for(const t of [0,.3,1.1,2.7,4.4,5.8]){
  assert(frame.engine.moveDriver('inverse-locus-P',{t})||t===0);frame=audit.frame(s,construct);P=frame.engine.resolve('inverse-locus-P');R=frame.engine.resolve('inverse-locus-R');
  close(P.x**2+(P.y+4)**2,18);close(R.y/R.x,3*P.y/P.x);close(Math.hypot(R.x,R.y+1)*Math.hypot(P.x,P.y+1),3);count++;
}
assert(!frame.engine.moveDriver('inverse-locus-P',{t:Math.PI/2}));s.activePart=201;frame=audit.frame(s,construct);close(frame.engine.resolve('inverse-locus-P').y,2);count++;
// Algebraic parameter properties, not new fabricated question-bank items.
for(const [a,b,power,factor,direction] of [[3,1,3,3,-1],[2,1,2,2,-1],[5,2,7,2,1],[3,1,3,10,-1]]){
  const ex=solver.extrema({a,b,d:direction*b,power,factor});assert(ex);
  const center=ex.center,r=Math.sqrt(ex.radius2),q=1-a*a/b**2;
  for(const {P:p,M:m} of ex.pairs){close(m.x*m.x/(a*a)+m.y*m.y/(b*b),1);close(p.x*p.x+(p.y-center)**2,ex.radius2);close(Math.hypot(p.x-m.x,p.y-m.y),ex.maximum);}
  for(const y of [-b,0,b,ex.y])assert(a*a+center*center+q*y*y-2*center*y<=ex.distance2+1e-7);
  assert.equal(ex.attained,ex.pairs.every(p=>p.P.x!==0));assert(r>0);count++;
}
const upper=question.replace('下顶点','上顶点'),up=solver.solve(upper);assert(up);close(up.scene.inverseLocus.d,1);close(solver.extrema(up.scene.inverseLocus).center,4);count++;
const renamed=question.replace(/\bA\b/g,'E').replace(/\bB\b/g,'G').replace(/\bP\b/g,'H').replace(/\bR\b/g,'J').replace(/\bM\b/g,'K').replace(/AB/g,'EG').replace(/AR/g,'EJ').replace(/AP/g,'EH').replace(/OR/g,'OJ').replace(/OP/g,'OH').replace(/PM/g,'HK');
const named=solver.solve(renamed);assert(named);assert.equal(named.scene.inverseLocus.P,'H');assert.equal(named.scene.inverseLocus.R,'J');count++;
for(const altered of [question+'\n（3）求面积。',question.replace('最大值。','最大值，并求面积。'),question.replace('不在 $y$ 轴上','在 $y$ 轴上'),question.replace('射线 $AP$','直线 $AP$'),question.replace('=3$。','=0$。'),question.replace('的离心率为','且经过原点，的离心率为'),question.replace('右顶点','左焦点'),question.replace('的 $3$ 倍','的 $未知$ 倍')]){
  assert.equal(solver.solve(altered),null,'Uncovered or incompatible constraints are not silently ignored');count++;
}
const boundary=solver.solve(question.replace('的 $3$ 倍','的 $10$ 倍'));assert(boundary);assert.match(boundary.parts[2].answer,/上确界|没有最大值/);assert(!solver.extrema(boundary.scene.inverseLocus).attained);count++;
const negative=solver.solve(question.replace('的 $3$ 倍','的 $-2$ 倍'));assert(negative);assert.equal(negative.scene.inverseLocus.factor,-2);count++;
console.log('PASS inverse locus: '+count+' sourced, incidence, profile, symbolic-bound, scope and exact-display checks');
