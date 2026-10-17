const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={window:{}};
for(const file of ['math-input.js','ellipse-focal-chord.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),sandbox);
const api=sandbox.window.DongEllipseFocusChord;
const question=(x=4,y=3,side='右')=>`椭圆 C: x²/${x}+y²/${y}=1，过${side}焦点 F 的直线 l 与 C 交于 A、B 两点，求弦长 |AB| 的取值范围。`;
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let samples=0;
for(const [x,y]of [[4,3],[25,9],[9,25],[2,1],[1,2],[100,0.25]])for(const side of (x>y?['左','右']:['上','下'])){
  const r=api.rangeModel(question(x,y,side));assert(r);
  const scene={model:{type:'ellipse',orientation:r.vertical?'vertical':'horizontal'},values:{a:r.a,b:r.b,h:0,k:0}};
  const result=api.solveRange(scene,question(x,y,side),{index:0});assert.equal(result.status,'answered');assert.equal(result.checks.length,2);
  for(let angle=0;angle<=180;angle++){
    const t=angle*Math.PI/180,dx=Math.cos(t),dy=Math.sin(t),f=r.vertical?[0,r.sign*r.c]:[r.sign*r.c,0];
    const A=dx*dx/x+dy*dy/y,B=2*(f[0]*dx/x+f[1]*dy/y),C=f[0]**2/x+f[1]**2/y-1,D=B*B-4*A*C;
    assert(D>0);const length=Math.sqrt(D)/A;assert(length>=r.minimum-1e-8&&length<=r.maximum+1e-8);
    if(angle===0)near(length,r.vertical?r.minimum:r.maximum);
    if(angle===90)near(length,r.vertical?r.maximum:r.minimum);
    samples++;
  }
}
near(api.rangeModel(question()).minimum,3);near(api.rangeModel(question()).maximum,4);
assert(api.rangeModel(question().replace('x²/4+y²/3','\\dfrac{x^{2}}{4}+\\frac{y^2}{3}')));
for(const q of [question().replace('的直线','且斜率大于0的直线'),question().replace('的直线','且不与长轴重合的直线'),question()+'且A在第一象限。',question().replace('范围','范围及面积最大值'),question(3,4,'右'),question(4,4),question().replace('A、B','F、B'),question().replace('与 C','与 D'),question().replace('x²/4','(x-1)²/4')])assert.equal(api.rangeModel(q),null,q);
const conflict={model:{type:'ellipse',points:{F:[0,0]}},values:{a:2,b:Math.sqrt(3)}};assert.equal(api.solveRange(conflict,question(),{index:0}),null);
console.log(`PASS focal range: ${samples} independent quadratic samples, both axes/foci, exact endpoints, LaTeX and unsupported-condition rejection`);
