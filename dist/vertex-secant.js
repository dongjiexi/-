/* Independent vertex-secant elimination. No question IDs or reference answers.
 * The recognised domain is intentionally bounded; unsupported extra goals
 * remain pending. The proof and dependent diagram share a,b,u and incidence. */
(function(root){
  'use strict';
  const PREFIX='vertex-secant-',SCHEMA=1;
  const normalize=s=>(root.DongMathInput?.toPlain(s)??String(s)).replace(/[$\s_{}]/g,'').replace(/[₀₁₂₃₄₅₆₇₈₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/[（），：；]/g,c=>({'（':'(', '）':')','，':',','：':':','；':';'}[c]));
  const label=s=>s.replace(/\d/g,c=>'₀₁₂₃₄₅₆₇₈₉'[Number(c)]);
  const tex=n=>root.DongNumber?.tex(n)??String(n);
  const near=(a,b)=>Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
  function parameters(a,b,u){
    if(![a,b,u].every(Number.isFinite)||!(a>0&&b>0&&u<-a)||Math.max(a,b,Math.abs(u))>10000)return null;
    return {schema:SCHEMA,a,b,u,fixedX:a*a/u,minT:Math.log(-u/a),defaultT:Math.acosh(-u/a)};
  }
  function recognise(body,scene){
    const s=normalize(body),name='([A-Z](?:[12])?)';
    const re=new RegExp('^记(?:曲线)?([A-Z])的左、右顶点分别为'+name+','+name+',过点\\(([^,]+),([^()]+)\\)的直线与\\1的左支交于'+name+','+name+'两点,\\6在第二象限[。.]直线\\6\\2与\\7\\3交于点'+name+',证明:点\\8在定直线上[。.；;]?$');
    const m=re.exec(s),model=scene?.model,v=scene?.values||{};
    if(!m||model?.type!=='hyperbola'||model.orientation==='vertical'||Number(v.h??0)!==0||Number(v.k??0)!==0)return null;
    let u,y;try{u=root.DongEquationBuilder.scalar(m[4]);y=root.DongEquationBuilder.scalar(m[5]);}catch{return null;}
    const spec=parameters(Number(v.a??model.a),Number(v.b??model.b),u);
    if(!spec||y!==0||new Set([m[2],m[3],m[6],m[7],m[8]]).size!==5)return null;
    return {...spec,curve:m[1],left:label(m[2]),right:label(m[3]),M:label(m[6]),N:label(m[7]),P:label(m[8])};
  }
  function install(scene,raw,parts){
    const matches=(parts||[]).map(p=>({part:p,spec:recognise(p.body||p.question||'',scene)})).filter(p=>p.spec);
    if(matches.length!==1)return null;
    const {part,spec}=matches[0],model=scene.model;
    // A new parse has only parser-owned objects. Never overwrite a teacher's
    // point, manual line or a conflicting named coordinate on a restored scene.
    const names=new Set([spec.M,spec.N,spec.P]),vertices={[spec.left]:[-spec.a,0],[spec.right]:[spec.a,0]};
    const items=[...(model.objects||[]),...(model.lines||[])];
    if(items.some(o=>o.source==='user'||String(o.id||'').startsWith(PREFIX))||Object.keys(model.points||{}).some(n=>names.has(n))||Object.entries(vertices).some(([n,p])=>model.points?.[n]&&!model.points[n].every((v,i)=>near(v,p[i]))))return null;
    const anchor=Object.entries(model.points||{}).find(([n,p])=>!names.has(n)&&!Object.hasOwn(vertices,n)&&near(p[0],spec.u)&&near(p[1],0));
    if(!anchor)return null;
    spec.anchor=anchor[0];spec.part=part.index;
    const joins=[spec.M+spec.left,spec.N+spec.right],owned=o=>o.source==='question'&&(names.has(o.label)||joins.includes(o.label));
    if(items.some(o=>!owned(o)&&(names.has(o.label)||joins.includes(o.label))))return null;
    const common={kind:'construction',part:part.index,source:'derived',visible:true},id=s=>PREFIX+s;
    const objects=[
      {...common,id:id('M'),op:'point_on',refs:['$conic'],t:spec.defaultT,branch:-1,label:spec.M,motionDomain:{branch:-1,quadrant:2,parameter:{min:spec.minT,minClosed:false}}},
      {...common,id:id('chord'),op:'line',refs:['feature:'+spec.anchor,id('M')],label:spec.M+spec.N},
      {...common,id:id('N'),op:'second_intersection',refs:[id('M'),id('chord'),'$conic'],label:spec.N},
      {...common,id:id('join-left'),op:'line',refs:[id('M'),'feature:'+spec.left],label:joins[0]},
      {...common,id:id('join-right'),op:'line',refs:[id('N'),'feature:'+spec.right],label:joins[1]},
      {...common,id:id('P'),op:'intersection',refs:[id('join-left'),id('join-right')],label:spec.P}
    ];
    const candidate={...model,...scene.values,points:{...model.points,...vertices},showDynamic:false,objects:[...(model.objects||[]).filter(o=>!owned(o)),...objects],lines:[...(model.lines||[]).filter(o=>!owned(o)),{id:id('fixed-line'),kind:'vertical',x:spec.fixedX,label:spec.P+' 的定直线',part:part.index,source:'derived',role:'derived_locus',visible:true}]};
    const frame=root.DongSceneAudit?.frame(candidate,root.DongConstruct),p=frame?.engine.resolve(id('P'));
    if(!p||!near(p.x,spec.fixedX))return null; // Atomic: no half-installed graph.
    model.points=candidate.points;model.objects=candidate.objects;model.lines=candidate.lines;model.showDynamic=false;model.dynamicLine=false;model.vertexSecant=spec;
    model.pointParts={...(model.pointParts||{}),[spec.anchor]:[part.index],[spec.left]:[part.index],[spec.right]:[part.index]};
    return spec;
  }
  function solvePart(part,spec){
    if(!spec||part.index!==spec.part||!recognise(part.body||part.question||'',{model:{type:'hyperbola',orientation:'horizontal'},values:spec}))return null;
    const {a,b,u,M,N,P,left,right}=spec,at=tex(a),bt=tex(b),ut=tex(u),x=tex(spec.fixedX);
    return {status:'answered',answer:`点 $${P}$ 恒在定直线 $x=${x}$ 上。`,steps:[
      `记 $a=${at},b=${bt},u=${ut}<-a$。用 $x=my+u$ 表示过 $(${ut},0)$ 的直线；$m=0$ 就是竖直线，不遗漏竖直弦。`,
      `设 $${M}=(my_1+u,y_1),${N}=(my_2+u,y_2)$。联立双曲线，得 $D y^2+2b^2mu\\,y+b^2(u^2-a^2)=0$，其中 $D=b^2m^2-a^2$。两个有限交点要求 $D\\ne0$；韦达给出 $x_1+x_2=-2a^2u/D<0$，因 $u<0$ 得 $D<0$，即 $|m|<a/b$。又 $y_1y_2<0$ 且 $${M}$ 在第二象限，故 $y_1>0,y_2<0$。`,
      '韦达给出 $s=y_1+y_2=-2b^2mu/D$、$v=y_1y_2=b^2(u^2-a^2)/D$，故 $(u^2-a^2)s+2umv=0$。',
      `设 $${P}=(X,Y)$。直线 $${M}${left}$、$${N}${right}$ 的两点式分别为 $y_1(X+a)=Y(my_1+u+a)$、$y_2(X-a)=Y(my_2+u-a)$，不要求斜率存在。`,
      '交叉消去 $Y$，得 $X[u(y_1-y_2)-as]+a[2mv+us-a(y_1-y_2)]=0$。代入韦达恒等式，化为 $(X-a^2/u)[u(y_1-y_2)-as]=0$。',
      `第二因子为 $(u-a)y_1-(u+a)y_2<0$（因 $u<-a,y_1>0,y_2<0$），不能为零。所以 $X=a^2/u=${x}$，与动直线无关。`,
      `边界 $|m|=a/b$ 时不再有两个有限左支交点，已排除。拖动 $${M}$ 时，$${N}$、两条顶点连线和 $${P}$ 均按上述依赖重算；图示是证明的辅助，不以采样代替恒等式。`
    ],checks:[{id:PREFIX+'identity',label:'顶点割线定直线消元',category:'answer',part:part.index,status:'verified',detail:'由韦达恒等式和非零分母证明 X=a²/u；竖直弦纳入，渐近端点排除。',formula:'x='+x}]};
  }
  root.DongVertexSecant={parameters,recognise,install,solvePart};
})(typeof window==='object'?window:globalThis);
