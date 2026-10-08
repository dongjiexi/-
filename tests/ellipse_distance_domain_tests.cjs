/* The user's original is the baseline, NOT a newly invented exam item.
 * Added clauses below are labelled domain/property and rejection fixtures. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={window:{}};
for(const f of ['math-input','number-display','equation-builder','question-parts','motion-domain','ellipse-distance','basic-conditions'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/'+f+'.js'),'utf8'),box);
const api=box.window.DongEllipseDistance,basic=box.window.DongBasicConditions,close=(a,b)=>assert(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),copy=v=>JSON.parse(JSON.stringify(v));let count=0;
const original='在平面直角坐标系中，椭圆 C：x²/4＋y²＝1 上有一动点 P，定点 A 的坐标为 (0，2)。求 PA 的最大值，并写出此时点 P 的坐标。';
const scene=()=>({model:{type:'ellipse',orientation:'horizontal',points:{A:[0,2]},objects:[{id:'moving-P',kind:'construction',label:'P',op:'point_on',refs:['$conic'],t:.7}]},values:{a:2,b:1,h:0,k:0}});
function solve(input){const s=scene(),parts=box.window.DongQuestionParts.splitParts(input);return{scene:s,parts:parts.map(p=>api.install(s,input,p))};}
const full=solve(original);assert(full.parts[0],basic.plain(original));assert.match(full.parts[0].answer,/2\\sqrt\{21\}/);assert(full.parts[0].checks.every(c=>c.status==='verified'));count++;
const calc=d=>api.compute({type:'ellipse'},{a:2,b:1},[0,2],d);
for(const q of [1,2]){const r=calc({quadrant:q});assert(r);assert(!r.min.attained&&!r.max.attained);close(r.min.squared,1);close(r.max.squared,8);assert.equal(r.min.points.length+r.max.points.length,0);count++;}
for(const q of [3,4]){const r=calc({quadrant:q});assert(r);assert(!r.min.attained&&r.max.attained);close(r.min.squared,8);close(r.max.squared,28/3);assert.equal(r.max.points.length,1);assert(r.max.points[0].x*(q===3?-1:1)>0);count++;}
for(const [domain,min,max,minClosed,maxClosed] of [
 [{y:{min:0,minClosed:true}},1,8,true,true],
 [{y:{min:0,minClosed:false}},1,8,true,false],
 [{y:{min:-.5,max:.5}},21/4,37/4,true,true],
 [{x:{min:2,max:2}},8,8,true,true],
 [{x:{min:2,minClosed:false}},null,null],
 [{y:{min:2}},null,null],
 [{x:{min:1,max:0}},null,null],
 [{parameter:{min:0,max:1}},null,null],
 [{unknown:true},null,null],
 [[],null,null],
 [{excludeAxes:['x','y']},1,28/3,false,true],
 [{excludePoints:[[2,0],[-2,0]]},1,28/3,true,true]
]){const r=calc(domain);if(min==null)assert.equal(r,null);else{assert(r);close(r.min.squared,min);close(r.max.squared,max);assert.equal(r.min.attained,minClosed);assert.equal(r.max.attained,maxClosed);}count++;}
const excluded=calc({excludePoints:[[2*Math.sqrt(5)/3,-2/3],[-2*Math.sqrt(5)/3,-2/3]]});assert(!excluded.max.attained);close(excluded.max.squared,28/3);count++;
const circle=api.compute({type:'ellipse'},{a:2,b:2},[0,0],{quadrant:1});assert(circle.constantDistance&&circle.min.attained&&circle.max.attained);close(circle.min.squared,4);count++;
const disconnected=api.compute({type:'ellipse'},{a:2,b:1},[0,3],{x:{min:1,max:1.5}});assert.equal(disconnected.ranges.length,2,'A disconnected image must not be filled in as one interval');count++;
// Dense sweep is an independent property test only, never the production proof.
for(const orientation of ['horizontal','vertical'])for(const source of [[0,2],[3,0]])for(const domain of [{quadrant:1},{quadrant:3},{x:{min:.2,max:1.4}},{y:{min:-.7,max:.3,minClosed:false}}]){
 const m={type:'ellipse',orientation},v={a:2,b:1},r=api.compute(m,v,source,domain);assert(r);
 for(let i=0;i<4000;i++){const t=i*Math.PI/2000,p={x:r.rx*Math.cos(t),y:r.ry*Math.sin(t)};if(!box.window.DongMotionDomain.accepts({motionDomain:domain},p,{t}))continue;const value=(p.x-source[0])**2+(p.y-source[1])**2;assert(value>=r.min.squared-1e-7&&value<=r.max.squared+1e-7);assert(r.ranges.some(b=>value>=b.min-1e-7&&value<=b.max+1e-7));}count++;
}
for(const [extra,goal,pattern] of [
 ['P在第一象限','求PA的最大值','不存在最大值'],
 ['P在第三象限','求PA的最大值','2\\sqrt'],
 ['P的纵坐标大于0','求PA的取值范围','\\sqrt'],
 ['P的纵坐标不小于0','求PA的取值范围','\\sqrt'],
 ['P的横坐标为1','求PA的最大值','\\sqrt'],
 ['P不在y轴上','求PA的最值','不存在最小值']
]){const input=original.slice(0,original.indexOf('求'))+extra+'。'+goal+'。',r=solve(input);assert(r.parts[0],input);assert(r.parts[0].answer.includes(pattern),r.parts[0].answer);count++;}
for(const extra of ['P在第一象限，P在第一象限','P的纵坐标大于0，P的纵坐标大于1','P在第一象限，P的纵坐标小于0','P在圆D上','P在某弧上','PA垂直x轴','P的横坐标为u','P的纵坐标大于0，N(1,2)']){const input=original.slice(0,original.indexOf('求'))+extra+'。求PA的最大值。';assert.equal(solve(input).parts[0],null,input);count++;}
for(const goal of ['求PA的最大值及椭圆的面积','求PA的最大值并求P处切线方程','求PA的最大值的平方和','求PA与PB的最大值','求未知变量t的最值']){const input=original.slice(0,original.indexOf('求'))+goal+'。';assert.equal(solve(input).parts[0],null,input);count++;}
for(const input of [original.replace('x²/4','x²/9'),original.replace('x²/4','x²/4+xy'),original.replace('(0，2)','(0，3)'),original.replace('求 PA','P的纵坐标x大于0。求 PA')]){assert.equal(solve(input).parts[0],null,'Unknown/mismatched curve, coordinate or axis name cannot be ignored');count++;}
const multi=solve(original.slice(0,original.indexOf('求'))+'（1）若P在第一象限，求PA的最大值。（2）若P在第三象限，求PA的最大值。');assert(multi.parts.every(Boolean));assert.equal(multi.scene.model.objects[0].motionByPart[1].motionDomain.quadrant,1);assert.equal(multi.scene.model.objects[0].motionByPart[2].motionDomain.quadrant,3);count++;
console.log('PASS ellipse distance domains: '+count+' original, boundary, range union, literal scope and independent sweep checks');
