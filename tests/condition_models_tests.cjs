const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={window:{}};for(const f of ['math-input','number-display','equation-builder','question-parts','ellipse-distance','motion-domain','construction-board','scene-audit','basic-conditions','ellipse-area-chord','ellipse-tangent-ratio','hyperbola-asymptote-midpoint'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/'+f+'.js'),'utf8'),box);
const {DongBasicConditions:basic,DongEllipseAreaChord:chord,DongSceneAudit:audit,DongConstruct:construct}=box.window,copy=x=>JSON.parse(JSON.stringify(x)),close=(a,b)=>assert(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items,q=id=>bank.find(q=>q.id===id).question;let count=0;
const ellipseExcerpt=q('2025-beijing-19-1').split('\n（2）')[0].replace('\n（1）求椭圆 $E$ 的方程；','求椭圆方程。');
const circle=basic.solve(q('2022-beijing-3'));assert(circle);close(circle.scene.h,.5);assert.match(circle.answer,/a=\\frac\{1\}\{2\}/);assert(circle.scene.lines.some(l=>l.label==='对称轴'));count++;
const para=basic.solve(q('2025-beijing-11'));assert(para);close(para.scene.p,3);assert.match(para.answer,/p=6/);assert.match(para.answer,/y\^2=12x/);count++;
const ellipse=basic.solve(ellipseExcerpt);assert(ellipse);close(ellipse.scene.a**2,4);close(ellipse.scene.b**2,2);count++;
for(const r of [circle,para,ellipse]){const report=audit.inspect(copy(r.scene),r.restatement,r.parts,construct);assert.equal(report.invalid.length,0);const f=audit.frame(r.scene,construct);if(r.scene.type==='circle'){const line=f.engine.resolve('basic-symmetry-axis');assert(line?.type==='line');close((r.scene.h-line.o.x)*line.d.y-(r.scene.k-line.o.y)*line.d.x,0);}count++;}
const original=q('2025-ii-16'),result=chord.solve(original);assert(result);assert.equal(result.completion.answered,2);assert.match(result.parts[1].answer,/\\sqrt\{5\}/);assert.match(result.parts[1].steps.join(' '),/面积为0|韦达/);assert.equal(result.scene.areaChord.solutions.length,2);count++;
const s=audit.prepare(copy(result.scene),original,result.parts);let frame=audit.frame(s,construct),A=frame.engine.resolve('area-chord-A'),B=frame.engine.resolve('area-chord-B');close(A.x*A.x/4+A.y*A.y/2,1);close(B.x*B.x/4+B.y*B.y/2,1);close(Math.abs(A.x*B.y-A.y*B.x)/2,Math.sqrt(2));close(Math.hypot(A.x-B.x,A.y-B.y),Math.sqrt(5));assert(!frame.engine.moveDriver('area-chord-A',{t:1}),'Given area is fixed until explicit exploration');count++;
const diagram=audit.inspect(copy(result.scene),original,result.parts,construct);for(const field of ['missing','answerMissing','missingLines','answerMissingLines','invalid','missingPolygons'])assert.equal(diagram[field].length,0,field);count++;
for(const [a,b,d,S] of [[2,Math.sqrt(2),-2,1],[2,Math.sqrt(2),2,Math.sqrt(2)],[3,2,1,.5],[3,2,2,1],[2,2,-3,1],[2,Math.sqrt(2),-2,.01]]){
 const rows=chord.candidates(a,b,d,S);assert(rows?.length);for(const r of rows){assert(r.D>0&&r.w>d*d);for(const p of r.points)close(p.x*p.x/(a*a)+p.y*p.y/(b*b),1);close(Math.abs(r.points[0].x*r.points[1].y-r.points[0].y*r.points[1].x)/2,S);close(r.length2,(1+r.k2)*(2*S/Math.abs(d))**2);assert(Math.hypot(r.points[0].x,r.points[0].y-d)>1e-8);}count++;
}
const four=chord.candidates(2,Math.sqrt(2),-2,1);assert.equal(four.length,4);assert(new Set(four.map(r=>r.length2.toFixed(8))).size===2,'Two different positive slope magnitudes can give different lengths');count++;
for(const args of [[2,1,2,2],[2,1,.2,1],[2,1,0,1],[2,1,2,0],[-2,1,2,1],[2,1,2,NaN]]){assert(!chord.candidates(...args)?.length);count++;}
for(const altered of [original+'\n（3）求面积。',original.replace('求 $|AB|$','求 $|AB|$ 与斜率'),original.replace('$(0,-2)$','$(1,-2)$'),original.replace('S_{\\triangle OAB}','S_{\\triangle PAB}'),original.replace('O$ 为坐标原点','P$ 为坐标原点'),original.replace('长轴长为 $4$','短轴长为 $4$'),original.replace('两点，','两点，且 $OA$ 垂直 $OB$，')]){assert.equal(chord.solve(altered),null,'Uncovered premises/goals are not silently discarded');count++;}
for(const altered of [q('2022-beijing-3')+'再求圆面积。',q('2022-beijing-3').replace('2x+y-1','y-1'),q('2025-beijing-11').replace('则 $p=$______','求焦点与准线'),ellipseExcerpt.replace('求椭圆方程','求椭圆方程与周长'),ellipseExcerpt.replace('离心率为 $\\dfrac{\\sqrt2}2$','离心率为 $2$'),ellipseExcerpt.replace('求椭圆方程','求 $Z$ 的方程')]){assert.equal(basic.solve(altered),null);count++;}
const variants=[q('2025-ii-16').replace('$(0,-2)$','$(0,2)$'),q('2025-ii-16').replace('$(0,-2)$','$(-2,0)$'),q('2025-ii-16').replace('x^2}{a^2}+\\dfrac{y^2}{b^2}','y^2}{a^2}+\\dfrac{x^2}{b^2}'),q('2025-ii-16').replace('\\sqrt2$，求','1$，求')];
for(const input of variants){const r=chord.solve(input);assert(r);const spec=r.scene.areaChord;for(const solution of spec.solutions){const scene=copy(r.scene),t=chord.parameter(spec,solution),driver=scene.objects[0];driver.t=t;driver.motionDomain={parameter:{min:t,max:t}};const f=audit.frame(scene,construct),A=f.engine.resolve(driver.id),B=f.engine.resolve('area-chord-B');assert(A&&B);close(Math.abs(A.x*B.y-A.y*B.x)/2,spec.area);close(Math.hypot(A.x-B.x,A.y-B.y)**2,solution.length2);assert.equal(audit.inspect(scene,input,r.parts,construct).invalid.length,0);}count++;}
const named=original.replace(/\bC\b/g,'E').replace(/\bA\b/g,'P').replace(/\bB\b/g,'Q').replace(/\bO\b/g,'Z').replace(/OAB/g,'ZPQ').replace(/AB/g,'PQ');assert(chord.solve(named));count++;
const vertical=basic.solve(ellipseExcerpt.replace('x^2}{a^2}+\\dfrac{y^2}{b^2}','y^2}{a^2}+\\dfrac{x^2}{b^2}'));assert(vertical);assert.equal(vertical.scene.orientation,'vertical');close(vertical.scene.a,2);count++;
const changedPara=basic.solve(q('2025-beijing-11').replace('y^2=2px','x^2=-4py'));assert(changedPara);close(changedPara.scene.value,3);assert.equal(changedPara.scene.direction,-1);assert.equal(changedPara.scene.orientation,'vertical');count++;
const changedCircle=basic.solve(q('2022-beijing-3').replace('2x+y-1','x+2y-1').replace('(x-a)^2+y^2','x^2+(y-a)^2'));assert(changedCircle);close(changedCircle.scene.k,.5);count++;
const tangentQuestion=q('2025-beijing-19-1'),solveRatio=box.window.DongEllipseTangentRatio.solve;
const tangent=solveRatio(tangentQuestion);assert(tangent);assert.equal(tangent.completion.answered,2);
assert.match(tangent.parts[1].answer,/\\frac\{S_1\}\{S_2\}=\\frac\{\|OA\|\}\{\|OB\|\}/);
const tangentReport=audit.inspect(copy(tangent.scene),tangent.restatement,tangent.parts,construct);
for(const field of ['missing','answerMissing','missingLines','answerMissingLines','invalid','missingPolygons'])assert.equal(tangentReport[field].length,0,field);
for(const [d,sign] of [[2,0],[3,-1],[1.5,1]]){
 const changed=tangentQuestion.replace('y=2$','y='+d+'$').replace('y=-2$','y=-'+d+'$');
 const solved=solveRatio(changed);assert(solved);assert.equal(solved.scene.lines[0].b,d);
 if(sign)assert(solved.parts[1].answer.includes(sign<0?'}>\\frac{':'}<\\frac{'));
 for(const t of [-2.2,-.8,.3,2.1]){
  const scene=copy(solved.scene);
  scene.objects.find(n=>n.id==='tangent-ratio-driver').t=t;
  const e=audit.frame(scene,construct).engine;
  const resolve=name=>e.resolve('tangent-ratio-'+name);
  const M=resolve('driver'),A=resolve('upper-point'),B=resolve('lower-point'),H=resolve('foot'),l=resolve('tangent');
  close(M.x**2/4+M.y**2/2,1);close(A.y,d);close(B.y,-d);
  for(const P of [A,B,H])close(M.x*P.x/4+M.y*P.y/2,1);
  close(H.x*l.d.x+H.y*l.d.y,0);
  const area=P=>Math.abs(M.x*P.y-M.y*P.x),length=P=>Math.hypot(P.x,P.y);
  const ratio=length(A)/length(B)-area(A)/area(B);
  if(sign)assert.equal(Math.sign(ratio),sign*Math.sign(M.y));else close(ratio,0);
  count++;
 }
}
const comparison=tangentQuestion.split('\n（2）')[1];
const direct='已知椭圆 $E:x^2/4+y^2/2=1$。'+comparison;
const one=solveRatio(direct);
assert(one);assert.equal(one.completion.answered,1);assert.equal(one.parts[0].answer,tangent.parts[1].answer);
const verticalRatio=solveRatio(direct.replace('x^2/4+y^2/2','x^2/2+y^2/4')
 .replace('x_0x+2y_0y','2x_0x+y_0y').replace('y=2$','y=3$').replace('y=-2$','y=-3$'));
assert(verticalRatio);assert.equal(verticalRatio.scene.orientation,'vertical');assert.match(verticalRatio.answer,/<\\frac/);count+=2;
const rephrased=tangentQuestion.replace('点 $M(x_0,y_0)\\ (x_0\\ne0)$ 为椭圆 $E$ 上一点','椭圆 $E$ 上一点 $T(x_1,y_1)$ 满足 $x_1\\ne0$')
 .replace('直线 $x_0x+2y_0y-4=0$','椭圆 $E$ 在点 $T$ 处的切线').replaceAll('OM','OT');
assert.equal(solveRatio(rephrased).scene.objects.find(o=>o.op==='point_on').label,'T');count++;
for(const bad of [
 tangentQuestion.replace('2y_0y','3y_0y'),
 tangentQuestion.replace('\\ (x_0\\ne0)',''),
 tangentQuestion.replace('y=-2$', 'y=-3$'),
 tangentQuestion.replace('y=2$', 'y=1$').replace('y=-2$', 'y=-1$'),
 tangentQuestion.replace('|OA|}{|OB|}', '|OB|}{|OA|}'),
 tangentQuestion.replace('的大小。','的大小，并求切线斜率。')
]){assert.equal(solveRatio(bad),null);count++;}

const solveMidpoint=box.window.DongHyperbolaAsymptoteMidpoint.solve;
const hyperbolaQuestion=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/sourced-exam-additions.json'),'utf8')).items.find(item=>item.id==='2022-ii-21-full').question;
const hyperbolaCases=[
 [hyperbolaQuestion,2,Math.sqrt(3)],
 [q('2022-ii-21-1'),2,Math.sqrt(3)],
 [hyperbolaQuestion.replace('F(2,0)','F(3,0)').replaceAll('√3','2').replaceAll('P','J').replaceAll('Q','K').replaceAll('M','L'),3,2]
];
for(const [text,c,s] of hyperbolaCases){
 const solved=solveMidpoint(text);assert(solved);assert.equal(solved.completion.answered,2);
 assert.equal(solved.parts[1].steps.filter(step=>step.includes('⇒')).length,3);
 const a=solved.scene.a,b=solved.scene.b;
 close(a*a+b*b,c*c);close(b/a,s);
 const auditResult=audit.inspect(copy(solved.scene),text,solved.parts,construct);
 for(const key of ['missing','answerMissing','missingLines','answerMissingLines','invalid','unavailable'])assert.equal(auditResult[key].length,0,key);
 const driver=solved.scene.objects.find(node=>node.op==='point_on'),domain=driver.motionDomain.parameter;
 for(let i=0;i<=16;i++){
  driver.t=domain.min+(domain.max-domain.min)*i/16;
  const e=audit.frame(solved.scene,construct).engine;
  const read=key=>e.resolve('asymptote-midpoint-'+key);
  const A=read('upper'),B=read('lower'),M=read('middle'),P=read('p'),Q=read('q');
  close(A.y,s*A.x);close(B.y,-s*B.x);
  close((A.x-c)*B.y-(B.x-c)*A.y,0);
  close(2*M.x,A.x+B.x);close(2*M.y,A.y+B.y);
  close(Math.hypot(M.x-A.x,M.y-A.y),Math.hypot(M.x-B.x,M.y-B.y));
  assert(P.x>Q.x&&Q.x>0&&P.y>0);
  for(const p of [P,Q])close((p.x/a)**2-(p.y/b)**2,1);
  close(P.y-M.y,-s*(P.x-M.x));close(Q.y-M.y,s*(Q.x-M.x));
  close((A.x-B.x)*(P.y-Q.y)-(A.y-B.y)*(P.x-Q.x),0);
  count++;
 }
}
for(const bad of [
 hyperbolaQuestion.replace('x₁>x₂>0','x₂>x₁>0'),
 hyperbolaQuestion.replace('斜率为 −√3','斜率为 √3'),
 hyperbolaQuestion.replace('PQ ∥ AB','PQ ⊥ AB'),
 hyperbolaQuestion.replace('证明另外一个成立：','并求一个最大值：'),
 hyperbolaQuestion.replace('③|MA|=|MB|','③|PA|=|PB|'),
 hyperbolaQuestion+'再求四边形面积。'
]){assert.equal(solveMidpoint(bad),null);count++;}
console.log('PASS condition models: '+count+' sourced, parameter, candidate completeness, domain, axis and scope checks');
