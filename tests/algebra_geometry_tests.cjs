const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const box={window:{}};
for(const name of ['math-input','equation-builder','number-display','construction-board','algebra-geometry'])vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist',name+'.js'),'utf8'),box);
const api=box.window.DongAlgebraGeometry,items=require('../dist/question-bank.json').items;
const vector=items.find(x=>x.id==='2024-ii-3').question,ellipse=items.find(x=>x.id==='2023-ii-5').question;
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
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
