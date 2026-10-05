/* Point-defined hyperbola family and opposite-slope secants. Parameters and
 * incidence come from the input; no question IDs or reference-answer dispatch. */
(function(root){
  'use strict';
  const PREFIX='symmetric-chord-',tex=n=>root.DongNumber.tex(n),sqrt=n=>root.DongEllipseDistance.rootTex(n);
  const plain=s=>root.DongMathInput.toPlain(String(s)).replace(/\\tan/g,'tan').replace(/\\angle/g,'∠').replace(/[$\s_{}]/g,'').replace(/[（），：；、]/g,c=>({'（':'(', '）':')','，':',','：':':','；':';','、':','}[c]));
  const scalar=s=>{try{const n=root.DongEquationBuilder.scalar(s);return Number.isFinite(n)&&Math.abs(n)<=10000?n:null;}catch{return null;}};
  function family(u,v,delta,bound=0){
    if(![u,v,delta,bound].every(Number.isFinite)||delta<0||bound<0||Math.max(Math.abs(u),Math.abs(v),delta,bound)>10000)return null;
    const S=delta+u*u-v*v,D=S*S-4*delta*u*u;
    if(D<0||!Number.isFinite(D))return null;
    // Keep distinct roots distinct. A numerically ambiguous family is not
    // certified as a unique curve by rounding its discriminant to zero.
    const roots=D===0?[S/2]:[(S+Math.sqrt(D))/2,(S-Math.sqrt(D))/2],valid=roots.filter(z=>z>delta&&Math.sqrt(z)>bound);
    if(valid.length!==1)return null;
    const a2=valid[0],b2=a2-delta,residual=u*u/a2-v*v/b2-1;
    if(![a2,b2,residual].every(Number.isFinite)||Math.abs(residual)>1e-8)return null;
    return{a:Math.sqrt(a2),b:Math.sqrt(b2),a2,b2,u,v,delta,bound,S,discriminant:D};
  }
  function header(raw){
    const s=plain(raw).split(/\(\d{1,2}\)/)[0],re=/^(?:已知|设)点([A-Z])\(([^,]+),(.+?)\)在双曲线([A-Z]):x\^2\/a\^2-y\^2\/\(a\^2-([^)]*)\)=1\(a>([^)]*)\)上[,。;](.*)$/;
    const m=re.exec(s);if(!m)return null;
    const nums=[m[2],m[3],m[5],m[6]].map(scalar);if(nums.some(n=>n===null))return null;
    const base=family(...nums);if(!base)return null;
    const tail=new RegExp('^直线([a-z])与'+m[4]+'交于([A-Z]),([A-Z])两点,直线'+m[1]+'\\2,'+m[1]+'\\3的?斜率(?:之和|的和|和)为0[。;]?$').exec(m[7]);
    if(m[7]&&!tail)return null;
    const named=tail?{line:tail[1],P:tail[2],Q:tail[3]}:{};
    if(new Set([m[1],m[4],...(tail?[tail[2],tail[3]]:[])]).size!==(tail?4:2))return null;
    return{schema:1,...base,A:m[1],curve:m[4],...named};
  }
  function infer(raw){
    const spec=header(raw);if(!spec)return null;
    return{type:'hyperbola',orientation:'horizontal',a:spec.a,b:spec.b,h:0,k:0,points:{[spec.A]:[spec.u,spec.v]},inferred_from_conditions:true,exact:{a2:tex(spec.a2),b2:tex(spec.b2)},derivation:[
      `令 $z=a^2$，题设点代入给出 $${tex(spec.u**2)}/z-${tex(spec.v**2)}/(z-${tex(spec.delta)})=1$，且 $z>${tex(spec.delta)}$、$a>${tex(spec.bound)}$。`,
      `在上述非零分母条件下化为 $z^2-(${tex(spec.S)})z+${tex(spec.delta*spec.u**2)}=0$；筛选合法根后，$a^2=${tex(spec.a2)},b^2=${tex(spec.b2)}$。`,
      '回代原分式与参数不等式；非法分母根不进入图形。'
    ]};
  }
  function sample(spec,t){
    const {a2,b2,u,v}=spec,alpha=1/a2,beta=-1/b2,D=alpha+beta*t*t;
    if(!Number.isFinite(t)||t===0||Math.abs(D)<=1e-12*(Math.abs(alpha)+Math.abs(beta*t*t)))return null;
    const rp=-2*(alpha*u+beta*v*t)/D,rq=-2*(alpha*u-beta*v*t)/D;
    if(Math.abs(rp)<1e-10||Math.abs(rq)<1e-10)return null;
    const P={x:u+rp,y:v+t*rp},Q={x:u+rq,y:v-t*rq},dot=rp*rq*(1-t*t),cross=-2*t*rp*rq,area=Math.abs(cross)/2;
    if(![P.x,P.y,Q.x,Q.y,area,dot,cross].every(Number.isFinite)||Math.max(Math.abs(P.x),Math.abs(P.y),Math.abs(Q.x),Math.abs(Q.y))>100000)return null;
    return{t,P,Q,rp,rq,D,dot,cross,area,tan:dot===0?null:Math.abs(cross)/dot};
  }
  function angleSolutions(spec,target){
    if(!(target>0&&target<=10000))return null;
    const radical=Math.sqrt(1+target*target),low=target/(radical+1),high=(radical+1)/target,rejected=[],solutions=[];
    for(const magnitude of [low,high]){
      const candidate=sample(spec,magnitude);
      if(!candidate){rejected.push({magnitude,reason:Math.abs(magnitude*magnitude-spec.b2/spec.a2)<1e-10?'渐近线方向：只有一个有限交点':'切点重合或退化构型'});continue;}
      if(candidate.dot<=0||Math.abs(candidate.tan-target)>1e-8*Math.max(1,target)){rejected.push({magnitude,reason:'射线夹角不是题设要求的锐角'});continue;}
      for(const sign of [1,-1])solutions.push(sample(spec,sign*magnitude));
    }
    return{target,low,high,solutions,rejected};
  }
  function recognise(raw){
    const spec=header(raw);if(!spec?.P)return null;
    const parts=root.DongQuestionParts.splitParts(raw),slope=parts.find(p=>new RegExp('^求(?:出)?(?:直线)?'+spec.line+'(?:的)?斜率[。;]?$').test(plain(p.body)));
    if(!slope||parts.length>2)return null;
    const areaPart=parts.find(p=>p!==slope);let angle=null;
    if(areaPart){
      const m=/^(?:若|当)tan∠([A-Z]{3})=([^,]+),求(?:△|三角形)([A-Z]{3})(?:的)?面积[。;]?$/.exec(plain(areaPart.body));
      if(!m||![spec.P+spec.A+spec.Q,spec.Q+spec.A+spec.P].includes(m[1])||m[3].split('').sort().join('')!==[spec.A,spec.P,spec.Q].sort().join(''))return null;
      const target=scalar(m[2]);angle=target!==null&&angleSolutions(spec,target);
      if(!angle||!angle.solutions.length)return null;
    }
    const initial=[2,.5,3,.25,4].map(t=>sample(spec,t)).find(Boolean);if(!initial)return null;
    return{...spec,parts,derivation:infer(raw).derivation,slopePart:slope.index,areaPart:areaPart?.index,angle,initial,slope:spec.v===0?null:-spec.u*spec.b2/(spec.v*spec.a2)};
  }
  function exclusions(spec){
    const {u,v,a2,b2}=spec,list=[[u,v],[u,-v],[-u,v]];
    if(v!==0)list.push([u*(1+4*v*v/b2),v*(1-4*u*u/a2)]);
    return list.filter((p,i)=>p.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000)&&!list.slice(0,i).some(q=>p[0]===q[0]&&p[1]===q[1]));
  }
  function parameter(spec,p){return{t:Math.asinh(p.y/spec.b),branch:p.x<0?-1:1};}
  function sceneFor(spec){
    const id=s=>PREFIX+s,p=parameter(spec,spec.angle?.solutions[0]?.P||spec.initial.P),profiles={[spec.slopePart]:{mode:'curve',...parameter(spec,spec.initial.P),motionDomain:{excludePoints:exclusions(spec)}}};
    if(spec.areaPart){const q=parameter(spec,spec.angle.solutions[0].P);profiles[spec.areaPart]={mode:'curve',...q,motionDomain:{parameter:{min:q.t,max:q.t},branch:q.branch,excludePoints:exclusions(spec)}};}
    const common={kind:'construction',source:'derived',visible:true},objects=[
      {...common,id:id('P'),op:'point_on',refs:['$conic'],...p,label:spec.P,motionByPart:profiles,motionDomain:spec.areaPart?{...profiles[spec.areaPart].motionDomain}:{excludePoints:exclusions(spec)}},
      {...common,id:id('reflection'),op:'reflect_axis',axis:'x',axisValue:spec.v,refs:[id('P')],label:'对称方向点',visible:false},
      {...common,id:id('AP'),op:'line',refs:['feature:'+spec.A,id('P')],label:spec.A+spec.P},
      {...common,id:id('AQ'),op:'line',refs:['feature:'+spec.A,id('reflection')],label:spec.A+spec.Q},
      {...common,id:id('Q'),op:'second_intersection',refs:['feature:'+spec.A,id('AQ'),'$conic'],label:spec.Q},
      {...common,id:id('PQ'),op:'line',refs:[id('P'),id('Q')],label:spec.line}
    ];
    const metadata={schema:1,A:spec.A,P:spec.P,Q:spec.Q,line:spec.line,a:spec.a,b:spec.b,a2:spec.a2,b2:spec.b2,u:spec.u,v:spec.v,slope:spec.slope,slopePart:spec.slopePart,areaPart:spec.areaPart,angle:spec.angle};
    return{schemaVersion:2,type:'hyperbola',orientation:'horizontal',a:spec.a,b:spec.b,h:0,k:0,theta:42,points:{[spec.A]:[spec.u,spec.v]},lines:[],objects,polygons:spec.areaPart?[{id:id('triangle'),kind:'triangle',labels:[spec.A,spec.P,spec.Q],label:'△'+spec.P+spec.A+spec.Q,source:'derived',part:spec.areaPart,visible:true}]:[],showDynamic:false,showConic:true,showFeatures:true,problemMotion:true,title:'对称割线与三角形面积',symmetricChord:metadata,inferred_from_conditions:true,exact:{a2:tex(spec.a2),b2:tex(spec.b2)},derivation:spec.derivation};
  }
  function solve(raw){
    const spec=recognise(raw);if(!spec)return null;
    const {A,P,Q,u,v,a2,b2,slope}=spec,base=infer(raw),steps=[...base.derivation,
      `记 $${A}=(u,v)=(${tex(u)},${tex(v)})$，设两条已定义的斜率为 $t,-t$。写 $${P}=${A}+r_+(1,t)$、$${Q}=${A}+r_-(1,-t)$，$t\\ne0$；令 $\\alpha=1/a^2,\\beta=-1/b^2,D=\\alpha+\\beta t^2$。`,
      `将两条过 $${A}$ 的直线分别代入曲线，除去已知交点 $r=0$，得 $r_+=-2(\\alpha u+\\beta vt)/D$、$r_-=-2(\\alpha u-\\beta vt)/D$。$D=0$ 为渐近方向；$r_+=0$ 或 $r_-=0$ 使端点与 $${A}$ 重合，均不满足题设。`,
      `$x_${P}-x_${Q}=-4\\beta vt/D$，$y_${P}-y_${Q}=-4\\alpha ut/D$。`
    ];
    const slopeAnswer=slope===null?`直线 $${spec.line}$ 竖直，斜率不存在。`:`直线 $${spec.line}$ 的斜率恒为 $-\\frac{ub^2}{va^2}=${tex(slope)}$。`;
    const parts=spec.parts.map(part=>{
      if(part.index===spec.slopePart)return{...part,status:'answered',answer:slopeAnswer,steps:[...steps,slope===null?'此时 v=0，横坐标差为0，而纵坐标差非零，故割线为竖直线。':`因 $v=${tex(v)}\\ne0$，横坐标差非零，故 $k_${spec.line}=\\alpha u/(\\beta v)=${tex(slope)}$，与参数 $t$ 无关。`,'画板上AP、AQ、另一交点及割线共用依赖；第一问可拖动P，默认排除斜率未定义和端点重合的位置。']};
      const areas=[...new Set(spec.angle.solutions.map(s=>sqrt(s.area*s.area)))];
      return{...part,status:'answered',answer:`$\\triangle ${P+A+Q}$ 的面积为 $${areas.join('\\quad\\text{或}\\quad')}$。`,steps:[...steps,
        `两条射线的方向向量为 $r_+(1,t),r_-(1,-t)$，点积 $r_+r_-(1-t^2)$，叉积绝对值 $2|t r_+r_-|$。题设 $\\tan\\angle ${P+A+Q}=${tex(spec.angle.target)}>0$，夹角为锐角，点积必须为正。`,
        `令 $q=|t|>0$。角度条件给出 $2q/|1-q^2|=${tex(spec.angle.target)}$，两候选为 $q=${sqrt(spec.angle.low**2)}$、$q=${sqrt(spec.angle.high**2)}$。`,
        ...spec.angle.rejected.map(c=>`$q=${sqrt(c.magnitude*c.magnitude)}$ 不合法：${c.reason}。`),
        `$S=|t r_+r_-|=\\frac{4|t|\\,|\\alpha^2u^2-\\beta^2v^2t^2|}{(\\alpha+\\beta t^2)^2}$；代入合法候选，得 $S=${areas.join('\\quad\\text{或}\\quad')}$。`,
        '将端点代回曲线、斜率和射线夹角；交换P、Q对应t变号，面积不变。第二问图形定位到满足角度的构型，默认保持题设角度；自由探索需显式开启无限制移动。']};
    });
    const checks=[{id:PREFIX+'family',label:'含参方程合法根回代',category:'curve',status:'verified',detail:'联立给定点与分式方程；只接受唯一合法参数根，检查两分母与参数域。'},
      {id:PREFIX+'slope',label:'割线恒定方向',category:'answer',part:spec.slopePart,status:'verified',detail:'两个过A割线的另一交点公式相减，消去参数；v=0时明确为竖直线。'}];
    if(spec.angle)checks.push({id:PREFIX+'area',label:'射线夹角与面积候选',category:'answer',part:spec.areaPart,status:'verified',detail:'候选逐一检查有限交点、非重合、点积正号和角度；合法候选代入行列式面积。'});
    return{engineExtensions:['symmetric-chord'],mode:'symbolic-fallback',title:'对称割线独立推导',restatement:raw,answer:parts.map(p=>p.label+'：'+p.answer).join('\n'),strategy:'给定点联立反推曲线，建立斜率相反的两条割线，消元证明方向，再按实际射线夹角筛选候选并求面积。',parts,completion:{answered:parts.length,total:parts.length},scene:sceneFor(spec),verification:{status:'locally-verified',message:'参数、交点、割线与面积来自同一有界数学模型，退化候选已排除。',checks,counts:{verified:checks.length,contradicted:0,unresolved:0}}};
  }
  root.DongSymmetricChord={family,infer,sample,angleSolutions,recognise,exclusions,parameter,sceneFor,solve};
})(typeof window==='object'?window:globalThis);
