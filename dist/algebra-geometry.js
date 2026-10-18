/* Explicit algebraic families, recomputed from premises rather than bank answers. */
(function(root){
  'use strict';
  const near=(a,b)=>Math.abs(a-b)<=128*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
  const plain=s=>root.DongMathInput.toPlain(String(s).replace(/\\(?:boldsymbol|mathbf|vec)\s*/g,' ')).replace(/[\s${}]/g,'').replace(/[（），：；]/g,c=>({'（':'(', '）':')','，':',','：':':','；':';'}[c])).replace(/[−–]/g,'-');
  const num=s=>{if(!/^[0-9+*/().-]{1,80}$/.test(s))return null;try{const n=root.DongEquationBuilder.scalar(s);return Number.isFinite(n)&&Math.abs(n)<1e4?n:null;}catch{return null;}};
  const tex=n=>root.DongNumber.tex(n),clone=x=>JSON.parse(JSON.stringify(x));
  function result(raw,kind,answer,steps,scene){
    scene.schemaVersion=2;scene.boundedAlgebra={kind};scene.problemMotion=true;
    return{engineExtensions:['algebra-geometry'],mode:'symbolic-fallback',title:kind==='vector-norm'?'向量模长与数量积消元':'共底面积比与交点条件',restatement:raw,answer,parts:[{index:0,label:'推导与检验',status:'answered',answer,steps}],completion:{answered:1,total:1},scene,verification:{status:'locally-verified',counts:{verified:1,contradicted:0,unresolved:0},checks:[{id:kind,status:'verified',category:'construction',label:'原条件独立回代',detail:'根据原条件重新计算参数并核对合法性；图形不代替代数推导。'}]},scene_notice:kind==='vector-norm'?'图中是一组满足条件的代表向量；整体旋转或镜像后仍满足条件，方向不是唯一解。':'每个保留候选值都检查了两不同交点条件；多解时分别显示，第二组交点使用下标区分。'};
  }
  function vector(raw){
    const s=plain(raw),m=/^向量([a-z]),([a-z])满足\|\1\|=([^、,]+)[、,]\|\1\+([^a-z]*)\2\|=([^,]+),且\(\2-([^a-z]*)\1\)垂直\2,求\|\2\|[。.]?$/.exec(s);
    if(!m||m[1]===m[2])return null;
    const u=num(m[3]),k=num(m[4]||'1'),v=num(m[5]),h=num(m[6]||'1');
    if(!(u>0)||v===null||v<0||k===null||h===null||!h||!k)return null;
    const den=k*k+2*k/h;if(near(den,0))return null;
    const t=(v*v-u*u)/den,dot=t/h,bx=dot/u,by2=t-bx*bx;
    if(!(t>0)||by2<-128*Number.EPSILON*Math.max(1,t))return null;
    const by=Math.sqrt(Math.max(0,by2)),A=[u,0],B=[bx,by],T=[u+k*bx,k*by],D=[bx-h*u,by];
    if(!near(Math.hypot(...T),v)||!near(D[0]*B[0]+D[1]*B[1],0))return null;
    const [a,b]=[m[1],m[2]],answer=`$|\\boldsymbol ${b}|=${tex(Math.sqrt(t))}$。`;
    const steps=[`设 $t=|\\boldsymbol ${b}|^2$，$d=\\boldsymbol ${a}\\cdot\\boldsymbol ${b}$。由垂直条件得 $t-${tex(h)}d=0$，即 $d=t/(${tex(h)})$。`,
      `展开模长平方：$${tex(v*v)}=${tex(u*u)}+${tex(2*k)}d+${tex(k*k)}t$。`,
      `消去 $d$ 得 $(${tex(den)})t=${tex(v*v-u*u)}$，所以 $t=${tex(t)}$，模长取非负根，$|\\boldsymbol ${b}|=${tex(Math.sqrt(t))}$。`,
      `还需检查数量积可实现：$d^2\\le |\\boldsymbol ${a}|^2t$；本题 $d^2=${tex(dot*dot)}$，$|\\boldsymbol ${a}|^2t=${tex(u*u*t)}$，满足条件。`,
      `可取代表向量 $\\boldsymbol ${a}=(${A.map(tex).join(',')})$，$\\boldsymbol ${b}=(${B.map(tex).join(',')})$；回代和向量模长及垂直条件均成立。`];
    const points={O:[0,0],A,B,T,D},objects=[['a','A',a],['b','B',b],['sum','T',a+'+'+k+b],['difference','D',b+'-'+h+a]].map(([id,end,label])=>({id:'algebra-vector-'+id,kind:'construction',op:'vector',refs:['feature:O','feature:'+end],label,source:'question',visible:true}));
    return result(raw,'vector-norm',answer,steps,{type:'circle',r:Math.max(u,Math.sqrt(t),1),isFreeBoard:true,showConic:false,showDynamic:false,showFeatures:false,points,lines:[],objects,polygons:[],title:'代表向量与垂直关系'});
  }
  function ellipse(raw){
    const s=plain(raw),m=/^椭圆([A-Z]):x\^2\/([^+]+)\+y\^2(?:\/([^=]+))?=1的左右焦点记为F1,F2。直线y=([^x]*)x\+m截椭圆于([A-Z])[,、]([A-Z]);若SF1([A-Z]{2})=([^S]+)SF2([A-Z]{2}),求m[。.]?$/.exec(s);
    if(!m||m[5]===m[6]||m[7]!==m[5]+m[6]||m[9]!==m[7])return null;
    const a2=num(m[2]),b2=num(m[3]||'1'),k=num(m[4]==='-'?'-1':m[4]||'1'),ratio=num(m[8]);
    if(!(a2>b2&&b2>0)||k===null||!k||!(ratio>0))return null;
    const c=Math.sqrt(a2-b2),kc=k*c,bound=b2+a2*k*k;
    const candidates=near(ratio,1)?[0]:[kc*(1-ratio)/(1+ratio),kc*(1+ratio)/(1-ratio)];
    const accepted=candidates.filter(value=>Number.isFinite(value)&&value*value<bound-128*Number.EPSILON*Math.max(1,bound));
    if(!accepted.length)return null;
    const intersections=value=>{const aa=1/a2+k*k/b2,bb=2*k*value/b2,cc=value*value/b2-1,disc=bb*bb-4*aa*cc;if(!(disc>0))return null;return [-1,1].map(sign=>{const x=(-bb+sign*Math.sqrt(disc))/(2*aa);return[x,k*x+value];});};
    if(!accepted.every(value=>{const p=intersections(value);return p&&near(Math.abs(value-kc),ratio*Math.abs(value+kc))&&p.every(([x,y])=>near(x*x/a2+y*y/b2,1));}))return null;
    const answer='$m='+accepted.map(tex).join('\\quad\\text{或}\\quad')+'$。';
    const steps=[`由 $c^2=a^2-b^2=${tex(a2-b2)}$ 得两焦点 $F_1=(-${tex(c)},0)$、$F_2=(${tex(c)},0)$。`,
      `两三角形共用弦作底，面积之比等于两焦点到直线的距离之比。因此 $|m-(${tex(kc)})|=${tex(ratio)}|m+(${tex(kc)})|$。`,
      `分别取绝对值等式的同号与异号情形，候选值为 $${candidates.map(tex).join(',\\quad ')}$。`,
      `联立直线与椭圆，判别式要求 $m^2<b^2+a^2k^2=${tex(bound)}$，等号只是相切，不满足两个不同交点。`,
      ...candidates.map(value=>`候选 $m=${tex(value)}$ 的平方为 $${tex(value*value)}$，${accepted.includes(value)?'满足严格不等式，保留':'不满足严格不等式，排除'}。`),
      `保留值回代面积比方程成立，故 ${answer}`];
    const points={F1:[-c,0],F2:[c,0]},objects=[],polygons=[];
    accepted.forEach((value,i)=>{const suffix=i?'_'+(i+1):'',A=m[5]+suffix,B=m[6]+suffix,id='area-ratio-'+i;
      objects.push({id:id+'-line',kind:'slope',m:k,b:value,label:'l'+suffix,source:'question',visible:true},...[A,B].map((label,branch)=>({id:id+'-'+branch,kind:'construction',op:'intersection',refs:[id+'-line','$conic'],branch,label,source:'question',visible:true})));
      for(const focus of ['F1','F2'])polygons.push({id:id+'-'+focus,labels:[focus,A,B],label:'△'+focus+A+B,source:'question'});
    });
    return result(raw,'ellipse-area-ratio',answer,steps,{type:'ellipse',a:Math.sqrt(a2),b:Math.sqrt(b2),h:0,k:0,showDynamic:false,showFeatures:false,points,pointBindings:{F1:'focus1',F2:'focus2'},lines:[],objects,polygons,title:'共底三角形面积比',areaRatioCandidates:clone(accepted)});
  }
  function solve(raw){if(typeof raw!=='string'||raw.length>18000)return null;return vector(raw)||ellipse(raw);}
  root.DongAlgebraGeometry={vector,ellipse,solve};
})(typeof window==='object'?window:globalThis);
