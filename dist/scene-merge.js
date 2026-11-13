/* Merge independently derived nodes with their complete dependency closure. */
(()=>{
  'use strict';
  const pointOps=new Set(['point_on','midpoint','inverse','reflect_center','reflect_axis','foot','ellipse_tangent_point','intersection','second_intersection']);
  function category(node){
    if(node.kind==='point'||pointOps.has(node.op))return 'point';
    if(node.kind==='circle'||node.op==='circle')return 'circle';
    if(node.kind==='conic')return 'conic';
    if(node.op==='distance')return 'measure';
    return ['line','slope','vertical','through_points'].includes(node.kind)||['line','segment','ray','parallel','perpendicular','tangent','normal','line_angle'].includes(node.op)?'line':node.kind||node.op;
  }
  function remapReferences(value,mapping){
    if(typeof value==='string')return mapping[value]||value;
    if(Array.isArray(value))return value.map(item=>remapReferences(item,mapping));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,remapReferences(item,mapping)]));
    return value;
  }
  function mergeDerived(target,verified){
    const groups=['objects','lines'],source=new Map(),existing=[];
    for(const group of groups){
      for(const node of verified[group]||[])if(node.id)source.set(node.id,{group,node});
      for(const node of target[group]||[])existing.push({group,node});
    }
    const selected=new Set(),pointAliases=new Map();
    const dynamicNames=new Set(verified.dynamicLine||verified.showDynamic?verified.dynamicIntersectionLabels||['A','B']:[]);
    for(const [id,{node}] of source)if(category(node)==='point'&&node.label&&!Object.hasOwn(verified.points||{},node.label)&&!dynamicNames.has(node.label)){
      const key='feature:'+node.label;pointAliases.set(key,pointAliases.has(key)?null:id);
    }
    function include(id){
      id=pointAliases.get(id)||id;
      if(selected.has(id)||!source.has(id))return;
      selected.add(id);
      for(const ref of source.get(id).node.refs||[])include(ref);
    }
    for(const [id,{node}] of source)if(node.source==='derived')include(id);
    const remap=new Map(),replaced=new Set(),consumed=new Set(),warnings=[];
    const usedIds=new Set(existing.map(e=>e.node.id).filter(Boolean));
    const manual=node=>['user','manual'].includes(node.source);
    for(const id of selected){
      const node=source.get(id).node;
      const compatible=e=>!consumed.has(e.node)&&!manual(e.node)&&category(e.node)===category(node);
      const match=existing.find(e=>e.node.id===id&&compatible(e))||existing.find(e=>node.label&&e.node.label===node.label&&compatible(e));
      let mapped=match?.node.id||id;
      if(!match&&usedIds.has(mapped)){let suffix=1;while(usedIds.has(id+'-derived-'+suffix))suffix++;mapped=id+'-derived-'+suffix;}
      usedIds.add(mapped);if(match)consumed.add(match.node);
      remap.set(id,mapped);if(match)replaced.add(match.node);
    }
    for(const group of groups)target[group]=(target[group]||[]).filter(node=>!replaced.has(node));
    const mapping=Object.fromEntries(remap);
    for(const [alias,id] of pointAliases)if(id&&selected.has(id)&&!Object.hasOwn(target.points||{},alias.slice(8))&&!dynamicNames.has(alias.slice(8)))mapping[alias]=remap.get(id);
    const usedLabels=new Set(groups.flatMap(group=>target[group]).map(node=>node.label).filter(Boolean));
    for(const id of selected){
      const {group,node}=source.get(id),copy=JSON.parse(JSON.stringify(node));
      copy.id=remap.get(id);
      if(copy.refs)copy.refs=remapReferences(copy.refs,mapping);
      if(copy.pointRef)copy.pointRef=remapReferences(copy.pointRef,mapping);
      if(copy.construction?.inputs)copy.construction.inputs=remapReferences(copy.construction.inputs,mapping);
      if(copy.label&&usedLabels.has(copy.label)){
        const original=copy.label;let suffix=1,label=original+'（解析）';while(usedLabels.has(label))label=original+'（解析'+(++suffix)+'）';copy.label=label;
        warnings.push('已保留原有对象 '+original+'；独立复算对象显示为 '+label+'。');
      }
      if(copy.label)usedLabels.add(copy.label);
      target[group].push(copy);
    }
    // Imported feature aliases may refer to constructed points, which are not
    // fixed features. Preserve existing dependents, but bind those aliases to
    // the corrected object ID rather than an unresolvable feature name.
    for(const group of groups)for(const node of target[group])if(!manual(node)&&!selected.has(node.id)){
      if(node.refs)node.refs=node.refs.map(ref=>mapping[ref]&&ref.startsWith('feature:')?mapping[ref]:ref);
    }
    target.provenance={...target.provenance,derivedIdMap:{...target.provenance?.derivedIdMap,...mapping},mergeWarnings:warnings};
    return selected.size;
  }
  const auxiliaryOps=new Set(['segment','line','ray','vector','midpoint','distance','perp_bisector','parallel','perpendicular','foot','circle','circumcircle']);
  const unordered=new Set(['segment','line','midpoint','distance','perp_bisector','circumcircle']);
  const sameNumber=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
  const samePoint=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&a.every((value,i)=>sameNumber(value,b[i]));
  const scope=node=>node?.part!=null?[node.part]:node?.parts?.length?node.parts:null;
  const activeChord=scene=>scene.showDynamic!==false&&(scene.dynamicLine===true||scene.showDynamic===true);
  const namedKey=label=>String(label||'').replace(/['’]/g,'′').replace(/_/g,'').replace(/[₀₁₂₃₄₅₆₇₈₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c));
  function signature(node){
    if(!node.op||!Array.isArray(node.refs))return '';
    const refs=unordered.has(node.op)?[...node.refs].sort():node.refs;
    return JSON.stringify([node.op,refs]);
  }
  function keepAuxiliaries(target,reply,parts,audit,construct){
    const accepted=[],archived=[];
    if(!reply?.provenance?.validatedConstructions)return {accepted,archived};
    const incoming=[...(reply.objects||[]),...(reply.lines||[])];
    const parameters={ellipse:['a','b'],hyperbola:['a','b'],circle:['r'],parabola:['p']}[target.type]||[];
    const sameFrame=reply.type===target.type&&(target.orientation||'horizontal')===(reply.orientation||'horizontal')&&
      (target.type!=='parabola'||(target.direction||1)===(reply.direction||1))&&
      sameNumber(target.h??0,reply.h??0)&&sameNumber(target.k??0,reply.k??0)&&parameters.every(key=>sameNumber(target[key],reply[key]));
    const reject=(node,reason)=>archived.push({label:node.label||node.id,reason});
    if(!sameFrame){for(const node of incoming)reject(node,'主曲线或坐标系不一致');return {accepted,archived};}

    const scopes=[...new Set(parts.map(part=>part.index))],all=new Map([...target.objects||[],...target.lines||[]].map(node=>[node.id,node]));
    const primary=target.dynamicIntersectionLabels||['A','B'],secondary=target.pairedChord?.labels||[];
    const implicit=new Set(target.type==='parabola'?['O','F','V']:target.type==='circle'?['O']:['O','F₁','F₂','A₁','A₂']);
    const pointNames=new Set([...implicit,...Object.keys(target.points||{}),
      ...(activeChord(target)?[...primary,...secondary]:[]),target.fixedPoint?.name].filter(Boolean));
    const usedNames=new Set([...pointNames,...[...all.values()].map(node=>node.label),
      ...[...all.values()].flatMap(node=>node.aliases||[]),...(target.polygons||[]).map(node=>node.label),
      ...(activeChord(target)?[target.dynamicLineLabel||'l',target.pairedChord?.lineLabel]:[])].filter(Boolean).map(namedKey));
    const stableAnchor=name=>{
      if(Object.hasOwn(reply.points||{},name))return samePoint(reply.points[name],target.points?.[name])&&!target.pointBindings?.[name];
      return implicit.has(name)&&!Object.hasOwn(target.points||{},name);
    };
    const origin=target.lineThrough||'center';
    const dynamic=activeChord(target)&&activeChord(reply)&&origin===(reply.lineThrough||'center')&&
      primary.every((name,i)=>name===reply.dynamicIntersectionLabels?.[i])&&
      (!origin.startsWith('point:')||stableAnchor(origin.slice(6)));
    const dynamicScope=target.dynamicLinePart!=null?[target.dynamicLinePart]:target.dynamicLineParts?.length?target.dynamicLineParts:null;
    const signatures=new Set([...all.values()].map(signature).filter(Boolean)),kept=new Set(),processed=new Set();
    const dependencyScope=ref=>{
      if(ref==='$conic')return null;
      if(ref==='$dynamic')return dynamic?dynamicScope:undefined;
      if(!ref.startsWith('feature:'))return kept.has(ref)?scope(all.get(ref)):undefined;
      const name=ref.slice(8);
      if(activeChord(target)&&primary.includes(name))return dynamic&&!Object.hasOwn(reply.points||{},name)?dynamicScope:undefined;
      if(secondary.includes(name)||name===target.fixedPoint?.name)return undefined;
      return stableAnchor(name)?target.pointParts?.[name]||null:undefined;
    };
    const byId=new Map(incoming.map(node=>[node.id,node])),active=new Set();
    const frames=new Map();
    target.objects||=[];
    const resolve=(part,id)=>{
      if(!frames.has(part))frames.set(part,audit.frame({...target,activePart:part},construct));
      return frames.get(part)?.engine.resolve(id);
    };
    function admit(node){
      if(processed.has(node.id)||active.has(node.id))return;
      active.add(node.id);
      try{
        if(!auxiliaryOps.has(node.op)||!Array.isArray(node.refs)){reject(node,'没有可复用的依赖构造');return;}
        const label=namedKey(node.label);
        if(all.has(node.id)||usedNames.has(label)||signatures.has(signature(node))){reject(node,'与已核验的对象重名或重复');return;}
        for(const ref of node.refs){const parent=byId.get(ref);if(parent)admit(parent);}
        const dependencies=node.refs.map(dependencyScope);
        if(dependencies.some(value=>value===undefined)){reject(node,'依赖的点线在复算图中无法对应');return;}
        const allowed=scopes.filter(part=>dependencies.every(value=>!value||value.includes(part)));
        const requested=scope(node);
        if(!allowed.length||requested?.some(part=>!allowed.includes(part))){reject(node,'依赖对象不在同一小问');return;}
        const candidate={...node,refs:[...node.refs],source:'model'};
        if(!requested&&allowed.length<scopes.length)candidate.parts=allowed;
        target.objects.push(candidate);
        const valid=(requested||allowed).every(part=>resolve(part,node.id));
        if(!valid){target.objects.pop();reject(node,'当前构型中无法生成');return;}
        kept.add(node.id);all.set(node.id,candidate);usedNames.add(label);signatures.add(signature(node));
        accepted.push(candidate.label);
      }finally{active.delete(node.id);processed.add(node.id);}
    }
    for(const node of incoming)admit(node);
    return {accepted,archived};
  }
  window.DongSceneMerge={mergeDerived,remapReferences,keepAuxiliaries};
})();
