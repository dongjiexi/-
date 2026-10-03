/* Independent bounded model: a fixed triangle base and a vertex on a conic.
 * No question IDs, stored answers, network, code evaluation or sampling proof. */
(function(root){
  'use strict';
  const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  function candidates(curve,A,P,area,construct){
    if(!curve?.q||!finite(A)||!finite(P)||!(area>0)||!Number.isFinite(area)||!construct)return null;
    const dx=P.x-A.x,dy=P.y-A.y,n={x:-dy,y:dx},n2=dx*dx+dy*dy;
    if(n2<1e-16)return null;
    const q=curve.q,value=p=>q.A*p.x*p.x+q.B*p.x*p.y+q.C*p.y*p.y+q.D*p.x+q.E*p.y+q.F;
    if([A,P].some(p=>Math.abs(value(p))>1e-8*(1+Math.hypot(p.x,p.y)**2)))return null;
    const result=[];
    for(const sign of [-1,1]){
      const c=n.x*A.x+n.y*A.y+sign*2*area;
      const offset={type:'line',o:{x:n.x*c/n2,y:n.y*c/n2},d:{x:n.y,y:-n.x}};
      for(const B of construct.intersect(offset,curve)){
        if(!finite(B)||Math.hypot(B.x-P.x,B.y-P.y)<1e-8)continue;
        const actual=Math.abs(dx*(B.y-A.y)-dy*(B.x-A.x))/2;
        if(Math.abs(actual-area)>1e-7*(1+area)||result.some(r=>Math.hypot(r.B.x-B.x,r.B.y-B.y)<1e-7))continue;
        result.push({B,area:actual,line:{type:'line',o:P,d:{x:B.x-P.x,y:B.y-P.y}}});
      }
    }
    return result;
  }
  function solvePart(scene,part,construct){
    const raw=String(part.body||part.question||''),body=(root.DongMathInput?.toPlain(raw)??raw).replace(/\s|\$/g,'').replace(/\uFF0C/g,',');
    // Exact goal coverage: refuse extra inequalities, angle/range requirements,
    // multiple goals and ambiguous identities instead of silently ignoring them.
    const m=/^若过(?:点)?([A-Z])的直线([a-z])交(?:曲线)?([A-Z])于(?:另一|另一个)点([A-Z]),且(?:△|三角形)([A-Z]{3})的面积为([^,。;；]+),求([a-z])的方程[。.]?$/.exec(body);
    if(!m||m[2]!==m[7]||new Set(m[5]).size!==3||!m[5].includes(m[1])||!m[5].includes(m[4])||!['ellipse','circle','hyperbola','parabola'].includes(scene.model.type))return null;
    const fixed=[...m[5]].find(label=>label!==m[1]&&label!==m[4]),xy=scene.model.points?.[fixed],pxy=scene.model.points?.[m[1]];
    if(!xy||!pxy)return null;
    let area;try{area=root.DongEquationBuilder.scalar(m[6]);}catch{return null;}
    const model={...scene.model,...scene.values},curve=construct.conicShape({...model,conicType:model.type});
    // Circle has its own representation in the shared frame.
    const shape=model.type==='circle'?root.DongSceneAudit.frame(model,construct)?.curve:curve;
    const A={x:xy[0],y:xy[1]},P={x:pxy[0],y:pxy[1]},solutions=candidates(shape,A,P,area,construct);
    if(!solutions)return null;
    scene.model.conicArea=true;
    const tex=n=>root.DongNumber?.tex(n)??String(n),answers=[],checks=[];
    scene.model.objects||=[];scene.model.lines||=[];
    for(const [i,solution] of solutions.entries()){
      const {B,line}=solution,name=m[4]+(solutions.length>1?i+1:''),id='area-candidate-'+part.index+'-'+i;
      if(Math.abs(line.d.x)<1e-10){answers.push('x='+tex(P.x));scene.model.lines.push({id:id+'-line',kind:'vertical',x:P.x,label:m[2]+(i+1),part:part.index,source:'derived',visible:true});}
      else{const slope=line.d.y/line.d.x,intercept=P.y-slope*P.x;answers.push('y='+tex(slope)+'x'+(intercept<0?'-':'+')+tex(Math.abs(intercept)));scene.model.lines.push({id:id+'-line',kind:'slope',m:slope,b:intercept,label:m[2]+(i+1),part:part.index,source:'derived',visible:true});}
      scene.model.objects.push({id,kind:'point',x:B.x,y:B.y,label:name,part:part.index,source:'derived',visible:true});
      scene.model.polygons||=[];scene.model.polygons.push({id:id+'-triangle',kind:'polygon',labels:[fixed,name,m[1]],label:'△'+fixed+name+m[1],part:part.index,source:'derived',visible:true});
      checks.push({id:id+'-check',label:'面积约束候选 '+(i+1),status:'verified',category:'construction',part:part.index,detail:'候选同时满足曲线、过点直线及面积条件。',formula:'S='+tex(solution.area)});
    }
    const coordinate=solutions.map((s,i)=>'$'+m[4]+(solutions.length>1?'_{'+(i+1)+'}':'')+'('+tex(s.B.x)+','+tex(s.B.y)+')$').join('、');
    return {status:'answered',answer:answers.length?'直线 $'+m[2]+'$ 的所有方程为 '+answers.map(a=>'$'+a+'$').join(' 或 ')+'。':'面积条件与曲线不相容，没有满足全部条件的直线。',steps:[
      '以已知点 $'+fixed+'$ 与 $'+m[1]+'$ 为固定底边，设另一交点为 $'+m[4]+'(x,y)$。',
      '由行列式面积公式，$|'+tex(P.x-A.x)+'(y-('+tex(A.y)+'))-('+tex(P.y-A.y)+')(x-('+tex(A.x)+'))|='+tex(2*area)+'$。',
      '分别取正、负号，得到两条与固定底边平行的直线。每条与原曲线联立；所有候选都来自这两个二次交点方程，不使用采样穷举。',
      solutions.length?'求得全部有效候选为 '+coordinate+'；逐一代回曲线和面积条件。':'两个符号分支均没有满足面积条件的有效交点。',
      '将每个候选与 $'+m[1]+'$ 连接，用两点式求直线；横坐标相同时直接写 $x='+tex(P.x)+'$，不会漏掉竖直线。'
    ],checks};
  }
  root.DongConicArea={candidates,solvePart};
})(typeof window==='object'?window:globalThis);
