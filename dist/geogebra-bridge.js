/* 董解析 · official GeoGebra Classic integration.
 * GeoGebra® © GeoGebra GmbH, https://www.geogebra.org/
 * Official app assets are loaded on demand, not copied into this package.
 * Embedding: https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/
 * API: https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/
 * License: https://www.geogebra.org/license (non-commercial use).
 */
(() => {
  'use strict';
  const KEY = 'dongjiexi:geogebra:v1';
  const BACKUP = KEY + ':previous';
  let dialog, host, status, api, loading, scriptPromise, latestScene = null;
  let saveTimer, busy = false, previousFocus, sessionTitle = 'GeoGebra 自由作图';
  let inlineSlot=null, importReport={skipped:[]}, startGeneration=0, sceneProvider=null;
  let narrowLayout=null;
  const highlighted=new Map();
  let teachingBinding=null,linkedTimer=null,linkedRunning=false,linkedSignature='',linkedStructure='';
  const draftKey=()=>KEY+(teachingBinding?':teaching':'');
  const savedScene=signature=>[read(KEY+':teaching'),...(read(KEY+':teaching:archive')||[])].find(record=>record?.sceneSignature===signature);
  function additiveExtras(next){
    if(!linkedSignature||typeof api.getXML!=='function')return null;
    const before=JSON.parse(linkedSignature),oldObjects=before.objects||[],newObjects=next?.objects||[];
    const base=value=>{const result={...value};delete result.objects;return JSON.stringify(result);};
    if(base(before)!==base(next)||newObjects.length<=oldObjects.length||!oldObjects.every((item,i)=>JSON.stringify(item)===JSON.stringify(newObjects[i])))return null;
    const document=new DOMParser().parseFromString(api.getXML(),'application/xml'),construction=document.querySelector('construction');
    if(!construction||document.querySelector('parsererror'))return null;
    const owned=new Set(importReport.owned),nodes=[];
    for(const node of construction.children){
      const labels=node.hasAttribute('label')?[node.getAttribute('label')]:node.tagName==='command'?[...node.querySelector('output')?.attributes||[]].map(a=>a.value):[];
      if(labels.length&&labels.every(label=>!owned.has(label)))nodes.push({xml:new XMLSerializer().serializeToString(node),labels});
    }
    return {nodes,owned:[...owned],ids:[...importReport.ids||[]]};
  }
  function restoreExtras(extras){
    if(!extras?.nodes.length)return;
    if(!extras.owned.every(label=>api.exists(label))||!extras.ids.every(([id,label])=>importReport.ids.get(id)===label))return;
    if(extras.nodes.some(node=>node.labels.some(label=>api.exists(label))))return;
    // GeoGebra's XML insertion preserves the original dependency commands and
    // visual properties; imported material JavaScript is disabled at applet level.
    api.evalXML(extras.nodes.map(node=>node.xml).join(''));
  }
  async function restoreMatching(record){
    if(!record?.base64||record.sceneSignature!==linkedSignature||JSON.stringify(record.owned)!==JSON.stringify(importReport.owned))return false;
    await loadBase64(record.base64);
    if(!importReport.owned.every(label=>api.exists(label)))throw new Error('保存图稿与题目对象不一致，请使用图稿文件恢复。');
    return true;
  }
  const notifyReady=()=>teachingBinding?.ready?.({skipped:[...importReport.skipped],signature:linkedSignature});
  const structureKey=scene=>{const value={...scene};for(const key of ['a','b','h','k','p','r','theta','parameterExpressions'])delete value[key];if(!scene?.objects?.some(o=>o.motionByPart))delete value.activePart;return JSON.stringify(value);};
  function resizeApplet(){
    if(!api||!dialog?.open||!host.clientWidth)return;
    api.setSize(Math.max(300,host.clientWidth),Math.max(180,host.clientHeight));
    const narrow=host.clientWidth<600;
    if(narrowLayout!==narrow){narrowLayout=narrow;api.setPerspective(teachingBinding||narrow?'G':'AG');api.showAlgebraInput(!teachingBinding&&!narrow);}
  }
  const importedMessage=()=>importReport.skipped.length?'部分导入；未转换对象：'+importReport.skipped.join('、')+'。原画板完整保留，请返回原画板核对。':teachingBinding?'题目与画板已同步；参数请在董解析参数区调整。':'已导入支持的图形；此处为独立探索图稿，不自动回写题目答案。';
  const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const positive = (value, fallback) => Math.max(0.000001, Math.abs(finite(value, fallback)));
  const number = value => String(Math.round(finite(value) * 1e10) / 1e10);
  const info = message => { if (status) status.textContent = message; };
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const wrap = fn => (...args) => Promise.resolve().then(() => fn(...args)).catch(error => info(error.message || '操作未完成。'));

  function buildShell() {
    if (dialog) return;
    const css = document.createElement('style');
    css.textContent = `
      .dong-ggb-dialog{position:fixed;inset:0;z-index:10000;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#f6f8fb;color:#0c1b33;font-family:"Microsoft YaHei UI",system-ui,sans-serif;}
      .dong-ggb-dialog[open]{display:flex;flex-direction:column;}
      .dong-ggb-dialog.dong-ggb-inline{position:relative;inset:auto;z-index:auto;width:100%;height:78dvh;min-height:480px;max-height:none;box-sizing:border-box;}
      .board-shell[data-ggb-active="true"]>:not(#geoGebraInlineSlot):not(.board-toolbar):not(#boardEngineStatus){display:none!important;}
      #geoGebraInlineSlot{width:100%;min-width:0;}
      .dong-ggb-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid #d7e0eb;background:#fff;}
      .dong-ggb-title{font-size:16px;font-weight:750;margin-right:auto;}
      .dong-ggb-head button,.dong-ggb-import{font:inherit;font-size:13px;border:1px solid #c3d0df;border-radius:7px;background:#f8fafc;color:#163b53;padding:7px 10px;cursor:pointer;}
      .dong-ggb-head button:focus-visible,.dong-ggb-import:focus-within{outline:3px solid #25b8ad;outline-offset:2px;}
      .dong-ggb-head .dong-ggb-close{background:#0f9f99;color:#fff;border-color:#0f9f99;}
      .dong-ggb-tools{position:relative;font-size:13px}.dong-ggb-tools summary{cursor:pointer;padding:7px;border:1px solid #c3d0df;border-radius:7px}.dong-ggb-tools>div{position:absolute;top:100%;right:0;z-index:5;background:white;padding:10px;box-shadow:0 6px 20px #163b5333;width:240px;max-height:45dvh;overflow:auto;display:flex;flex-wrap:wrap;gap:6px}
      .dong-ggb-dialog[data-teaching="true"] [data-standalone="true"]{display:none!important}
      @media(min-width:1280px){.workspace[data-teaching="true"]{grid-template-columns:minmax(280px,.9fr) minmax(310px,1fr) minmax(0,3.2fr)}.workspace.input-collapsed[data-teaching="true"]{grid-template-columns:minmax(310px,1fr) minmax(0,2.5fr)}.workspace[data-teaching="true"] .quick-conic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .dong-ggb-note{margin:0;padding:7px 16px;font-size:12px;line-height:1.5;color:#496078;background:#eef7fa;}
      .dong-ggb-note a{color:#176779;}
      .dong-ggb-status{margin:0;padding:6px 16px;min-height:31px;font-size:12px;line-height:1.5;color:#385268;background:#fff;}
      .dong-ggb-host{flex:1;min-height:180px;width:100%;overflow:hidden;background:#fff;}
      .dong-ggb-host>div{height:100%;}
      @media(max-width:700px){.dong-ggb-head{padding:8px;gap:6px}.dong-ggb-title{width:100%;font-size:14px}.dong-ggb-head button,.dong-ggb-import{font-size:12px;padding:6px 8px}.dong-ggb-note{padding:6px 8px}}
    `;
    document.head.append(css);
    dialog = document.createElement('dialog');
    dialog.id = 'dong-geogebra-dialog';
    dialog.className = 'dong-ggb-dialog';
    dialog.setAttribute('aria-label', '董解析 · GeoGebra 动态几何编辑器');
    const header = document.createElement('div');
    header.className = 'dong-ggb-head';
    const title = document.createElement('strong');
    title.className = 'dong-ggb-title';
    title.textContent = '董解析 × GeoGebra · 动态几何编辑器';
    header.append(title);
    const more=document.createElement('details');more.className='dong-ggb-tools';
    const summary=document.createElement('summary');summary.textContent='文件与工具';
    const toolPanel=document.createElement('div');more.append(summary,toolPanel);
    const button = (label, fn, className = '') => {
      const el = document.createElement('button');
      el.type = 'button'; el.textContent = label; el.className = className;
      el.addEventListener('click', wrap(fn)); header.append(el); return el;
    };
    button('导入当前画板', () => replaceWithScene(sceneProvider?sceneProvider():latestScene)).dataset.standalone='true';
    toolPanel.append(button('重试加载', () => start()));
    const blank=button('新建空白图', () => replaceWithScene(null));blank.dataset.standalone='true';toolPanel.append(blank);
    const previous=button('恢复上一图', restorePrevious);previous.dataset.standalone='true';toolPanel.append(previous);
    toolPanel.append(button('保存 .ggb', download));
    toolPanel.append(button('下载上次题图',()=>{
      const record=read(draftKey()+':previous');if(!record?.base64)throw new Error('还没有上一图备份。');
      const bytes=Uint8Array.from(atob(record.base64),c=>c.charCodeAt(0));
      downloadBlob(new Blob([bytes],{type:'application/vnd.geogebra.file'}),'董解析-上一题图.ggb');
    }));
    toolPanel.append(button('保存图片', exportPng));
    button('图形 / 代数',()=>{if(!api)throw new Error('请等待 GeoGebra 加载完成。');narrowLayout=!narrowLayout;api.setPerspective(narrowLayout?'G':'AG');api.showAlgebraInput(!narrowLayout);}).dataset.standalone='true';
    const fileLabel = document.createElement('label');
    fileLabel.className = 'dong-ggb-import'; fileLabel.textContent = '打开 .ggb';fileLabel.dataset.standalone='true';
    const file = document.createElement('input');
    file.type = 'file'; file.accept = '.ggb'; file.hidden = true;
    file.addEventListener('change', wrap(async () => {
      const selected = file.files[0];
      if (!selected) return;
      if (selected.size > 25 * 1024 * 1024) throw new Error('请选择小于 25 MB 的 .ggb 文件。');
      await backupCurrent();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('读取 .ggb 文件失败。'));
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(selected);
      });
      await loadBase64(base64);
      sessionTitle = selected.name.replace(/\.ggb$/i, '');
      await save();
      info('已打开 ' + selected.name + '；此图保存在当前设备。');
      file.value = '';
    }));
    fileLabel.append(file);toolPanel.append(fileLabel);header.append(more);
    button('返回董解析', close, 'dong-ggb-close');
    const note = document.createElement('p');
    note.className = 'dong-ggb-note';
    note.innerHTML = '试验画板：支持 GeoGebra 几何与函数工具，需要联网加载。题目、解析和原画板保持不变；此处图稿独立保存，不自动回写答案。原画板变化后需手动“导入当前画板”；不保证特殊动点范围转换，未支持对象会列出。<br>Made with GeoGebra® © GeoGebra GmbH · <a href="https://www.geogebra.org/" target="_blank" rel="noopener noreferrer">官方网站</a> · <a href="https://www.geogebra.org/license" target="_blank" rel="noopener noreferrer">非商业使用许可</a>';
    status = document.createElement('p'); status.className = 'dong-ggb-status'; status.setAttribute('role', 'status');
    host = document.createElement('div'); host.className = 'dong-ggb-host';
    const target = document.createElement('div'); target.id = 'dong-geogebra-applet'; host.append(target);
    dialog.append(header, note, status, host); document.body.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    new ResizeObserver(() => {
      resizeApplet();
    }).observe(host);
    document.addEventListener('visibilitychange', () => { if (document.hidden && api) save().catch(() => {}); });
  }

  function loadScript() {
    if (window.GGBApplet) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.geogebra.org/apps/deployggb.js'; script.async = true;
      const timer = setTimeout(() => { script.remove(); reject(new Error('GeoGebra 加载超时，请检查网络后重新打开。董解析本地画板仍可使用。')); }, 45000);
      script.onload = () => { clearTimeout(timer); window.GGBApplet ? resolve() : reject(new Error('GeoGebra 加载器未能初始化。')); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('无法连接 GeoGebra 官方服务，请检查网络后重新打开。')); };
      document.head.append(script);
    }).catch(error => { scriptPromise = null; throw error; });
    return scriptPromise;
  }

  async function start() {
    if (api) return api;
    if (loading) return loading;
    info('正在联网加载 GeoGebra 官方编辑器，首次加载可能需要一些时间…');
    loading = (async () => {
      await loadScript();
      return new Promise((resolve, reject) => {
        // Teaching sessions must never restore another question's standalone draft.
        const saved=teachingBinding?null:read(KEY);
        const generation=++startGeneration;
        const timer = setTimeout(() => { startGeneration++;api=null;host.querySelector('#dong-geogebra-applet').replaceChildren();reject(new Error('GeoGebra 加载超时，可重试或返回原画板；原图稿未改动。')); }, 45000);
        const params = {
          id: 'dongGeoGebraApi', appName: 'classic', language: 'zh', country: 'CN',
          width: Math.max(300, host.clientWidth), height: Math.max(180, host.clientHeight),
          showToolBar: !teachingBinding?.automatic, showAlgebraInput: !teachingBinding, showMenuBar: !teachingBinding?.automatic,
          showToolBarHelp: false, showZoomButtons: !teachingBinding?.automatic, showFullscreenButton: true,
          enableUndoRedo: true, enableRightClick: true, enableLabelDrags: true,
          enableShiftDragZoom: true, allowStyleBar: true, enableCAS: true, enable3d: true,
          useBrowserForJS: false, disableJavaScript: true, enableFileFeatures: false, showResetIcon: false,
          capturingThreshold: 6, preventFocus: true, showStartTooltip: false,
          appletOnLoad: async loadedApi => {
            if(generation!==startGeneration)return;
            clearTimeout(timer); api = loadedApi;
            narrowLayout=null;resizeApplet();
            try {
              api.setErrorDialogsActive(false);
              if (saved && saved.base64&&!teachingBinding) {
                sessionTitle = saved.title || sessionTitle;
                info('已恢复上次的 GeoGebra 图稿。点击“导入当前画板”可载入董解析当前题目。');
              } else {
                const initial=copy(latestScene),teachingDraft=teachingBinding?savedScene(JSON.stringify(latestScene)):null;
                busy=true;importReport=populate(initial);
                if(teachingBinding){linkedSignature=JSON.stringify(initial);linkedStructure=structureKey(initial);}
                // Restore auxiliary work only for this exact scene and binding map.
                await restoreMatching(teachingDraft);
                busy=false;
                await save();
                info(importedMessage());
              }
              listen();notifyReady(); resolve(api);
            } catch (error) { busy=false;reject(error); }
          }
        };
        if (saved && saved.base64) params.ggbBase64 = saved.base64;
        else params.perspective = host.clientWidth<600?'G':'AG';
        try { new window.GGBApplet(params, true).inject('dong-geogebra-applet'); }
        catch (error) { clearTimeout(timer); reject(error); }
      });
    })().catch(error => { loading = null;api=null; throw error; });
    return loading;
  }

  function listen() {
    const schedule = () => {
      if (busy) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { save().catch(error => info(error.message)); }, 650);
    };
    api.registerStoreUndoListener(schedule);
    api.registerAddListener(schedule);
    const structuralEdit=label=>{if(teachingBinding&&!busy&&importReport.owned?.includes(Array.isArray(label)?label[0]:label)){linkedStructure='';linkedSignature='';syncTeaching(sceneProvider());}schedule();};
    api.registerRemoveListener(structuralEdit);
    api.registerRenameListener(structuralEdit);
    api.registerClientListener(event => {
      if(teachingBinding&&!busy&&['dragEnd','undo','redo'].includes(event.type)){
        const changes=(importReport.drivers||[]).filter(({label})=>api.exists(label)&&api.isDefined(label)&&api.getVisible(label)).map(({id,label})=>({id,x:api.getXcoord(label),y:api.getYcoord(label)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
        teachingBinding.changed(changes);
        latestScene=copy(sceneProvider());linkedSignature=JSON.stringify(latestScene);linkedStructure=structureKey(latestScene);
      }
      if (['dragEnd', 'undo', 'redo', 'updateStyle', 'viewChanged2D', 'editorStop'].includes(event.type)) schedule();
    });
  }

  function getBase64() {
    if (!api) return Promise.reject(new Error('请等待 GeoGebra 加载完成。'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('保存图稿超时，请使用“保存 .ggb”重试。')), 12000);
      try { api.getBase64(value => { clearTimeout(timer); resolve(value); }); }
      catch (error) { clearTimeout(timer); reject(error); }
    });
  }

  async function save() {
    const key=draftKey();
    // Capture the rendered source BEFORE the asynchronous snapshot. latestScene
    // can already be the next question while this board still shows the old one.
    const sceneSignature=teachingBinding?linkedSignature:null;
    const owned=[...(importReport.owned||[])],title=sessionTitle;
    const base64 = await getBase64();
    const record = { base64, title, savedAt: new Date().toISOString(),sceneSignature,owned };
    try { localStorage.setItem(key, JSON.stringify(record)); }
    catch { throw new Error('浏览器存储空间不足，请点击“保存 .ggb”把图稿保存到文件。'); }
    return record;
  }

  async function backupCurrent() {
    if (!api) throw new Error('请等待 GeoGebra 加载完成。');
    const record = await save();
    try { localStorage.setItem(draftKey()+':previous', JSON.stringify(record));
      if(teachingBinding&&record.sceneSignature){const archive=read(KEY+':teaching:archive')||[];localStorage.setItem(KEY+':teaching:archive',JSON.stringify([record,...archive.filter(item=>item.sceneSignature!==record.sceneSignature)].slice(0,4)));}
    }
    catch { throw new Error('无法备份当前图，请先保存 .ggb 文件并清理浏览器存储空间。'); }
  }

  async function loadBase64(base64) {
    if (!api) throw new Error('请等待 GeoGebra 加载完成。');
    const wasBusy=busy;busy = true;
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('载入图稿超时，请检查 .ggb 文件是否有效。')), 15000);
        try { api.setBase64(base64, () => { clearTimeout(timer); resolve(); }); }
        catch (error) { clearTimeout(timer); reject(error); }
      });
      listen();
    } finally { busy = wasBusy; }
  }

  async function replaceWithScene(scene) {
    await backupCurrent();
    busy = true;
    try { api.newConstruction(); importReport=populate(scene); listen(); await save(); }
    finally { busy = false; }
    info(scene ? importedMessage()+' 原 GeoGebra 图稿可用“恢复上一图”取回。' : '已打开空白画板；原图可用“恢复上一图”取回。');
  }

  async function restorePrevious() {
    const previous = read(BACKUP);
    if (!previous || !previous.base64) throw new Error('还没有上一图备份。');
    await backupCurrent(); await loadBase64(previous.base64);
    sessionTitle = previous.title || '恢复的图稿'; await save();
    info('已恢复上一图；再次点击可切换回刚才的图稿。');
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function download() {
    const base64 = await getBase64();
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    downloadBlob(new Blob([bytes], { type: 'application/vnd.geogebra.file' }), '董解析-GeoGebra图稿.ggb');
    info('已导出 .ggb 图稿，可用 GeoGebra 继续编辑。');
  }

  function exportPng() {
    if (!api) throw new Error('请等待 GeoGebra 加载完成。');
    const bytes = Uint8Array.from(atob(api.getPNGBase64(2, false, 144)), character => character.charCodeAt(0));
    downloadBlob(new Blob([bytes], { type: 'image/png' }), '董解析-GeoGebra画板.png');
  }

  // Commands are generated exclusively from finite numbers and internal labels.
  // User labels are captions, never executable command fragments.
  function populate(raw) {
    if (!api) return;
    highlighted.clear();
    const scene = raw && raw.model ? { ...raw.model, ...raw.p, activePart: raw.activePart } : (raw || {});
    sessionTitle = scene.title || 'GeoGebra 自由作图';
    let serial = 0;
    const labels = new Map(), ids=new Map(), paths=new Map(), anchors = {}, skipped = [], deferred = [],drivers=[],owned=[],visibility=[];
    const active = scene.activePart;
    // Specialised teaching overlays must stay complete until their adapter exists.
    for(const key of ['pairedChord','fixedPoint','loci','locus','locusDefinition','rectangle','rectangularParabola','iteration','hyperbolaIteration','parabolaLocus','parabolaFocalData','inverseLocus','symmetricChord','areaChord','distanceExtrema','dotExtrema','orthogonalChord','problemMotion','circleFold']){
      if(scene[key]&&(!Array.isArray(scene[key])||scene[key].length))skipped.push('教学构造：'+key);
    }
    const visible = item => item.visible !== false && (active == null || (item.part!=null?Number(item.part)===Number(active):!Array.isArray(item.parts)||item.parts.includes(Number(active))));
    function object(expression, caption, color = [124, 90, 201], show = true) {
      let serialLabel;do{serialLabel='DG'+(++serial);}while(api.exists(serialLabel));
      const candidate = String(caption||'').replace(/₁/g,'1').replace(/₂/g,'2').replace(/（.*）/g,'');
      const label = /^[A-Za-z][A-Za-z0-9_]*$/.test(candidate)&&!['x','y','z','e','i'].includes(candidate)&&!api.exists(candidate) ? candidate : serialLabel;
      if (!api.evalCommand(label + (expression.includes('=') ? ':' : '=') + expression)) { skipped.push(caption || expression); return null; }
      if (caption) { api.setCaption(label, String(caption)); api.setLabelStyle(label, 3); api.setLabelVisible(label, true); }
      owned.push(label);api.setColor(label, ...color); api.setVisible(label, show); return label;
    }
    function point(x, y, caption, show = true) {
      const label = object('(' + number(x) + ',' + number(y) + ')', caption, [63, 120, 216], show);
      if (label) { api.setPointSize(label, 5); api.setFixed(label, false, true); }
      return label;
    }
    const h = finite(scene.h), k = finite(scene.k), a = positive(scene.a, 3), b = positive(scene.b, 2);
    const r = positive(scene.r, 3), p = positive(scene.p, 2), direction = finite(scene.direction, 1) < 0 ? -1 : 1;
    const vertical = scene.orientation === 'vertical', showFeatures = scene.showFeatures !== false;
    let conic = null, center = null, axisA=null,axisB=null,parabolaP=null,circleEdge=null,dynamic=null;
    api.setRepaintingActive(false);
    try {
      if (!scene.isFreeBoard&&['ellipse', 'hyperbola', 'circle', 'parabola'].includes(scene.type)) {
        center = point(h, k, scene.type === 'parabola' ? 'V' : 'O', showFeatures);
        anchors.center = center; anchors.vertex = center;
        labels.set('O', scene.type==='parabola'&&(h!==0||k!==0)?point(0,0,'O',showFeatures):center); labels.set('V', center);
        const x = '(x-x(' + center + '))', y = '(y-y(' + center + '))';
        if (scene.type === 'ellipse' || scene.type === 'hyperbola') {
          const ax = object(number(a), 'a', [15, 159, 153], false);
          const by = object(number(b), 'b', [15, 159, 153], false);
          axisA=ax;axisB=by;
          const major = vertical ? y : x, minor = vertical ? x : y;
          conic = object(major + '^2/' + ax + '^2' + (scene.type === 'ellipse' ? '+' : '-') + minor + '^2/' + by + '^2=1', 'C', [15, 159, 153], scene.showConic !== false);
          const f = 'sqrt(' + ax + '^2' + (scene.type === 'ellipse' ? '-' : '+') + by + '^2)';
          const focus = sign => vertical ? '(x(' + center + '),y(' + center + ')' + sign + f + ')' : '(x(' + center + ')' + sign + f + ',y(' + center + '))';
          anchors.focus1 = object(focus('-'), 'F₁', [63, 120, 216], showFeatures);
          anchors.focus2 = object(focus('+'), 'F₂', [63, 120, 216], showFeatures);
          labels.set('F₁', anchors.focus1); labels.set('F1', anchors.focus1);
          labels.set('F₂', anchors.focus2); labels.set('F2', anchors.focus2);
          for(const [suffix,sign] of [['₁','-'],['₂','+']]){
            const expression=vertical?'(x('+center+'),y('+center+')'+sign+ax+')':'(x('+center+')'+sign+ax+',y('+center+'))';
            const vertex=object(expression,'A'+suffix,[63,120,216],showFeatures);
            labels.set('A'+suffix,vertex);labels.set(suffix==='₁'?'A1':'A2',vertex);
          }
        } else if (scene.type === 'circle') {
          const edge = point(h + r, k, 'R（调半径）',!teachingBinding);
          circleEdge=edge;
          conic = object('Circle(' + center + ',' + edge + ')', 'C', [15, 159, 153], scene.showConic !== false);
        } else {
          const parameter = object(number(p), 'p', [15, 159, 153], false);
          parabolaP=parameter;
          conic = object((vertical ? x : y) + '^2=' + (4 * direction) + '*' + parameter + '*' + (vertical ? y : x), 'C', [15, 159, 153], scene.showConic !== false);
          const focus = vertical ? '(x(' + center + '),y(' + center + ')+' + direction + '*' + parameter + ')' : '(x(' + center + ')+' + direction + '*' + parameter + ',y(' + center + '))';
          anchors.focus1 = anchors.focus2 = object(focus, 'F', [63, 120, 216], showFeatures);
          labels.set('F', anchors.focus2);
        }
        if (conic) api.setLineThickness(conic, 5);
      }
      for (const [name, coordinates] of Object.entries(scene.points || {})) {
        if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
        if (scene.pointBindings?.[name] && anchors[scene.pointBindings[name]]) { labels.set(name, anchors[scene.pointBindings[name]]); continue; }
        const previous=labels.get(name);if(previous)api.setVisible(previous,false);
        const item={parts:scene.pointParts?.[name]};
        const label = point(coordinates[0], coordinates[1], name, visible(item));
        visibility.push({label,item});
        labels.set(name, label);
      }
      const objects = Array.isArray(scene.objects) ? scene.objects : [];
      for (const item of objects.filter(value => value.kind === 'point')) {
        const label = point(item.x, item.y, item.label || 'P', visible(item));
        if (item.id) ids.set(item.id, label);
        if (item.label) labels.set(item.label, label);
        if(item.source==='user'&&label)drivers.push({id:item.id,label});
      }
      for (const item of [...(scene.lines || []), ...objects.filter(value => value.kind !== 'point')]) {
        let label = null;
        if(['tangent','normal'].includes(item.role)&&Array.isArray(item.refs)&&item.refs.length===2){
          deferred.push({...item,kind:'construction',op:item.role});
        } else if (item.kind === 'circle') {
          const c = point(item.h, item.k, (item.label || '圆') + '心', visible(item));
          const edge = point(finite(item.h) + positive(item.r, 1), item.k, '半径点', visible(item));
          label = object('Circle(' + c + ',' + edge + ')', item.label || '圆', [193, 91, 135], visible(item));
          if(label)paths.set(label,{x:'x('+c+')+Radius('+label+')*cos(tt)',y:'y('+c+')+Radius('+label+')*sin(tt)'});
        } else if(item.kind==='function'){
          const q=item.params||{},n=key=>'('+number(q[key])+')',shift='(x-'+n('h')+')';
          const expressions={quadratic:()=>n('a')+'*x^2+'+n('b')+'*x+'+n('c'),cubic:()=>n('a')+'*x^3+'+n('b')+'*x^2+'+n('c')+'*x+'+n('d'),absolute:()=>n('a')+'*abs('+shift+')+'+n('k'),reciprocal:()=>n('a')+'/'+shift+'+'+n('k'),exponential:()=>n('a')+'*'+n('b')+'^'+shift+'+'+n('k'),logarithm:()=>n('a')+'*ln('+shift+')/ln('+n('b')+')+'+n('k'),squareRoot:()=>n('a')+'*sqrt('+shift+')+'+n('k')};
          for(const [family,fn]of [['sine','sin'],['cosine','cos'],['tangent','tan']])expressions[family]=()=>n('A')+'*'+fn+'('+n('w')+'*x+'+n('phi')+')+'+n('d');
          if(expressions[item.family]&&Object.values(q).every(value=>Number.isFinite(Number(value))))label=object('y='+expressions[item.family](),item.label||'f',[124,90,201],visible(item));
          else skipped.push(item.label||'不支持的函数');
        } else if(item.kind==='conic'){
          // Additional curves are first-class dependency targets, not just a
          // picture of the primary conic. Never execute a user equation string.
          const type=item.conicType,v=item.orientation==='vertical';
          const cx=finite(item.h),cy=finite(item.k),aa=Number(item.a),bb=Number(item.b),pp=Number(item.p);
          const x='(x-('+number(cx)+'))',y='(y-('+number(cy)+'))';
          let expression,path;
          if(['ellipse','hyperbola'].includes(type)&&Number.isFinite(aa)&&Number.isFinite(bb)&&aa>0&&bb>0&&(type!=='ellipse'||aa>=bb)){
            expression=(v?y:x)+'^2/('+number(aa)+'^2)'+(type==='ellipse'?'+':'-')+(v?x:y)+'^2/('+number(bb)+'^2)=1';
            const major=type==='ellipse'?number(aa)+'*cos(tt)':'BR*'+number(aa)+'*cosh(tt)';
            const minor=number(bb)+(type==='ellipse'?'*sin(tt)':'*sinh(tt)');
            path={x:number(cx)+'+'+(v?minor:major),y:number(cy)+'+'+(v?major:minor),requiresRange:type==='hyperbola'};
          }else if(type==='parabola'&&Number.isFinite(pp)&&pp>0){
            const d=item.direction===-1?-1:1;
            expression=(v?x:y)+'^2='+number(4*d*pp)+'*'+(v?y:x);
            const longitudinal=number(d)+'*tt^2/('+number(4*pp)+')';
            path={x:number(cx)+'+'+(v?'tt':longitudinal),y:number(cy)+'+'+(v?longitudinal:'tt')};
          }
          if(expression){label=object(expression,item.label||'曲线',[15,159,153],visible(item));if(label)paths.set(label,path);}
          else skipped.push(item.label||'参数无效的曲线');
        } else if(item.kind==='construction'){
          deferred.push(item);
        } else if (item.kind === 'through_points') {
          const first = labels.get(item.a), second = labels.get(item.b);
          if (first && second) label = object((item.infinite ? 'Line' : 'Segment') + '(' + first + ',' + second + ')', item.label || item.a + item.b, [124, 90, 201], visible(item));
          else deferred.push(item);
        } else if (['line', 'slope', 'vertical'].includes(item.kind)) {
          let coords;
          if (item.x != null && Number.isFinite(Number(item.x))) coords = [finite(item.x), k - 2, finite(item.x), k + 2];
          else if (item.m != null && Number.isFinite(Number(item.m))) coords = [h - 2, finite(item.m) * (h - 2) + finite(item.b), h + 2, finite(item.m) * (h + 2) + finite(item.b)];
          if (coords) {
            const first = point(coords[0], coords[1], (item.label || '线') + '₁', visible(item));
            const second = point(coords[2], coords[3], (item.label || '线') + '₂', visible(item));
            label = object('Line(' + first + ',' + second + ')', item.label || '直线', [124, 90, 201], visible(item));
          } else skipped.push(item.label || '不支持的直线');
        } else skipped.push(item.label || item.kind || '对象');
        if (label && item.id) ids.set(item.id, label);
        if (label && item.label) labels.set(item.label,label);
      }
      if (center && conic && scene.showDynamic !== false && scene.dynamicLine !== false) {
        const dynamicItem={part:scene.dynamicLinePart,parts:scene.dynamicLineParts};
        const mode = scene.lineThrough || 'center';
        const pivot = mode.startsWith('point:') ? (labels.get(mode.slice(6)) || center) : (anchors[mode] || center);
        const radius = Math.max(a, b, r, p, 2) * 0.85;
        const ring = object('Circle(' + pivot + ',' + number(radius) + ')', '', [220, 225, 235], false);
        const handle = object('Point(' + ring + ')', 'T（拖动旋转）', [242, 163, 60],visible(dynamicItem));
        visibility.push({label:handle,item:dynamicItem});
        dynamic={pivot,handle,radius};
        if(handle)drivers.push({id:'$dynamic-angle',label:handle});
        const angle = finite(scene.theta, 42) * Math.PI / 180;
        if (handle) api.setCoords(handle, api.getXcoord(pivot) + radius * Math.cos(angle), api.getYcoord(pivot) + radius * Math.sin(angle));
        const line = object('Line(' + pivot + ',' + handle + ')', scene.dynamicLineLabel || 'l', [242, 163, 60],visible(dynamicItem));
        visibility.push({label:line,item:dynamicItem});
        if(line)ids.set('$dynamic',line);
        if (line) {
          const pair=scene.dynamicIntersectionLabels||['A','B'];
          const intersectionItem={...dynamicItem,visible:scene.showConic!==false};
          const first = object('Intersect(' + line + ',' + conic + ',1)', pair[0], [223, 91, 98], visible(intersectionItem));
          const second = object('Intersect(' + line + ',' + conic + ',2)', pair[1], [223, 91, 98], visible(intersectionItem));
          visibility.push({label:first,item:intersectionItem},{label:second,item:intersectionItem});
          ids.set('dynamic:0',first);ids.set('dynamic:1',second);
          if(!labels.has(pair[0])) labels.set(pair[0],first);
          if(!labels.has(pair[1])) labels.set(pair[1],second);
        }
      }
      if(conic){
        ids.set('$conic',conic);
        const cx='x('+center+')',cy='y('+center+')';
        if(scene.type==='ellipse')paths.set(conic,{x:cx+'+'+(vertical?axisB:axisA)+'*cos(tt)',y:cy+'+'+(vertical?axisA:axisB)+'*sin(tt)'});
        if(scene.type==='circle')paths.set(conic,{x:cx+'+Radius('+conic+')*cos(tt)',y:cy+'+Radius('+conic+')*sin(tt)'});
        if(scene.type==='parabola')paths.set(conic,{x:cx+'+'+(vertical?'tt':'tt^2/('+number(4*direction)+'*'+parabolaP+')'),y:cy+'+'+(vertical?'tt^2/('+number(4*direction)+'*'+parabolaP+')':'tt')});
        if(scene.type==='hyperbola')paths.set(conic,{requiresRange:true,x:cx+'+'+(vertical?axisB+'*sinh(tt)':'BR*'+axisA+'*cosh(tt)'),y:cy+'+'+(vertical?'BR*'+axisA+'*cosh(tt)':axisB+'*sinh(tt)')});
      }
      const ref=id=>String(id).startsWith('feature:')?labels.get(String(id).slice(8)):ids.get(id);
      let pending=deferred.slice();
      for(let pass=0;pending.length&&pass<=deferred.length;pass++){
        const next=[];let made=0;
        for(const item of pending){
          const refs=item.kind==='through_points'?[labels.get(item.a),labels.get(item.b)]:(item.refs||[]).map(ref);
          if(!refs.length||refs.some(v=>!v)){next.push(item);continue;}
          const names={line:'Line',segment:'Segment',ray:'Ray',midpoint:'Midpoint',circle:'Circle',circumcircle:'Circle',perp_bisector:'PerpendicularBisector',parallel:'Line',perpendicular:'PerpendicularLine',tangent:'Tangent',distance:'Distance'};
          let expression=null,seed=null;
          if(item.kind==='through_points')expression=(item.infinite?'Line':'Segment')+'('+refs.join(',')+')';
          else if(names[item.op])expression=names[item.op]+'('+refs.join(',')+')';
          else if(item.op==='intersection')expression='Intersect('+refs.join(',')+','+((item.branch||0)+1)+')';
          else if(item.op==='normal')expression='PerpendicularLine('+refs[0]+',Tangent('+refs.join(',')+'))';
          else if(item.op==='reflect_axis')expression='Reflect('+refs[0]+','+(item.axis==='y'?'x':'y')+'='+number(item.axisValue||0)+')';
          else if(item.op==='point_on'){
            const spec=window.DongMotionDomain?.driver(item,active)||item;
            let domain;try{domain=window.DongMotionDomain?.validate(spec.motionDomain)||spec.motionDomain||{};}catch{skipped.push(item.label||item.op);continue;}
            const range=domain.parameter,path=paths.get(refs[0]);
            // Never silently relax an unsupported condition or an open endpoint.
            const supported=spec.mode!=='plane'&&Number.isFinite(spec.t)&&path&&(!path.requiresRange||range)&&Object.keys(domain).every(k=>k==='parameter'||k==='branch')&&(!range||(Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.min<range.max&&range.minClosed!==false&&range.maxClosed!==false&&spec.t>=range.min&&spec.t<=range.max));
            if(supported){
              const branch=domain.branch??spec.branch??1;
              if(branch!==1&&branch!==-1||domain.branch!=null&&spec.branch!=null&&domain.branch!==spec.branch){skipped.push(item.label||item.op);continue;}
              const x=path.x.replace(/BR/g,String(branch)),y=path.y.replace(/BR/g,String(branch));
              let target=refs[0];
              if(range)target=object('Curve('+x+','+y+',tt,'+number(range.min)+','+number(range.max)+')','',[124,90,201],false);
              if(target){expression='Point('+target+')';seed='('+x.replace(/\btt\b/g,'('+number(spec.t)+')')+','+y.replace(/\btt\b/g,'('+number(spec.t)+')')+')';}
            }
          }
          if(!expression){skipped.push(item.label||item.op);continue;}
          const label=object(expression,item.label,[124,90,201],visible(item));
          if(label){
            if(seed){const initial=object(seed,'',[124,90,201],false);if(initial){api.setCoords(label,api.getXcoord(initial),api.getYcoord(initial));api.deleteObject(initial);}api.setPointSize(label,5);}
            if(item.op==='point_on')drivers.push({id:item.id,label});
            if(['circle','circumcircle'].includes(item.op))paths.set(label,{x:'x(Center('+label+'))+Radius('+label+')*cos(tt)',y:'y(Center('+label+'))+Radius('+label+')*sin(tt)'});
            ids.set(item.id,label);if(item.label)labels.set(item.label,label);made++;
          }
        }
        pending=next;if(!made)break;
      }
      skipped.push(...pending.map(item=>item.label||item.id||'缺少引用的构造'));
      for(const [index,polygon] of (scene.polygons||[]).entries()){const refs=(polygon.labels||[]).map(name=>labels.get(name));if(refs.length>=3&&refs.every(Boolean)){const label=object('Polygon('+refs.join(',')+')',polygon.label,[229,140,33],visible(polygon));if(label){visibility.push({label,item:polygon});ids.set('polygon:'+index,label);}}else skipped.push(polygon.label||'多边形');}
      for(const item of [...(scene.lines||[]),...objects]){const label=ids.get(item.id);if(label)visibility.push({label,item});}
      if(teachingBinding){for(const label of owned)if(api.exists(label))api.setFixed(label,true,true);for(const {label}of drivers)api.setFixed(label,false,true);}
      const size = Math.max(a, b, r, p * 2, 3) * 1.65;
      const rawView=api.getViewProperties(1),view=typeof rawView==='string'?JSON.parse(rawView):rawView;
      const ratio=(view.width||800)/(view.height||600),halfWidth=Math.max(size,size*ratio),halfHeight=halfWidth/ratio;
      api.setCoordSystem(h-halfWidth,h+halfWidth,k-halfHeight,k+halfHeight);
      api.setAxesVisible(true, true); api.setGridVisible(true); api.setMode(0); api.setUndoPoint();
      if (skipped.length) info('已转换支持的图形；未转换对象：' + skipped.join('、') + '。可用 GeoGebra 工具栏补建。');
    } finally { api.setRepaintingActive(true); }
    return { skipped,drivers,owned:owned.filter(label=>api.exists(label)),ids,labels,update(next){
      const show=item=>item.visible!==false&&(next.activePart==null||(item.part!=null?Number(item.part)===Number(next.activePart):!Array.isArray(item.parts)||item.parts.includes(Number(next.activePart))));
      api.setRepaintingActive(false);
      try{
        if(center)api.setCoords(center,finite(next.h),finite(next.k));
        if(axisA)api.setValue(axisA,positive(next.a,3));if(axisB)api.setValue(axisB,positive(next.b,2));if(parabolaP)api.setValue(parabolaP,positive(next.p,2));
        if(circleEdge)api.setCoords(circleEdge,finite(next.h)+positive(next.r,3),finite(next.k));
        if(dynamic){const angle=finite(next.theta,42)*Math.PI/180;api.setCoords(dynamic.handle,api.getXcoord(dynamic.pivot)+dynamic.radius*Math.cos(angle),api.getYcoord(dynamic.pivot)+dynamic.radius*Math.sin(angle));}
        for(const {label,item}of visibility)if(label)api.setVisible(label,show(item));
      }finally{api.setRepaintingActive(true);}
    }};
  }

  function sync(scene) { latestScene = copy(scene); }
  async function open(scene,slot=null,provider=null,binding=null) {
    teachingBinding=binding;
    sceneProvider=provider;
    if (scene !== undefined) sync(scene);
    buildShell(); previousFocus = document.activeElement;
    dialog.dataset.teaching=String(!!binding);
    document.querySelector('.workspace')?.setAttribute('data-teaching',String(!!binding));
    if(binding){dialog.querySelector('.dong-ggb-title').textContent='董解析 · 教学画板（集成预览）';dialog.querySelector('.dong-ggb-note').innerHTML='<details><summary>使用说明与能力边界</summary><p>当前题目自动同步，参数统一在董解析调整。题设构造锁定，支持的动点可拖动并回写原画板。更换构造会备份上一图；新增高级作图暂未回写题目模型，请及时保存 .ggb。</p></details>Made with GeoGebra® © GeoGebra GmbH · <a href="https://www.geogebra.org/license" target="_blank" rel="noopener noreferrer">非商业使用许可</a>';}
    if(dialog.open)dialog.close();
    if(inlineSlot)inlineSlot.closest('.board-shell').removeAttribute('data-ggb-active');
    inlineSlot=slot;dialog.classList.toggle('dong-ggb-inline',!!slot);
    if(slot){slot.hidden=false;slot.append(dialog);slot.closest('.board-shell').dataset.ggbActive='true';dialog.show();}
    else{document.body.append(dialog);dialog.showModal();}
    try { await start();if(binding)syncTeaching(provider?provider():scene); }
    catch (error) { info(error.message || 'GeoGebra 加载失败，请返回画板稍后重试。');binding?.failed?.(error); }
  }
  function close() {
    clearTimeout(linkedTimer);linkedTimer=null;document.querySelector('.workspace')?.removeAttribute('data-teaching');
    if (api) save().catch(error => info(error.message));
    if (dialog && dialog.open) dialog.close();
    if(inlineSlot){inlineSlot.hidden=true;inlineSlot.closest('.board-shell').removeAttribute('data-ggb-active');inlineSlot=null;window.dispatchEvent(new Event('resize'));}
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }
  function syncTeaching(scene){
    if(!teachingBinding||!dialog?.open)return;
    latestScene=copy(scene);if(linkedTimer)return;
    linkedTimer=setTimeout(()=>{linkedTimer=null;flushTeaching();},120);
  }
  async function flushTeaching(){
    if(linkedRunning||!api||!teachingBinding||!dialog?.open)return;
    const scene=copy(latestScene),signature=JSON.stringify(scene),structure=structureKey(scene);
    if(signature===linkedSignature)return;
    linkedRunning=true;busy=true;
    try{
      if(structure===linkedStructure&&importReport.update)importReport.update(scene);
      else {const saved=savedScene(signature),extras=additiveExtras(scene);await backupCurrent();if(!dialog?.open)return;api.newConstruction();importReport=populate(scene);linkedSignature=signature;linkedStructure=structure;if(!await restoreMatching(saved))restoreExtras(extras);}
      linkedSignature=signature;linkedStructure=structure;
      notifyReady();
      info(importReport.skipped.length?importedMessage():'题目与画板已同步；参数请在董解析参数区调整。');
      await save();
    }catch(error){info('画板同步未完成：'+error.message+'。请返回原画板核对。');teachingBinding?.failed?.(error);}
    finally{busy=false;linkedRunning=false;if(JSON.stringify(latestScene)!==signature)syncTeaching(latestScene);}
  }
  function highlight(ids=[]){
    if(!api)return;
    for(const [label,style]of highlighted)if(api.exists(label)){api.setLineThickness(label,style.line);if(style.point!=null)api.setPointSize(label,style.point);}
    highlighted.clear();
    for(const id of ids){const label=importReport.ids?.get(id)||importReport.labels?.get(id.replace(/^(point|feature):/,''));if(label&&api.exists(label)&&api.getVisible(label)&&!highlighted.has(label)){
      const line=api.getLineThickness?.(label),point=api.getObjectType?.(label)==='point'?api.getPointSize?.(label):null;
      highlighted.set(label,{line:Number.isFinite(line)?line:5,point:Number.isFinite(point)?point:null});api.setLineThickness(label,9);if(Number.isFinite(point))api.setPointSize(label,Math.max(point,8));
    }}
  }
  window.DongGeoGebra = Object.freeze({ open, close, sync, syncTeaching, download, save, highlight, restoreMatching, getAPI: () => api, getSaved:savedScene, getReport:()=>({skipped:[...importReport.skipped],owned:[...(importReport.owned||[])],signature:linkedSignature}) });
})();
