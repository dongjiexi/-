const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const box={window:{}};
for(const name of ['math-input','equation-builder','number-display','construction-board','algebra-geometry'])vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist',name+'.js'),'utf8'),box);
const api=box.window.DongAlgebraGeometry,items=require('../dist/question-bank.json').items;
const vector=items.find(x=>x.id==='2024-ii-3').question,ellipse=items.find(x=>x.id==='2023-ii-5').question;
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('equivalent wording and mathematical typography retain the same conditions',()=>{
 for(const prefix of ['','已知','设'])for(const join of [',','、','和','与']){
  const q=prefix+vector.replace('向量','平面向量').replace('a,','a'+join).replace('，求','；求').replace('|$。','|$的值。');
  const r=api.solve(q);assert(r,q);near(Math.hypot(...r.scene.points.B),Math.SQRT1_2);
 }
 for(const focus of ['的左右焦点为','的左右焦点分别为','的左、右焦点分别为']){
  const q='已知'+ellipse.replace('的左右焦点记为',focus).replace('截椭圆于','与椭圆C相交于').replace('$A,B$；','$A,B$两点，').replace('求 $m$','求实数 $m$的值');
  const r=api.solve(q);assert(r,q);near(r.scene.areaRatioCandidates[0],-Math.sqrt(2)/3);
 }
 const radical=api.solve(vector.replace('|=1$', '|=\\sqrt{2}$'));assert(radical);near(Math.hypot(...radical.scene.points.B),Math.sqrt(1/3));
 const coefficient=api.solve(vector.replace('+2\\boldsymbol', '+\\sqrt{2}\\boldsymbol'));assert(coefficient);near(Math.hypot(...coefficient.scene.points.B),Math.sqrt(3/(2+Math.SQRT2)));
 const fraction=api.solve(vector.replace('|=1$', '|=\\dfrac{1}{2}$'));assert(fraction);near(Math.hypot(...fraction.scene.points.B),Math.sqrt(5/8));
 const latex=api.solve(ellipse.replace('x^2/3+y^2','\\dfrac{x^{2}}{3}+\\frac{y^{2}}{1}'));assert(latex);near(latex.scene.areaRatioCandidates[0],-Math.sqrt(2)/3);
});
test('equivalent wording never removes a conflicting entity or additional constraint',()=>{
 for(const q of [ellipse.replace('截椭圆于','与椭圆D交于'),ellipse.replace('截椭圆于','不与椭圆C交于'),ellipse.replace('的左右焦点记为','的上下焦点为'),ellipse+'再求弦长。',vector.replace('垂直','不垂直'),vector.replace('\\perp','不\\perp')]){
  if(q!==vector)assert.equal(api.solve(q),null,q);
 }
});
test('source vector premises produce consistent representative vectors and drawable arrows',()=>{
 const r=api.solve(vector);assert(r);assert.match(r.answer,/sqrt/);
 const m=r.scene,[bx,by]=m.points.B;near(bx*bx+by*by,.5);near((bx-2)*bx+by*by,0);
 const e=box.window.DongConstruct.createEngine({model:()=>m,features:()=>Object.entries(m.points).map(([name,[x,y]])=>({name,x,y})),origin:()=>({x:0,y:0}),angle:()=>0});
 for(const o of m.objects){const s=e.resolve(o.id);assert(s);assert.equal(s.vector,true);assert.equal(s.segment,true);}
});
test('vector conditions are recalculated and unsupported premises are not discarded',()=>{
 const r=api.solve(vector.replace('=2$', '=3$'));assert(r);near(Math.hypot(...r.scene.points.B),Math.sqrt(4/3));
 assert.equal(api.solve(vector+'另有未知条件。'),null);
 assert.equal(api.solve(vector.replace('=2$', '=9$')),null);
});
test('ellipse area ratio filters nonintersecting candidate',()=>{
 const r=api.solve(ellipse);assert(r);assert.equal(r.scene.areaRatioCandidates.length,1);near(r.scene.areaRatioCandidates[0],-Math.sqrt(2)/3);
 assert(r.parts[0].steps.some(s=>s.includes('排除')));
 for(const ratio of [1,2,3,5,10]){const x=api.solve(ellipse.replace('=2S',`=${ratio}S`));assert(x);if(ratio===10)assert.equal(x.scene.areaRatioCandidates.length,2);for(const m of x.scene.areaRatioCandidates){near(Math.abs(m-Math.sqrt(2)),ratio*Math.abs(m+Math.sqrt(2)));assert(m*m<4);}}
 assert.equal(api.solve(ellipse+'且A在第一象限。'),null);
});
