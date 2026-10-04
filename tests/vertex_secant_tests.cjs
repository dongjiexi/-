const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{}};
for(const file of ['math-input.js','number-display.js','equation-builder.js','motion-domain.js','construction-board.js','scene-audit.js','vertex-secant.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/'+file),'utf8'),sandbox);
const {DongVertexSecant:solver,DongSceneAudit:audit,DongConstruct:construct}=sandbox.window;
const question=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items.find(q=>q.id==='2023-ii-21').question;
const body=question.split('（2）')[1],part={index:2,body},copy=x=>JSON.parse(JSON.stringify(x));let count=0;
function scene(a=2,b=4,u=-4){return{model:{type:'hyperbola',orientation:'horizontal',points:{T:[u,0]},objects:[],lines:[],showDynamic:true},values:{a,b,h:0,k:0}};}
const source=scene(),spec=solver.install(source,question,[part]);assert(spec,'Recognise the sourced original without ID dispatch');
assert.equal(spec.fixedX,-1);assert.equal(solver.solvePart(part,spec).status,'answered');count++;
assert.equal(audit.inspect({...source.model,...source.values},question,[part],construct).missing.length,0);count++;
assert.equal(audit.inspect({...source.model,...source.values},question,[part],construct).missingLines.length,0,'MA_1 is not a line MA');count++;
assert.equal(audit.inspect({...source.model,...source.values},'直线MA_{12}与直线N₂A₁₀',[],construct).missingLines.join(','),'MA12,N2A10','Both endpoints retain full numeric indices');count++;
// Parameter properties of the shared mathematical model, not canned problems.
for(const [a,b,u] of [[2,4,-4],[3,2,-5],[Math.sqrt(2),Math.sqrt(7),-4]]){
  const s=scene(a,b,u),p=solver.parameters(a,b,u);assert(p);
  const localBody=body.replace('(-4,0)',`(${u},0)`),ctx=solver.install(s,question,[{index:2,body:localBody}]);assert(ctx);
  for(const t of [ctx.minT+.03,ctx.defaultT,ctx.defaultT+.3,ctx.defaultT+1]){
    s.model.objects.find(o=>o.id==='vertex-secant-M').t=t;
    const frame=audit.frame({...s.model,...s.values},construct),get=suffix=>frame.engine.resolve('vertex-secant-'+suffix),M=get('M'),N=get('N'),P=get('P');
    assert(M&&N&&P,JSON.stringify({a,b,u,t,M,N,P}));assert(M.x<0&&M.y>0&&N.x<0&&N.y<0);
    for(const q of [M,N])assert(Math.abs(q.x*q.x/(a*a)-q.y*q.y/(b*b)-1)<1e-7);
    assert(Math.abs(P.x-a*a/u)<1e-7);count++;
  }
  const bad=copy(s);bad.model.objects.find(o=>o.id==='vertex-secant-M').t=ctx.minT;
  assert.equal(audit.frame({...bad.model,...bad.values},construct).engine.resolve('vertex-secant-M'),null,'Excluded asymptotic endpoint is not silently accepted');count++;
}
for(const altered of [body+'并求面积。',body.replace('左支','右支'),body.replace('第二象限','第一象限'),body.replace('NA_2','NA_1'),body.replace('(-4,0)','(-1,0)'),body.replace('(-4,0)','(-4,1)'),body.replace('(-4,0)','(-4,0.0000000001)'),body.replace('在定直线上','不在定直线上')]){
  const s=scene(),before=JSON.stringify(s);assert.equal(solver.install(s,question,[{index:2,body:altered}]),null);assert.equal(JSON.stringify(s),before,'Unrecognised or inconsistent goal is atomic');count++;
}
for(const change of [s=>s.model.objects.push({id:'manual',kind:'point',x:1,y:2,label:'M',source:'user'}),s=>s.model.points.P=[-4,0],s=>s.model.points['A₁']=[0,0]]){
  const s=scene();change(s);const before=JSON.stringify(s);assert.equal(solver.install(s,question,[part]),null);assert.equal(JSON.stringify(s),before,'Preserve conflicting user data');count++;
}
assert.equal(solver.parameters(2,4,-2),null);assert.equal(solver.parameters(2,0,-4),null);count++;
console.log('PASS vertex secant: '+count+' sourced, parameter, boundary, scope and preservation checks');
