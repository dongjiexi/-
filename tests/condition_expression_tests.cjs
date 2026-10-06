/* Reworded sourced premises and explicit parameter/adverse-clause properties.
 * These are parser fixtures, not new items or fabricated examination questions. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={window:{}};for(const f of ['math-input','number-display','equation-builder','question-parts','ellipse-distance','motion-domain','construction-board','scene-audit','basic-conditions','ellipse-area-chord'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/'+f+'.js'),'utf8'),box);
const {DongBasicConditions:basic,DongEllipseAreaChord:chord,DongSceneAudit:audit,DongConstruct:construct}=box.window;
const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items,q=id=>bank.find(q=>q.id===id).question,copy=x=>JSON.parse(JSON.stringify(x)),close=(a,b)=>assert(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)));let count=0;
const original=q('2025-ii-16'),split=box.window.DongQuestionParts.splitParts(original),head=split[0].question.slice(0,-split[0].body.length),sourceBody=basic.plain(split[1].body);
const bodyClauses=['过点(0,-2)的直线l与C交于A,B两点','O为坐标原点','若S△OAB=sqrt(2)','求|AB|'];
const wrap=body=>head+'\n（1）求C的方程；\n（2）'+body+'。';
function verify(input){const r=chord.solve(input);assert(r,'Recognise: '+input);assert.equal(r.completion.answered,2);assert.match(r.parts[1].answer,/\\sqrt\{5\}/);const spec=r.scene.areaChord;
 for(const solution of spec.solutions){const scene=copy(r.scene),t=chord.parameter(spec,solution);scene.objects[0].t=t;scene.objects[0].motionDomain={parameter:{min:t,max:t}};const f=audit.frame(scene,construct),A=f.engine.resolve('area-chord-A'),B=f.engine.resolve('area-chord-B');assert(A&&B);close(Math.abs(A.x*B.y-A.y*B.x)/2,spec.area);close(Math.hypot(A.x-B.x,A.y-B.y)**2,solution.length2);const expected=solution.points.map(p=>chord.world(spec,p));close(A.x,expected[0].x);close(A.y,expected[0].y);close(B.x,expected[1].x);close(B.y,expected[1].y);assert(chord.matches(spec,solution));}
 for(const key of ['missing','answerMissing','missingLines','answerMissingLines','invalid','missingPolygons'])assert.equal(audit.inspect(copy(r.scene),input,r.parts,construct)[key].length,0,key);count++;return r;
}
verify(original);verify(wrap(sourceBody.replace(/[。;]$/,'')));
for(const order of [[0,1,2,3],[1,0,2,3],[2,1,0,3],[0,2,1,3],[1,2,0,3],[2,0,1,3]])for(const delimiter of ['，','；','。'])verify(wrap(order.map(i=>bodyClauses[i]).join(delimiter)));
for(const [before,after] of [['求|AB|','求弦AB的长度'],['求|AB|','求出AB长'],['S△OAB=sqrt(2)','三角形OAB的面积等于sqrt(2)'],['S△OAB=sqrt(2)','△BOA面积为sqrt(2)'],['与C交于','与椭圆C相交于'],['过点(0,-2)的','过定点(0,-2)'],['A,B两点','A、B两点']])verify(wrap(bodyClauses.join(',').replace(before,after)));
for(const body of [bodyClauses.join(',')+',l的斜率大于0',bodyClauses.join(',')+',直线l斜率>0',bodyClauses.join(',')+',l斜率>=0',bodyClauses.join(',')+',l斜率小于0',bodyClauses.join(',')+',A在第一象限',bodyClauses.join(',')+',其中B在第一象限',bodyClauses.join(',')+',A在第一象限且B在第四象限']){
 const r=verify(wrap(body)),spec=r.scene.areaChord;assert.equal(spec.solutions.length,1);assert.equal(spec.constraints.length,body.includes('且')?2:1);assert(r.parts[1].steps.some(s=>s.includes('附加条件逐个回代')));
}
// Horizontal-axis anchor: internal x=ky+d has reciprocal physical slope.
const swapped=wrap(bodyClauses.join(',').replace('(0,-2)','(-2,0)')+',l斜率大于0'),r=chord.solve(swapped);assert(r);assert.equal(r.scene.areaChord.solutions.length,1);const spec=r.scene.areaChord;close(chord.physicalSlope(spec,spec.solutions[0]),Math.SQRT1_2);assert(spec.swapped);count++;
const header=basic.plain(head),decl='椭圆C:x^2/a^2+y^2/b^2=1(a>b>0)',e='离心率为sqrt(2)/2',L='长轴长为4';
for(const h of [decl+'的'+e+'，'+L,decl+'，'+L+'；其'+e,decl+'的'+L+'。'+e,decl+'，长轴的长度为4且'+e]){
 const r=basic.solve(h+'，求出椭圆C的标准方程。');assert(r);close(r.scene.a**2,4);close(r.scene.b**2,2);verify(wrap(bodyClauses.join(',')).replace(head,h+'。'));count++;
}
assert(basic.solve(q('2025-beijing-19-1').replace('椭圆上的点到两焦点','椭圆上任意一点到两个焦点').replace('求椭圆方程','写出椭圆的标准方程')));count++;
for(const clause of ['l斜率大于2','l斜率小于-2','A在第一象限且B在第一象限','A在第二象限且B在第四象限','m的斜率大于0','P在第一象限','A在第一象限且A在第二象限','A在坐标轴上','OA垂直OB','直线l不经过原点','若三角形OAB的周长为8','求AB长度与斜率','求圆D的方程','l斜率>k','l斜率大于0且l斜率小于0',bodyClauses[0],bodyClauses[1],bodyClauses[2],bodyClauses[3]]){assert.equal(chord.solve(wrap(bodyClauses.join(',')+','+clause)),null,'Do not certify ambiguous/unsupported/inconsistent clause: '+clause);count++;}
for(const extra of ['且经过点(1,1)','且短轴长为3','且离心率为1/2','且长轴长为6','且焦点在y轴','且求椭圆周长']){assert.equal(basic.solve(header+extra+'，求C的方程。'),null);assert.equal(chord.solve(wrap(bodyClauses.join(',')).replace(head,header+extra+'。')),null);count++;}
for(const [input,invalid] of [['过点(0,-2)的直线l与C交于A,B两点',false],['若S△OAB=sqrt(2),O为坐标原点',false],['过点(0,-2的直线l',true],['S△OAB=sqrt(2))',true]]){assert.equal(basic.clauses(input)===null,invalid);count++;}
const quadrant=chord.recognise(wrap(bodyClauses.join(',')+',A在第一象限'));assert(quadrant);const legal=quadrant.solutions[0],wrong={...legal,points:[...legal.points].reverse()};assert(chord.matches(quadrant,legal));assert(!chord.matches(quadrant,wrong));assert(!chord.poseMatches(quadrant,chord.world(quadrant,wrong.points[0]),chord.world(quadrant,wrong.points[1])));count++;
assert(!chord.matches({...quadrant,constraints:[{kind:'quadrant',label:quadrant.A,value:1}]},{points:[{x:1,y:1e-16},{x:2,y:2}]}),'Round-off on an axis must not certify a quadrant');count++;
for(const invalid of ['xy-1=0','2xy-1=0','x2y-1=0','x1-1=0','x+1/0y-1=0']){assert.equal(basic.linear(invalid),null);assert.equal(basic.solve(q('2022-beijing-3').replace('2x+y-1=0',invalid)),null);count++;}
for(const clause of ['A在第一象限','l斜率大于0']){assert.equal(chord.solve(wrap(bodyClauses.join(',')+','+clause+','+clause)),null);count++;}
const radicalBound=chord.solve(wrap(bodyClauses.join(',')+',l斜率不大于sqrt(2)'));assert(radicalBound);const display=chord.conditionDisplay(radicalBound.scene.areaChord.constraints[0]);assert.match(display.valueTex,/\\sqrt\{2\}/);assert.doesNotMatch(radicalBound.parts[1].steps.join(' '),/1\.414213/);count++;
console.log('PASS condition expressions: '+count+' equivalent wording, entity binding, physical slope, named-quadrant and complete-clause checks');
