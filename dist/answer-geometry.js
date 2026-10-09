/* Bounded, data-only reading of explicit auxiliary constructions in an answer.
 * No eval, invented coordinates, guessed loci or mathematical proof claims. */
(function(root){
  'use strict';
  const pointOps=new Set(['point_on','midpoint','inverse','reflect_axis','reflect_center','foot','ellipse_tangent_point','intersection','second_intersection']);
  const token='([A-Z](?:[0-9₀₁₂₃₄₅₆₇₈₉]+)?[′]?)';
  const pointName=token.slice(1,-1),alias='[a-z](?:[A-Z]|[0-9₀₁₂₃₄₅₆₇₈₉]{1,3})?[′]?',lineName='(?:'+pointName+pointName+'|'+alias+')';
  const lineOps=new Set(['line','segment','ray','parallel','perpendicular','line_angle','tangent','normal']),lineKinds=new Set(['line','slope','vertical','through_points']);
  const lineNode=n=>lineOps.has(n.op)||lineKinds.has(n.kind);
  const clean=text=>(root.DongMathInput?.toPlain(text)??String(text||'')).replace(/\\(?:left|right|prime)/g,m=>m.endsWith('prime')?'′':'').replace(/[_{}$\s]/g,'').replace(/'/g,'′');
  function install(scene,parts,construct){
    const report={added:[],unresolved:[],conflicts:[],limitReached:false};if(!scene||!construct||!root.DongSceneAudit?.frame)return report;
    scene.objects||=[];scene.lines||=[];
    const canonical=root.DongSceneAudit.canonical,all=()=>[...scene.lines,...scene.objects];
    const used=new Set(all().map(n=>n.id).filter(Boolean));
    const blockedAliases=new Set(),aliasKey=(part,name)=>String(part.index??'all')+'\0'+canonical(name);
    const blockedPoints=new Set();let activePart=null;
    const unique=stem=>{let id=stem,i=1;while(used.has(id))id=stem+'-'+i++;used.add(id);return id;};
    const current=()=>root.DongSceneAudit.frame(scene,construct);
    const point=name=>{
      if(blockedPoints.has(aliasKey(activePart||{},name)))return null;
      let matches=all().filter(n=>canonical(n.label)===canonical(name)&&(n.kind==='point'||pointOps.has(n.op)));
      if(matches.length>1&&Number.isInteger(activePart?.index)){
        const scoped=matches.filter(n=>root.DongSceneAudit.visible({...n,visible:true},activePart.index));
        if(scoped.length===1)matches=scoped;
      }
      if(matches.length>1)return null;
      if(matches.length){if(!matches[0].id)matches[0].id=unique('answer-ref-point');return matches[0].id;}
      const features=current()?.features.filter(n=>canonical(n.name)===canonical(name))||[];
      return features.length===1?'feature:'+features[0].name:null;
    };
    const scope=part=>Number.isInteger(part?.index)?{part:part.index}:{};
    const owned=node=>node&&String(node.id).startsWith('answer-')&&node.source==='derived';
    const share=(part,node)=>{if(owned(node)&&node.part==null&&Number.isInteger(part.index)){node.parts=[...new Set([...(node.parts||[]),part.index])];}return node;};
    const existingPoint=(part,name)=>!!point(name)||all().some(n=>canonical(n.label)===canonical(name)&&(n.kind==='point'||pointOps.has(n.op)));
    const pending=(part,label,reason,persistent=false)=>{const value={...scope(part),label,reason,...(persistent?{dependencyUnconfirmed:true}:{})};if(report.unresolved.length<60&&!report.unresolved.some(n=>n.label===label&&n.part===value.part&&n.reason===reason))report.unresolved.push(value);};
    const checkExisting=(part,name,op,refs,parameters={})=>{
      if(!existingPoint(part,name))return false;
      if(refs.every(Boolean)){
        const ref=point(name),stored=all().find(n=>n.id===ref),sameRefs=(stored?.refs||[]).join('\0')===refs.join('\0')||op==='midpoint'&&(stored?.refs||[]).join('\0')===refs.slice().reverse().join('\0');
        const linked=stored?.op===op&&sameRefs&&Object.entries(parameters).every(([key,value])=>stored[key]===value);
        if(linked){share(part,stored);return true;}
        // A conflicting definition must not feed downstream constructions or
        // broaden the original point's scope, even at coincident coordinates.
        blockedPoints.add(aliasKey(part,name));
        const item={id:unique('answer-check'),kind:'construction',op,refs,branch:0,...parameters};
        scene.objects.push(item);const engine=current()?.engine,expected=engine?.resolve(item.id),actual=engine?.resolve(ref);scene.objects.pop();
        if(expected?.type!=='point'||actual?.type!=='point'){pending(part,name,'当前关系无法核对；已有对象保持不变，不据此猜测坐标或称为关系冲突',true);return true;}
        const conflict=expected?.type!=='point'||actual?.type!=='point'||Math.hypot(expected.x-actual.x,expected.y-actual.y)>1e-7*(1+Math.hypot(expected.x,expected.y,actual.x,actual.y));
        if(conflict&&!report.conflicts.some(n=>n.label===name&&n.part===part.index))report.conflicts.push({...scope(part),label:name,reason:'已有同名点与答案描述的 '+op+' 关系不符或关系当前无法构造，已保留原对象，未覆盖坐标'});
        else pending(part,name,'当前坐标吻合，但已有对象未绑定答案所述依赖；已保留原对象，拖动后不能保证该关系',true);
      }else pending(part,name,'答案所述依赖尚未定位；已有同名点保持不变',true);
      return true;
    };
    const add=(part,node)=>{
      if(pointOps.has(node.op)&&existingPoint(part,node.label))return null;
      const existing=all().find(n=>(n.op===node.op||node.role&&n.role===node.role)&&JSON.stringify(n.refs)===JSON.stringify(node.refs));
      if(existing&&!pointOps.has(node.op)){
        return share(part,existing);
      }
      if(report.added.length>=60||all().length>=500){report.limitReached=true;pending(part,node.label,'自动补图对象达到上限，请分问查看或手动补充');return null;}
      const item={id:unique('answer-'+node.op+'-'+canonical(node.label).replace(/[^A-Z0-9]/g,'')+'-'+(part.index??'all')),kind:'construction',source:'derived',visible:true,...(Number.isInteger(part.index)?{parts:[part.index]}:{}),...node};
      scene.objects.push(item);
      const resolved=current()?.engine.resolve(item.id);
      if(!resolved){
        const refs=node.refs||[],engine=current()?.engine,inputs=refs.map(ref=>engine?.resolve(ref));
        // Distinct known lines may temporarily be parallel/coincident. Keep
        // their intersection dependency, never a guessed intersection point.
        const deferredRef=(ref,seen=new Set())=>{if(seen.has(ref)||seen.size>=20)return false;seen.add(ref);const upstream=all().find(n=>n.id===ref);return upstream?.deferredConstruction===true||upstream?.refs?.some(r=>deferredRef(r,new Set(seen)));};
        const latent=node.op==='intersection'&&refs.length===2&&refs[0]!==refs[1]&&inputs.every(v=>v?.type==='line');
        const dependencyTypes={segment:['point','point'],line:['point','point'],midpoint:['point','point'],reflect_axis:['point'],reflect_center:['point','point'],foot:['point','line']},types=dependencyTypes[node.op];
        const deferred=types&&refs.length===types.length&&inputs.some((v,i)=>!v&&deferredRef(refs[i]))&&inputs.every((v,i)=>v?v.type===types[i]:deferredRef(refs[i]));
        if(!latent&&!deferred){scene.objects.pop();pending(part,node.label,'当前构型无法构造，未猜测坐标或方程');return null;}
        item.deferredConstruction=true;pending(part,node.label,latent?'两条已知直线当前没有唯一有限交点；保留依赖，构型恢复后自动重算':'所依赖的交点当前不可用；保留构造关系，交点恢复后自动重算');
      }
      report.added.push({id:item.id,label:item.label,...scope(part)});return item;
    };
    const line=(part,name)=>{
      const key=canonical(name).replace(/^(直线|线段)/,'');
      if(blockedAliases.has(aliasKey(part,key)))return null;
      if(scene.showDynamic!==false&&(scene.showDynamic||scene.dynamicLine)&&key===canonical(scene.dynamicLineLabel||'l'))return '$dynamic';
      const candidates=all().filter(n=>lineNode(n)&&[n.label,...(Array.isArray(n.aliases)?n.aliases.slice(0,12):[])].some(label=>canonical(label).replace(/^(直线|线段)/,'')===key)),bounded=n=>['segment','ray'].includes(n.op)||n.kind==='through_points'&&!n.infinite,matches=candidates.filter(n=>!bounded(n));
      if(matches.length>1)return null;
      if(matches.length){const node=matches[0];if(!node.id)node.id=unique('answer-ref-line');share(part,node);return node.id;}
      if(candidates.length===1&&bounded(candidates[0])){
        const node=candidates[0],refs=node.kind==='through_points'?[point(node.a),point(node.b)]:node.refs;
        return refs?.length===2&&refs.every(Boolean)?add(part,{op:'line',refs,label:name})?.id:null;
      }
      if(candidates.length)return null;
      const pair=clean(name).match(new RegExp('^'+token+token+'$'));
      if(!pair)return null;
      const refs=[point(pair[1]),point(pair[2])];
      return refs.every(Boolean)?add(part,{op:'line',refs,label:name})?.id:null;
    };
    const bindAlias=(part,node,name)=>{
      if(!node)return;
      const key=canonical(name),collisions=all().filter(n=>n!==node&&!(n.kind==='point'||pointOps.has(n.op))&&[n.label,...(Array.isArray(n.aliases)?n.aliases.slice(0,12):[])].some(label=>canonical(label)===key));
      if(collisions.length||scene.showDynamic!==false&&(scene.showDynamic||scene.dynamicLine)&&key===canonical(scene.dynamicLineLabel||'l')){blockedAliases.add(aliasKey(part,name));pending(part,name,'切线名称与已有直线冲突，未覆盖原对象或猜测交点',true);return;}
      if(node.source!=='derived'||!String(node.id).startsWith('answer-')){if(canonical(node.label)!==key){blockedAliases.add(aliasKey(part,name));pending(part,name,'复用已有切线，但未改写其名称；请核对显式命名',true);}return;}
      node.aliases||=[];if(node.aliases.length<12&&!node.aliases.some(value=>canonical(value)===key))node.aliases.push(name);
    };
    for(const part of (parts||[]).slice(0,12)){
      activePart=part;
      const originalScopes=new Map(all().map(node=>[node.id,{parts:node.parts?.slice()}]));
      const clauses=[part.answer,...(part.steps||[]).slice(0,40)].filter(s=>typeof s==='string').map(clean).flatMap(s=>s.split(/[。；;\n]/)).filter(s=>s&&s.length<1200&&!/不(?:在|是|作|存在|相交|应|要|必|得)|无需|并非|误以为|错误|勿|无法|不能|假设|反例|如果|若/.test(s)).slice(0,120);
      // Midpoints/feet may feed later constructions; re-read only this bounded
      // vocabulary until the graph stops growing. Never parse arbitrary code.
      for(let pass=0;pass<4;pass++){
        const before=report.added.length;
        for(const s of clauses){
          if(root.DongSceneAudit.declared(s).some(name=>blockedPoints.has(aliasKey(part,name))))continue;
          for(const re of [new RegExp('(?:设|取|记)?(?:点)?'+token+'(?:为|是)(?:线段|弦)?'+token+token+'的?中点','g'),new RegExp('(?:线段|弦)'+token+token+'的?中点(?:为|是|记为)(?:点)?'+token,'g')])for(const m of s.matchAll(re)){
            const order=m[0].startsWith('线段')||m[0].startsWith('弦')?[m[3],m[1],m[2]]:[m[1],m[2],m[3]],refs=[point(order[1]),point(order[2])];
            if(checkExisting(part,order[0],'midpoint',refs))continue;
            if(refs.every(Boolean))add(part,{op:'midpoint',refs,label:order[0]});else pending(part,order[0],'中点的两个端点尚未定位');
          }
          for(const re of [new RegExp('(?:设|取|记)?(?:点)?'+token+'(?:为|是)(?:点)?'+token+'关于([xy])轴的?对称点','g'),new RegExp('(?:点)?'+token+'关于([xy])轴的?对称点(?:为|是|记为)(?:点)?'+token,'g')])for(const m of s.matchAll(re)){
            const reverse=/关于[xy]轴/.test(m[0])&&!/(?:为|是).+关于/.test(m[0]),name=reverse?m[3]:m[1],original=reverse?m[1]:m[2],axis=reverse?m[2]:m[3],refs=[point(original)],parameters={axis,axisValue:0};
            if(checkExisting(part,name,'reflect_axis',refs,parameters))continue;if(refs[0])add(part,{op:'reflect_axis',refs,label:name,...parameters});else pending(part,name,'对称点的原点尚未定位');
          }
          for(const re of [new RegExp('(?:点)?'+token+'(?:为|是)(?:点)?'+token+'关于(?:点)?'+token+'的?对称点','g'),new RegExp('(?:点)?'+token+'关于(?:点)?'+token+'的?对称点(?:为|是|记为)(?:点)?'+token,'g')])for(const m of s.matchAll(re)){
            const reverse=!/(?:为|是).+关于/.test(m[0]),name=reverse?m[3]:m[1],original=reverse?m[1]:m[2],center=reverse?m[2]:m[3],refs=[point(original),point(center)];
            if(checkExisting(part,name,'reflect_center',refs))continue;if(refs.every(Boolean))add(part,{op:'reflect_center',refs,label:name});else pending(part,name,'中心对称所需的原点或对称中心尚未定位');
          }
          const gradientTargets=new Set();
          for(const m of s.matchAll(new RegExp('(?:在)?(?:点)?'+token+'(?:点)?处(?:的)?切线','g')))gradientTargets.add(m[1]);
          for(const m of s.matchAll(new RegExp('(?:在)?(?:点)?'+token+'(?:点)?[、,，和与](?:点)?'+token+'(?:两点|点)?(?:处)?(?:的)?切线','g'))){gradientTargets.add(m[1]);gradientTargets.add(m[2]);}
          for(const name of gradientTargets){
            const ref=point(name),label=name+' 点切线';
            if(ref){const node=add(part,{op:'tangent',refs:[ref,'$conic'],label,role:'tangent'});if(!node)pending(part,label,'切点未在主曲线上，或当前无法定位');}
            else pending(part,label,'切点尚未定位');
          }
          const tangent=name=>all().find(n=>(n.op==='tangent'||n.role==='tangent')&&JSON.stringify(n.refs)===JSON.stringify([point(name),'$conic']));
          for(const m of s.matchAll(new RegExp(token+'(?:点)?处(?:的)?切线(?:记为|为|是)('+alias+')(?![A-Za-z0-9])','g')))bindAlias(part,tangent(m[1]),m[2]);
          for(const m of s.matchAll(new RegExp(token+'(?:点)?[、,，和与](?:点)?'+token+'(?:两点|点)?(?:处)?(?:的)?切线分别(?:为|记为)('+alias+')[、,，和与]('+alias+')(?![A-Za-z0-9])','g'))){bindAlias(part,tangent(m[1]),m[3]);bindAlias(part,tangent(m[2]),m[4]);}
          for(const m of s.matchAll(new RegExp('(?:点)?'+token+'到直线('+lineName+')的?垂足(?:为|是|记为)(?:点)?'+token,'g'))){
            const name=m[3],refs=[point(m[1]),line(part,m[2])];if(checkExisting(part,name,'foot',refs))continue;
            if(refs.every(Boolean))add(part,{op:'foot',refs,label:name});else pending(part,name,'垂足所需的点或直线尚未定位');
          }
          for(const m of s.matchAll(new RegExp('(?:直线|切线)?('+lineName+')(?:与|和)(?:直线|切线)?('+lineName+')交于(?:点)?'+token,'g'))){
            const name=m[3],refs=[line(part,m[1]),line(part,m[2])];if(checkExisting(part,name,'intersection',refs))continue;
            if(refs.every(Boolean))add(part,{op:'intersection',refs,branch:0,label:name});else pending(part,name,'交点所需的两条直线尚未定位');
          }
          for(const m of s.matchAll(new RegExp('(?:两条|两)切线交于(?:点)?'+token,'g'))){
            let tangents=gradientTargets.size===2?[...gradientTargets].map(tangent).filter(Boolean):gradientTargets.size?[]:all().filter(n=>(n.op==='tangent'||n.role==='tangent')&&n.refs?.[1]==='$conic'&&root.DongSceneAudit.visible(n,part.index));
            if(!gradientTargets.size&&tangents.length<2){
              const earlier=all().filter(n=>owned(n)&&n.part==null&&n.visible!==false&&(n.op==='tangent'||n.role==='tangent')&&n.refs?.[1]==='$conic'&&n.parts?.some(index=>Number(index)<Number(part.index)));
              tangents=[...new Map([...tangents,...earlier].map(n=>[n.id,n])).values()];
            }
            if(tangents.length===2){for(const node of tangents)share(part,node);const refs=tangents.map(n=>n.id);if(!checkExisting(part,m[1],'intersection',refs))add(part,{op:'intersection',refs,branch:0,label:m[1]});}else pending(part,m[1],'未能唯一确定本问所指的两条切线');
          }
          for(const m of s.matchAll(new RegExp('(?:连接|连结)'+token+token,'g'))){const refs=[point(m[1]),point(m[2])];if(refs.every(Boolean))add(part,{op:'segment',refs,label:m[1]+m[2]});}
          // A later part can reference an established object without restating
          // its definition. Share only our automatic scopes, never user ones.
          for(const name of root.DongSceneAudit.declared(s)){const ref=point(name);if(ref)share(part,all().find(n=>n.id===ref));}
          for(const m of s.matchAll(new RegExp('(?:直线|切线)('+alias+')(?![A-Za-z0-9])','g'))){
            const matches=all().filter(n=>lineNode(n)&&[n.label,...(Array.isArray(n.aliases)?n.aliases.slice(0,12):[])].some(label=>canonical(label)===canonical(m[1])));
            if(matches.length===1&&!blockedAliases.has(aliasKey(part,m[1])))share(part,matches[0]);
          }
        }
        if(report.added.length===before)break;
      }
      // Definitions can follow their uses. Undo only this part's automatic
      // additions/shares that depend on a subsequently rejected point.
      const affected=new Set(all().filter(node=>blockedPoints.has(aliasKey(part,node.label))).map(node=>node.id));
      for(const feature of current()?.features||[])if(blockedPoints.has(aliasKey(part,feature.name)))affected.add('feature:'+feature.name);
      for(let pass=0;pass<all().length;pass++){
        let changed=false;
        for(const node of all())if(!affected.has(node.id)&&node.refs?.some(ref=>affected.has(ref))){affected.add(node.id);changed=true;}
        if(!changed)break;
      }
      const discarded=new Set();
      for(const node of all()){
        if(!affected.has(node.id)||!owned(node))continue;
        if(originalScopes.has(node.id)){
          const original=originalScopes.get(node.id);
          if(original.parts===undefined)delete node.parts;else node.parts=original.parts;
        }else{
          discarded.add(node.id);
          pending(part,node.label,'所依赖的同名点定义未确认，已撤回本问自动构造',true);
        }
      }
      scene.objects=scene.objects.filter(node=>!discarded.has(node.id));
      report.added=report.added.filter(node=>!discarded.has(node.id));
    }
    // Successful later passes settle earlier missing prerequisites.
    report.unresolved=report.unresolved.filter(n=>n.dependencyUnconfirmed||!all().some(o=>canonical(o.label)===canonical(n.label)&&current()?.engine.resolve(o.id))&&!current()?.features.some(p=>canonical(p.name)===canonical(n.label)&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
    return report;
  }
  root.DongAnswerGeometry={install};
})(typeof window==='object'?window:globalThis);
