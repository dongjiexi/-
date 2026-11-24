const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/orthogonal-chord.js'),'utf8'),sandbox);
const api=sandbox.window.DongOrthogonalChord;
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('independent quadratic intersections verify both axes and all chord directions',()=>{
  for(const [a,b] of [[Math.sqrt(2),1],[2,1],[5,3],[1,1]])for(const swap of [false,true]){
    const rx=swap?b:a,ry=swap?a:b,r2=a*a*b*b/(a*a+b*b);
    const c=api.circle({A:1/rx**2,B:0,C:1/ry**2,D:0,E:0,F:-1});near(c.r2,r2);
    for(let angle=0;angle<360;angle+=3){
      const p=api.origin({type:'ellipse'},{a,b},angle),t=angle*Math.PI/180,dx=Math.cos(t),dy=Math.sin(t);
      const u=dx*dx/rx**2+dy*dy/ry**2,v=2*(p.x*dx/rx**2+p.y*dy/ry**2),w=p.x*p.x/rx**2+p.y*p.y/ry**2-1;
      const disc=v*v-4*u*w;assert(disc>0);
      const points=[-1,1].map(sign=>{const s=(-v+sign*Math.sqrt(disc))/(2*u);return{x:p.x+s*dx,y:p.y+s*dy};});
      const [A,B]=points;
      for(const q of points)near(q.x*q.x/rx**2+q.y*q.y/ry**2,1);
      near(A.x*B.x+A.y*B.y,0);near((p.x*dy-p.y*dx)**2,r2);
      const area=Math.abs(A.x*B.y-A.y*B.x)/2;assert(area>=r2-1e-8);
      if(angle%90===0)near(area,r2);
    }
  }
});
test('reject non-ellipses instead of constructing a spurious fixed circle',()=>{
  assert.equal(api.circle({A:1,B:0,C:-1,D:0,E:0,F:-1}),null);
  assert.equal(api.circle({A:1,B:1,C:2,D:0,E:0,F:-1}),null);
});

for(const file of ['construction-board.js','scene-audit.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/'+file),'utf8'),sandbox);
const construct=sandbox.window.DongConstruct,audit=sandbox.window.DongSceneAudit;

test('both moving lines use their own angle-dependent anchor and preserve fixed-circle tangency',()=>{
  const model={type:'ellipse',a:4,b:2,h:1,k:-2,orthogonalChord:{},pairedChord:{labels:['C','D']},objects:[],points:{}};
  const curve=construct.conicShape({...model,conicType:model.type});
  let first=0,second=90;
  const engine=construct.createEngine({model:()=>model,features:()=>[],coeffs:()=>curve.q,angle:()=>first,angle2:()=>second,origin:(angle=first)=>api.origin(model,model,angle)});
  for(const [one,two] of [[0,90],[37,133],[90,0],[179,271]]){
    first=one;second=two;
    for(const [id,angle] of [['$dynamic',one],['$dynamic2',two]]){
      const line=engine.resolve(id),expected=api.origin(model,model,angle),r2=model.a**2*model.b**2/(model.a**2+model.b**2);
      near(line.o.x,expected.x);near(line.o.y,expected.y);
      near(((line.o.x-model.h)*line.d.y-(line.o.y-model.k)*line.d.x)**2,r2);
      const [a,b]=construct.intersect(line,{type:'conic',q:curve.q});
      assert(a&&b);near((a.x-model.h)*(b.x-model.h)+(a.y-model.k)*(b.y-model.k),0);
    }
  }
});

test('audit built-in secondary intersections and native line agree for independent moving anchors',()=>{
  for(const [theta,theta2] of [[0,90],[37,133],[90,0]]){
    const scene={type:'ellipse',a:4,b:2,h:0,k:0,theta,theta2,showDynamic:true,orthogonalChord:{},pairedChord:{labels:['C','D']},points:{},objects:[]};
    const frame=audit.frame(scene,construct),line=frame.engine.resolve('$dynamic2');
    const expected=api.origin(scene,scene,theta2),points=['C','D'].map(name=>frame.features.find(point=>point.name===name));
    near(line.o.x,expected.x);near(line.o.y,expected.y);
    for(const point of points){assert(point);near((point.x-line.o.x)*line.d.y-(point.y-line.o.y)*line.d.x,0);near(point.x**2/16+point.y**2/4,1);}
    near(points[0].x*points[1].x+points[0].y*points[1].y,0);
  }
});

test('ordinary paired chords still share their explicit fixed point',()=>{
  const scene={type:'ellipse',a:4,b:2,h:0,k:0,theta:0,theta2:90,showDynamic:true,lineThrough:'point:P',pairedChord:{labels:['C','D']},points:{P:[1,0]},objects:[]};
  const frame=audit.frame(scene,construct);
  for(const id of ['$dynamic','$dynamic2']){const line=frame.engine.resolve(id);near(line.o.x,1);near(line.o.y,0);}
  for(const name of ['C','D'])near(frame.features.find(point=>point.name===name).x,1);
});
