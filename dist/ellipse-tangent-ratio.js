/* Compare areas and distances for a tangent cut by y=d and y=-d. */
(function(root){
  'use strict';

  const tex=n=>root.DongNumber.tex(n);
  const sameVertices=(a,b)=>[...a].sort().join('')===[...b].sort().join('');
  const roundoff=(a,b)=>16*Number.EPSILON*Math.max(Math.abs(a),Math.abs(b));

  function recognise(raw){
    const api=root.DongBasicConditions,parts=root.DongQuestionParts.splitParts(raw);
    const proof=parts.at(-1);
    let base,body=api.plain(proof.body);
    if(parts.length===2){
      const first=parts[0];
      base=api.ellipse(first.question.slice(0,-first.body.length));
      if(!base||!api.equationGoal(first.body,base.curve))return null;
    }else if(parts.length===1){
      const given=/^(?:已知|设)?椭圆([A-Z]):x\^2\/([^,+。;]+)\+y\^2\/([^,。;]+)=1[,。;]/.exec(body);
      if(!given)return null;
      const U=api.scalar(given[2]),V=api.scalar(given[3]);
      if(!(U>0&&V>0)||U===V)return null;
      const major2=Math.max(U,V),minor2=Math.min(U,V);
      base={type:'ellipse',a:Math.sqrt(major2),b:Math.sqrt(minor2),h:0,k:0,
        orientation:U>V?'horizontal':'vertical',curve:given[1],major2,minor2,exact:{a2:tex(major2),b2:tex(minor2)}};
      body=body.slice(given[0].length);
    }else return null;
    body=body.replace(/\\neq?(?![a-z])|≠/g,'!=')
      .replace(/\((S\d|\|[A-Z]{2}\|)\)/g,'$1').replace(/[。;]/g,',').replace(/[,.]$/,'');
    const origin=/^设([A-Z])为(?:坐标)?原点,/.exec(body);
    if(!origin)return null;
    const O=origin[1],afterOrigin=body.slice(origin[0].length);
    const point=/^(?:点)?([A-Z])\(x(\d),y\2\)(?:\(x\2!=0\)|x\2!=0)为椭圆([A-Z]?)上一点,/.exec(afterOrigin)
      ||/^椭圆([A-Z]?)上一点([A-Z])\(x(\d),y\3\)(?:满足|且)x\3!=0,/.exec(afterOrigin);
    if(!point)return null;
    const [M,index,curve]=afterOrigin.startsWith('椭圆')?[point[2],point[3],point[1]]:point.slice(1);
    if(curve&&curve!==base.curve)return null;
    const afterPoint=afterOrigin.slice(point[0].length);
    const tangent=/^直线([^,]+?=0)/.exec(afterPoint)||/^椭圆(?:([A-Z]))?在点?([A-Z])处的切线/.exec(afterPoint);
    if(!tangent)return null;
    const U=base.orientation==='horizontal'?base.major2:base.minor2;
    const V=base.orientation==='horizontal'?base.minor2:base.major2;
    if(afterPoint.startsWith('直线')){
      const coeff=new RegExp(`^([0-9./()]*?)x${index}x\\+([0-9./()]*?)y${index}y-([0-9./()]+)=0$`).exec(tangent[1]);
      if(!coeff)return null;
      const ax=api.scalar(coeff[1]||'1'),by=api.scalar(coeff[2]||'1'),c=api.scalar(coeff[3]);
      if(!(ax>0&&by>0&&c>0)||Math.abs(ax*U-c)>roundoff(ax*U,c)||Math.abs(by*V-c)>roundoff(by*V,c))return null;
    }else if(tangent[2]!==M||tangent[1]&&tangent[1]!==base.curve)return null;

    const afterTangent=afterPoint.slice(tangent[0].length);
    const crossings=/^(?:与(?:直线)?y=([^,和、]+)[和、](?:直线)?y=([^,]+?)分别|分别与(?:直线)?y=([^,和、]+)[和、](?:直线)?y=([^,]+?))(?:相)?交于(?:点)?([A-Z])[和、,](?:点)?([A-Z])(?:两点)?,/.exec(afterTangent);
    if(!crossings)return null;
    const d=api.scalar(crossings[1]||crossings[3]),lower=api.scalar(crossings[2]||crossings[4]);
    const A=crossings[5],B=crossings[6];
    if(!(d>Math.sqrt(V))||lower!==-d||new Set([curve,O,M,A,B]).size!==5)return null;
    const compare=/^(?:设|记)(?:三角形|△)([A-Z]{3})[和、,](?:三角形|△)?([A-Z]{3})的面积(?:分别)?为(S\d)[和、,](S\d),比较\3\/\4[与和]\|([A-Z]{2})\|\/\|([A-Z]{2})\|(?:的)?大小$/.exec(afterTangent.slice(crossings[0].length));
    if(!compare||compare[3]===compare[4]||!sameVertices(compare[1],O+M+A)||!sameVertices(compare[2],O+M+B)
      ||!sameVertices(compare[5],O+A)||!sameVertices(compare[6],O+B))return null;

    const firstTerm=U*V,secondTerm=d*d*(U-V),K=firstTerm-secondTerm;
    return{base,parts,U,V,d,K,sign:Math.abs(K)<=roundoff(firstTerm,secondTerm)?0:Math.sign(K),
      O,M,A,B,index,S1:compare[3],S2:compare[4],H:[...'HKJTWX'].find(h=>![curve,O,M,A,B].includes(h))};
  }

  function sceneFor(spec){
    const {base,parts,d,O,M,A,B,H}=spec,part=parts.at(-1).index;
    const id=name=>'tangent-ratio-'+name;
    const given={source:'question',visible:true,part};
    const node={...given,kind:'construction'};
    return{...base,schemaVersion:2,curveLabel:base.curve,showConic:true,showDynamic:false,showFeatures:false,
      problemMotion:true,title:'椭圆切线与面积比',points:{[O]:[0,0]},pointParts:{[O]:[part]},
      lines:[{...given,id:id('upper'),kind:'slope',m:0,b:d,label:`y=${tex(d)}`},
        {...given,id:id('lower'),kind:'slope',m:0,b:-d,label:`y=${tex(-d)}`}],
      objects:[
        {...node,id:id('driver'),op:'point_on',label:M,refs:['$conic'],t:0.45,motionDomain:{excludeAxes:['y']}},
        {...node,id:id('tangent'),op:'tangent',label:M+' 点切线',refs:[id('driver'),'$conic']},
        {...node,id:id('upper-point'),op:'intersection',label:A,refs:[id('tangent'),id('upper')]},
        {...node,id:id('lower-point'),op:'intersection',label:B,refs:[id('tangent'),id('lower')]},
        {...node,id:id('foot'),op:'foot',label:H,refs:['feature:'+O,id('tangent')],source:'derived'},
        {...node,id:id('height'),op:'segment',label:O+H,refs:['feature:'+O,id('foot')],source:'derived'}
      ],
      tangentRatio:{part,O,A,B,S1:spec.S1,S2:spec.S2},polygons:[A,B].map(p=>({...given,id:id('triangle-'+p),kind:'triangle',labels:[O,M,p],label:'△'+O+M+p}))};
  }

  function solve(raw){
    const spec=recognise(raw);if(!spec)return null;
    const {base,parts,U,V,d,K,sign,O,M,A,B,H,index,S1,S2}=spec;
    const area=`\\frac{${S1[0]}_${S1[1]}}{${S2[0]}_${S2[1]}}`,distance=`\\frac{|${O+A}|}{|${O+B}|}`;
    const eq=root.DongBasicConditions.equation(base),s=`y_${index}`,x=`x_${index}`;
    const comparison=sign===0?`$${area}=${distance}$。`:
      `$${s}>0$ 时 $${area}${sign>0?'<':'>'}${distance}$，$${s}<0$ 时不等号反向，$${s}=0$ 时两比值相等。`;
    const steps=[
      `记 $U=${tex(U)},\\ V=${tex(V)},\\ d=${tex(d)},\\ s=${s}$。由椭圆在 $${M}$ 处的法向量 $\\bigl(${x}/U,s/V\\bigr)$，题设直线就是 $\\frac{${x}x}{U}+\\frac{sy}{V}=1$。`,
      `$|s|\\le\\sqrt V<d$，且 $${x}\\ne0$，所以两个交点唯一，$${M}$ 在 $${A+B}$ 内部。过 $${O}$ 向切线作垂线，垂足为 $${H}$。两三角形共用正的高 $|${O+H}|$，所以 $${area}=\\frac{|${M+A}|}{|${M+B}|}=\\frac{d-s}{d+s}$。`,
      `把 $y=d,-d$ 分别代入切线，得到 $x_${A}=\\frac{U(1-ds/V)}{${x}},\\ x_${B}=\\frac{U(1+ds/V)}{${x}}$。又 $${x}^2=\\frac{U(V-s^2)}V$，由 $${x}\\ne0$ 知 $V-s^2>0$。`,
      `令 $K=UV-d^2(U-V)$。用两点坐标计算距离平方并整理，得 $|${O+A}|^2=\\frac{U(d-s)^2}{V-s^2}+\\frac KV$，$|${O+B}|^2=\\frac{U(d+s)^2}{V-s^2}+\\frac KV$。`,
      `两比值均为正，故可平方并交叉相乘。$|${O+A}|^2(d+s)^2-|${O+B}|^2(d-s)^2=\\frac{4dsK}{V}$。本题 $K=${tex(sign===0?0:K)}$，所以${comparison}`
    ];
    const solved=[{...parts.at(-1),status:'answered',answer:comparison,steps}];
    const checks=[{id:'tangent-ratio-identity',category:'answer',part:parts.at(-1).index,status:'verified',label:'共高与距离平方恒等式',
      detail:'检查切线系数、交点唯一性和所有非零分母；比值结论由恒等式给出。'}];
    if(parts.length===2){
      solved.unshift({...parts[0],status:'answered',answer:`$${eq}$。`,steps:[...base.derivation,`因此椭圆方程为 $${eq}$。`]});
      checks.unshift({id:'tangent-ratio-ellipse',category:'curve',part:parts[0].index,status:'verified',label:'回代椭圆定义与离心率',
        detail:'长轴长、离心率与两个半轴均符合题设。'});
    }
    return{engineExtensions:['ellipse-tangent-ratio'],mode:'symbolic-fallback',title:'椭圆切线上的面积比与距离比',
      restatement:raw,strategy:'建立椭圆与切线，用切线共高与距离平方比较两个比值。',
      answer:solved.map(p=>p.label+'：'+p.answer).join('\n'),parts:solved,completion:{answered:solved.length,total:parts.length},scene:sceneFor(spec),
      verification:{status:'locally-verified',counts:{verified:checks.length,contradicted:0,unresolved:0},checks}};
  }

  root.DongEllipseTangentRatio={solve};
})(typeof window==='object'?window:globalThis);
