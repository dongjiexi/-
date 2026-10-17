const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const box={window:{}};for(const f of ['math-input','equation-builder','number-display','construction-board','parabola-focal-choice'])vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist',f+'.js'),'utf8'),box);
const api=box.window.DongParabolaFocalChoice,q=require('../dist/question-bank.json').items.find(x=>x.id==='2023-ii-10').question;
const near=(a,b)=>assert(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('sourced choices are recomputed and exact radicals retained',()=>{const r=api.solve(q);assert.equal(r.answer,'正确选项为 A、C。');assert.equal(r.completion.answered,1);assert(r.parts[0].steps.join('').includes('\\frac{16}{3}'));assert(r.parts[0].steps.join('').includes('\\sqrt{3}'));});
test('changing numerical conditions recomputes rather than retrieving the original answer',()=>{
  for(const slope of [-3,-1,.5,2])for(const focus of [.25,1,3]){
    const raw=q.replace('-\\sqrt3',String(slope)).replace('(x-1)',`(x-${focus})`),s=api.infer(raw);assert(s);near(s.focus,focus);near(s.standardP,2*focus);
    for(const [x,y] of s.points){near(y*y,4*focus*x);near(y,slope*(x-focus));}
    near(s.length,4*focus*(1+1/slope**2));near(s.mid[0]+focus,s.length/2);
  }
  assert.match(api.solve(q.replace('8/3','16/3')).answer,/A、B、C/);
  assert.equal(api.solve(q.replace('p=2','p=2.0000000001')).answer,'正确选项为 C。');
});
test('unconsumed premises, invalid slopes and wrong point identities are rejected',()=>{
  for(const raw of [q.replace('经过','不经过'),q.replace('的焦点','的顶点'),q.replace('p>0','p<0'),q.replace('(x-1)','(x-0)'),q.replace('-\\sqrt3','0'),q.replace('判断下列说法','且M在第一象限。判断下列说法'),q.replace('M,N','M,M')])assert.equal(api.solve(raw),null,raw);
  const r=api.solve(q.replace('为等腰三角形','的面积为3'));assert.equal(r.completion.answered,0);assert.equal(r.parts[0].status,'partial');assert.match(r.answer,/尚未覆盖/);
});
test('dependent circle and directrix stay consistent after changing parabola size and line angle',()=>{
  const model=api.solve(q).scene;
  const engine=()=>box.window.DongConstruct.createEngine({model:()=>model,coeffs:()=>box.window.DongConstruct.conicShape(model).q,features:()=>[{name:'F',x:model.p,y:0},{name:'V',x:0,y:0},{name:'O',x:0,y:0}],origin:()=>({x:0,y:0}),angle:()=>0});
  for(const p of [.5,1,4])for(const angle of [30,60,90,120]){
    model.p=p;model.objects[0].angle=angle;const e=engine(),a=e.resolve('focal-choice-end0'),b=e.resolve('focal-choice-end1'),c=e.resolve('focal-choice-circle'),l=e.resolve('focal-choice-directrix'),t=e.resolve('focal-choice-touch');
    assert(a&&b&&c&&l&&t);near(c.r,Math.hypot(a.x-b.x,a.y-b.y)/2);near(l.o.x,-p);near(t.x,-p);near(Math.hypot(c.x-t.x,c.y-t.y),c.r);near(a.y*a.y,4*p*a.x);
  }
});
