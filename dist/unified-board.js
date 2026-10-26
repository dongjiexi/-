/* One visible workbench; GeoGebra is a renderer, never a second destination.
 * The native renderer is a lossless offline / unsupported-construction fallback.
 */
(() => {
  'use strict';
  let options,source=null,started=false,failed=false,active=false,slot,board,status,tools,observer,pendingDraft=null,closePointFinder=()=>{};
  const current=()=>options?.scene()||{isFreeBoard:true,objects:[],showDynamic:false};
  const sceneKey=value=>JSON.stringify(value);
  function message(text){status.querySelector('span').textContent=text;}
  function activate(value){
    if(!value)closePointFinder();
    active=value;board.dataset.renderer=value?'geogebra':'native';
    board.toggleAttribute('data-ggb-active',value);
    if(value)board.dataset.ggbActive='true';
    window.dispatchEvent(new Event('resize'));
  }
  function ready(report){
    if(report.signature!==sceneKey(current()))return;
    if(pendingDraft&&pendingDraft.sceneSignature===report.signature){const record=pendingDraft;pendingDraft=null;window.DongGeoGebra.restoreMatching(record).then(ok=>{if(!ok)message('题图已恢复，但附加图稿不匹配，未覆盖当前图形。');else window.DongGeoGebra.save().catch(failure);}).catch(failure);}
    failed=false;
    const reasons=[...report.skipped];
    if(current().unrestrictedMotion)reasons.push('无限制移动');
    activate(!reasons.length);
    message(reasons.length?'已自动保留完整教学构造；当前使用兼容绘制，不会省略题设对象。':'题图已同步 · 拖动与参数联动 · 图稿自动保存在此设备');
    status.querySelector('button').hidden=true;
    status.title=reasons.join('、');
    options.highlight?.();
  }
  function failure(error){
    failed=true;activate(false);
    message('在线画板暂未加载，已保留可用画面与全部题设构造。');
    status.title=String(error?.message||'');status.querySelector('button').hidden=false;
  }
  function tool(label,action,parent){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',()=>{try{action();}catch(error){message(error.message);}});
    parent.append(button);return button;
  }
  function makeTools(){
    const host=document.querySelector('.dong-ggb-head');if(!host||tools)return;
    tools=document.createElement('details');tools.className='unified-tools';
    const summary=document.createElement('summary');summary.textContent='作图工具';tools.append(summary);
    const content=document.createElement('div');content.className='unified-tool-content';tools.append(content);
    tool('收起工具',()=>{tools.open=false;summary.focus();},content);
    const groups=[
      ['点与线',[[0,'选择 / 拖动'],[1,'点'],[501,'轨迹上的点'],[2,'两点直线'],[15,'线段'],[18,'射线'],[7,'向量'],[5,'交点'],[19,'中点']]],
      ['依赖构造',[[3,'平行线'],[4,'垂线'],[8,'垂直平分线'],[9,'角平分线'],[13,'切线'],[30,'轴对称'],[29,'中心对称'],[31,'平移'],[32,'旋转'],[33,'位似']]],
      ['曲线与图形',[[10,'两点定圆'],[11,'三点定圆'],[55,'三点椭圆'],[56,'三点双曲线'],[57,'焦点与准线抛物线'],[12,'五点圆锥曲线'],[16,'多边形'],[51,'正多边形'],[47,'轨迹']]],
      ['测量与演示',[[38,'长度'],[36,'角度'],[49,'面积'],[50,'斜率'],[40,'平移视野'],[62,'画笔'],[27,'隐藏 / 显示'],[28,'显示标签']]]
    ];
    for(const [title,items]of groups){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);for(const [mode,label]of items)tool(label,()=>{window.DongGeoGebra.getAPI()?.setMode(mode);message('已选择“'+label+'”：请在画板上选择相应对象。');},group);content.append(group);}
    const templates=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='按参数添加';templates.append(legend);
    for(const [kind,label]of [['ellipse','椭圆'],['hyperbola','双曲线'],['parabola','抛物线'],['circle','圆']])tool(label,()=>document.querySelector('[data-add-conic="'+kind+'"]').click(),templates);
    content.append(templates);host.prepend(tools);
    const files=host.querySelector('.dong-ggb-tools');
    makePointFinder(host,files);
    tool('整理点名',()=>{const result=window.DongGeoGebra.arrangeLabels();message(result.unresolved?'已整理点名；局部仍拥挤，可放大画面后再次整理。':'已整理点名；只调整文字位置，不改变几何关系。');window.DongGeoGebra.save().catch(failure);files.open=false;},files.querySelector('div'));
    for(const menu of [tools,files])menu.addEventListener('toggle',()=>{if(menu.open)for(const other of [tools,files])if(other!==menu)other.open=false;});
    document.addEventListener('pointerdown',event=>{for(const menu of [tools,files])if(!menu.contains(event.target))menu.open=false;});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const menu of [tools,files])if(menu.open){menu.open=false;menu.querySelector('summary').focus();}});
    makeSettings(host);
    tool('撤销作图',()=>window.DongGeoGebra.getAPI()?.undo(),host);
    tool('重做作图',()=>window.DongGeoGebra.getAPI()?.redo(),host);
    tool('保存完整图稿',()=>exportBoard().catch(error=>message(error.message)),host);
    const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;host.append(file);
    tool('打开完整图稿',()=>file.click(),document.querySelector('.dong-ggb-tools>div'));
    file.addEventListener('change',async()=>{
      try{const selected=file.files[0];if(!selected)return;if(selected.size>6*1024*1024)throw new Error('图稿超过 6 MB。');const data=JSON.parse(await selected.text());if(data.format!=='dongjiexi-board'||data.version!==1||!data.scene)throw new Error('请选择董解析导出的完整图稿。');
        stageDraft(data.boardDraft);if(active)await window.DongGeoGebra.save();options.restore(data.scene);
        if(pendingDraft&&window.DongGeoGebra.getReport().signature===pendingDraft.sceneSignature)ready(window.DongGeoGebra.getReport());
      }catch(error){pendingDraft=null;message(error.message);}finally{file.value='';}
    });
  }
  function makePointFinder(host,files){
    const panel=document.createElement('div');panel.hidden=true;panel.id='boardPointFinder';
    panel.style.cssText='flex-basis:100%;min-width:0;padding:8px;border:1px solid #c9a98b;border-radius:8px;background:#fff9ef';
    const label=document.createElement('label');label.textContent='查找点 ';const select=document.createElement('select');select.setAttribute('aria-label','选择要定位的点');select.style.cssText='max-width:100%;min-width:120px';label.append(select);panel.append(label);
    const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.style.cssText='margin:6px 0 0;font-size:12px';
    const pointInfo=document.createElement('div');pointInfo.id='boardPointInfo';pointInfo.style.cssText='font-size:12px;overflow-wrap:anywhere;margin-top:6px';
    let infoKey='';
    const clearInfo=()=>{if(infoKey){pointInfo.replaceChildren();infoKey='';}};
    const marker=document.createElement('div');marker.id='boardPointLocator';marker.hidden=true;marker.setAttribute('aria-hidden','true');
    // A read-only DOM overlay: never add a geometric object, alter style, or
    // serialize a temporary highlight into the user's GGB construction.
    marker.style.cssText='position:fixed;pointer-events:none;z-index:9999;width:26px;height:26px;border:3px solid #9d3828;border-radius:50%;box-shadow:0 0 0 3px #ffffffcc;transform:translate(-50%,-50%);box-sizing:border-box';
    document.body.append(marker);let timer=0;
    const say=text=>{if(feedback.textContent!==text)feedback.textContent=text;};
    const tick=()=>{
      marker.hidden=true;if(panel.hidden||!active){clearInfo();return;}
      try{
        const a=window.DongGeoGebra.getAPI(),name=select.value;
        if(!name){clearInfo();say('选择点名后用定位圈标出位置；不会移动点或修改图稿。');return;}
        if(!a.exists(name)||a.getObjectType(name)!=='point'){clearInfo();say('这个点已删除或改名，请刷新点名。');return;}
        if(!a.isDefined(name)){clearInfo();say('这个点当前未定义，请检查交点或构造条件。');return;}
        const px=a.getXcoord(name),py=a.getYcoord(name),definition=a.getCommandString(name,false)||a.getDefinitionString(name,false)||'';
        const key=JSON.stringify([name,px,py,definition]);
        if(key!==infoKey){
          infoKey=key;pointInfo.replaceChildren();
          const row=document.createElement('div');row.textContent='坐标读数（近似）：';const value=document.createElement('span');
          const format=n=>Number.isFinite(n)?String(Number(n.toPrecision(10))):'?';
          const expression='('+format(px)+', '+format(py)+')';
          if(window.katex)window.katex.render(expression.replace(/e([+-]?\d+)/g,'\\times 10^{$1}'),value,{throwOnError:false,trust:false});else value.textContent=expression;
          row.append(value);pointInfo.append(row);
          const source=document.createElement('div');source.textContent=definition?'构造表达式：'+definition:'独立点或坐标定义点；此处不推断其题设身份。';pointInfo.append(source);
        }
        if(!a.getVisible(name)){say('这个点已隐藏；定位不会自动显示它。');return;}
        const raw=a.getViewProperties(1),v=typeof raw==='string'?JSON.parse(raw):raw;
        if(!v||![v.width,v.height,v.invXscale,v.invYscale].every(n=>Number.isFinite(n)&&n>0)){say('当前视图尚未就绪。');return;}
        const canvases=[...document.querySelectorAll('#dong-geogebra-applet canvas')].map(c=>c.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
        const rect=canvases.sort((a,b)=>b.width*b.height-a.width*a.height)[0];
        if(!rect){say('请展开图像栏目查看定位。');return;}
        const x=(a.getXcoord(name)-v.xMin)/v.invXscale,y=v.height-(a.getYcoord(name)-v.yMin)/v.invYscale;
        if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>v.width||y>v.height){say('这个点在当前视野外；可缩小画面或使用“适应全部图形”。');return;}
        const left=rect.left+x*rect.width/v.width,top=rect.top+y*rect.height/v.height;
        if(left<0||left>innerWidth||top<0||top>innerHeight){say('请滚动到画板查看定位。');return;}
        marker.style.left=left+'px';marker.style.top=top+'px';marker.hidden=false;
        say('正在定位 '+(a.getCaption(name)||name)+'（对象 '+name+'）；定位圈随点移动，不是新增点。');
      }catch{clearInfo();say('画板正在更新，请稍候或刷新点名。');}
    };
    const refresh=()=>{
      const previous=select.value,a=window.DongGeoGebra.getAPI();select.replaceChildren();
      const empty=document.createElement('option');empty.value='';empty.textContent='请选择点名';select.append(empty);
      for(const name of a.getAllObjectNames())if(a.getObjectType(name)==='point'){
        const item=document.createElement('option'),caption=a.getCaption(name)||name;item.value=name;
        item.textContent=(caption===name?name:caption+'（'+name+'）')+(!a.isDefined(name)?' · 未定义':!a.getVisible(name)?' · 已隐藏':'');select.append(item);
      }
      select.value=[...select.options].some(o=>o.value===previous)?previous:'';tick();
    };
    tool('刷新点名',refresh,panel);
    closePointFinder=()=>{clearInterval(timer);timer=0;panel.hidden=true;marker.hidden=true;select.value='';clearInfo();};
    window.addEventListener('dong:board-rebuilt',closePointFinder);
    tool('结束定位',closePointFinder,panel);panel.append(feedback,pointInfo);host.append(panel);
    select.addEventListener('change',tick);
    tool('查找点',()=>{if(!active)return;files.open=false;tools.open=false;panel.hidden=false;refresh();clearInterval(timer);timer=setInterval(tick,250);select.focus();},files.querySelector('div'));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){closePointFinder();event.preventDefault();}});
  }
  function makeSettings(host){
    const dialog=document.createElement('dialog');dialog.className='board-settings-dialog';dialog.id='boardSettings';dialog.setAttribute('aria-labelledby','boardSettingsTitle');
    dialog.innerHTML='<header><h2 id="boardSettingsTitle">画板设置</h2><button type="button" data-close>完成</button></header><div class="board-settings-grid"><fieldset><legend>视图</legend><label>显示网格<input type="checkbox" data-setting="grid"></label><label>显示 x 轴<input type="checkbox" data-setting="x"></label><label>显示 y 轴<input type="checkbox" data-setting="y"></label><button type="button" data-fit>适应全部图形</button></fieldset><fieldset><legend>对象外观</legend><label>选择对象<select data-setting="object" aria-label="选择外观对象"></select></label><label>颜色<input type="color" data-setting="color"></label><label>线条粗细<input type="range" min="1" max="9" step="1" data-setting="thickness"></label><label>显示名称<input type="checkbox" data-setting="label"></label></fieldset></div><p class="board-settings-note">设置即时生效；只修改显示效果，不改变题设坐标或构造关系。随完整图稿保存。</p><p role="status" data-feedback></p>';
    document.body.append(dialog);const get=key=>dialog.querySelector('[data-setting="'+key+'"]'),api=()=>window.DongGeoGebra.getAPI();
    const feedback=dialog.querySelector('[data-feedback]');
    const update=fn=>{try{fn();api().setUndoPoint?.();window.DongGeoGebra.save().catch(error=>feedback.textContent=error.message);feedback.textContent='已应用';}catch(error){feedback.textContent=error.message;}};
    const readStyle=()=>{const label=get('object').value,disabled=!label;for(const key of ['color','thickness','label'])get(key).disabled=disabled;if(disabled)return;const color=api().getColor(label);get('color').value=/^#[0-9a-f]{6}$/i.test(color)?color:'#3f78d8';get('thickness').value=api().getLineThickness(label)||3;get('label').checked=api().getLabelVisible(label)!==false;};
    tool('画板设置',()=>{
      if(!active)return;tools.open=false;host.querySelector('.dong-ggb-tools').open=false;feedback.textContent='';
      const raw=api().getGraphicsOptions?.(1),view=typeof raw==='string'?JSON.parse(raw):raw||{};
      get('grid').checked=typeof api().getGridVisible?.(1)==='boolean'?api().getGridVisible(1):document.getElementById('gridToggle').checked;
      const axes=view.axes||{};get('x').checked=axes.x?.visible !== false;get('y').checked=axes.y?.visible !== false;
      const names=api().getAllObjectNames?.()||[];get('object').replaceChildren();
      for(const label of names)if(api().getVisible(label)){const option=document.createElement('option');option.value=label;option.textContent=api().getCaption(label)||label;get('object').append(option);}
      readStyle();dialog.showModal();
    },host);
    dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
    dialog.querySelector('[data-fit]').addEventListener('click',()=>update(()=>api().showAllObjects()));
    get('object').addEventListener('change',readStyle);
    get('grid').addEventListener('change',()=>update(()=>{api().setGridVisible(get('grid').checked);const control=document.getElementById('gridToggle');control.checked=get('grid').checked;control.dispatchEvent(new Event('change',{bubbles:true}));}));
    for(const key of ['x','y'])get(key).addEventListener('change',()=>update(()=>api().setAxesVisible(get('x').checked,get('y').checked)));
    get('color').addEventListener('change',()=>update(()=>{const color=get('color').value;api().setColor(get('object').value,...[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)));}));
    get('thickness').addEventListener('change',()=>update(()=>api().setLineThickness(get('object').value,Number(get('thickness').value))));
    get('label').addEventListener('change',()=>update(()=>api().setLabelVisible(get('object').value,get('label').checked)));
  }
  async function begin(){
    if(started&&!failed)return;started=true;failed=false;source=current();
    message('正在准备动态画板；加载期间仍可使用当前画面。');
    const work=window.DongGeoGebra.open(source,slot,current,{automatic:true,changed:options.changed,ready,failed:failure});
    makeTools();activate(false);
    await work;
  }
  function mount(config){
    options=config;board=document.querySelector('.board-shell');slot=document.querySelector('#geoGebraInlineSlot');
    document.body.dataset.singleBoard='true';board.dataset.renderer='native';
    status=document.createElement('div');status.id='boardEngineStatus';status.setAttribute('role','status');
    const text=document.createElement('span');text.textContent='画板已就绪';status.append(text);
    const retry=tool('重试加载',()=>begin(),status);retry.hidden=true;
    board.querySelector('.board-toolbar').after(status);
    // Legacy entry elements remain as compatibility hooks, never user navigation.
    for(const id of ['openGeoGebra','openGeoGebraInline']){const el=document.getElementById(id);if(el)el.hidden=true;}
    document.querySelector('.native-compat')?.setAttribute('hidden','');
    observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){begin();observer.disconnect();}});
    observer.observe(board);
    board.addEventListener('click',event=>{
      if(!active)return;
      const target=event.target.closest('button,input'),id=target?.id,api=window.DongGeoGebra.getAPI();
      const actions={toolboxToggle:()=>{tools.open=!tools.open;target.textContent=tools.open?'收起作图工具':'展开作图工具';target.setAttribute('aria-expanded',String(tools.open));},zoomIn:()=>api.evalCommand('ZoomIn(1.25)'),zoomOut:()=>api.evalCommand('ZoomIn(0.8)'),homeButton:()=>api.showAllObjects(),gridToggle:()=>api.setGridVisible(target.checked)};
      if(actions[id]){event.stopImmediatePropagation();actions[id]();}
    },true);
    // Escape closes only the open tool drawer, not the workbench itself.
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tools?.open){tools.open=false;event.preventDefault();}});
    document.getElementById('saveLocal')?.addEventListener('click',()=>{if(active)window.DongGeoGebra.save().catch(error=>message(error.message));});
  }
  function sync(scene){
    if(!options)return;
    source=scene||current();
    if(!started)return;
    if(active&&sceneKey(source)!==window.DongGeoGebra.getReport().signature){message('正在同步当前题目与图形…');}
    window.DongGeoGebra.syncTeaching(source);
  }
  function highlight(ids){if(active)window.DongGeoGebra.highlight(ids);}
  function snapshot(){return window.DongGeoGebra.getSaved(sceneKey(current()))||null;}
  function stageDraft(record){
    if(!record){pendingDraft=null;return;}
    if(typeof record.base64!=='string'||record.base64.length>4*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(record.base64)||typeof record.sceneSignature!=='string'||record.sceneSignature.length>2*1024*1024||!Array.isArray(record.owned)||record.owned.length>5000||record.owned.some(label=>typeof label!=='string'||!/^[A-Za-z][A-Za-z0-9_]*$/.test(label)))throw new Error('附加图稿格式无效；原图保留。');
    pendingDraft=JSON.parse(JSON.stringify(record));
  }
  async function exportBoard(){
    const record=active?await window.DongGeoGebra.save():snapshot();
    const content={format:'dongjiexi-board',version:1,scene:record?.sceneSignature?JSON.parse(record.sceneSignature):current(),boardDraft:record};
    const url=URL.createObjectURL(new Blob([JSON.stringify(content)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='董解析-完整图稿.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function image(){return active?'data:image/png;base64,'+window.DongGeoGebra.getAPI().getPNGBase64(2,false,144):null;}
  window.DongUnifiedBoard=Object.freeze({mount,sync,highlight,snapshot,stageDraft,exportBoard,image,isActive:()=>active});
})();
