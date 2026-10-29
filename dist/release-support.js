/* User-reviewed, local-only feedback. Never collect storage, credentials or images. */
(() => {
  'use strict';
  const host=document.querySelector('.footer');if(!host)return;
  const button=document.createElement('button');button.type='button';button.id='openReleaseSupport';button.textContent='帮助与问题反馈';button.style.cssText='font:inherit;padding:2px 8px;margin-left:8px';host.append(button);
  const dialog=document.createElement('dialog');dialog.className='study-dialog';dialog.setAttribute('aria-label','帮助与问题反馈');
  dialog.innerHTML='<header><h2>帮助与问题反馈</h2><button type="button" data-close>关闭</button></header><p>AI 生成答案不等于已经证明。请结合“解析与检验”中的核验状态判断；未解小问、数值验证不能当作完整证明。</p><p>分享教学内容：打开“我的题本”，导出题稿。题稿可能包含题目、解析、图形和追问，发送前请检查个人信息。</p><p>云端解题和图片识别需要发送相应题目或图片到配置的服务。不要上传姓名、学号或其他不必要的个人信息。以下反馈功能只在浏览器中生成文件，不会自动发送。</p><label>问题类型<select data-kind><option>答案有误</option><option>图形缺失或错误</option><option>操作异常</option><option>其他建议</option></select></label><label>描述<textarea data-description maxlength="4000" placeholder="描述操作步骤、预期结果与实际情况；请勿填写密码或 API 密钥。"></textarea></label><label><input type="checkbox" data-question>附上当前题目文字</label><label><input type="checkbox" data-scene>附上当前图形模型（可能含自定义文字）</label><p>不会收集访问口令、API 密钥、浏览器存储或原始图片。你主动填写或勾选的内容仍可能含个人信息，请检查预览。</p><button type="button" data-preview>生成预览</button><pre data-output style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto"></pre><button type="button" data-download disabled>下载已预览的反馈文件</button><p data-status role="status"></p>';
  document.body.append(dialog);let reviewed=null,generation=0;
  dialog.id='releaseSupport';
  const help=document.createElement('details');
  help.innerHTML='<summary>使用、保存与隐私说明</summary><p>老师可在解析中选择“进入讲题模式”，使用逐问切换、逐步展示、隐藏结论和投影字号。学生可选择“先思考 · 逐步提示”。</p><p>在“我的题本”导出题稿，可发给朋友导入并继续操作。完整题稿可能包含追问和学习笔记，请检查后分享。题本和草稿保存在当前浏览器，清理浏览器数据、隐私模式或更换设备可能导致无法找回；换设备前请导出。</p><p>云端解题会发送题目及必要上下文；云端识图会发送选中图片。平台和模型供应商另有数据处理规则，本站不承诺第三方零留存。</p><p><a href="about.html" target="_blank" rel="noopener noreferrer">隐私、组件授权与题库来源说明</a></p><button type="button" data-notebook>打开我的题本</button>';
  dialog.querySelector('header').after(help);
  const delivery=document.createElement('p');delivery.innerHTML='可在 <a href="https://github.com/dongjiexi/-/issues/new" target="_blank" rel="noopener noreferrer">项目问题反馈页</a>提交。该页面公开，请先删除个人信息；本窗口不会自动提交。';dialog.append(delivery);
  const get=s=>dialog.querySelector(s),status=get('[data-status]');
  const invalidate=()=>{generation++;reviewed=null;get('[data-download]').disabled=true;get('[data-output]').textContent='';};
  dialog.addEventListener('input',invalidate);dialog.addEventListener('change',invalidate);
  dialog.addEventListener('close',invalidate);
  button.addEventListener('click',()=>{invalidate();status.textContent='';dialog.showModal();});
  get('[data-close]').addEventListener('click',()=>dialog.close());
  get('[data-notebook]').addEventListener('click',()=>{dialog.close();document.getElementById('openNotebook')?.click();});
  get('[data-preview]').addEventListener('click',async()=>{
    invalidate();const token=generation;status.textContent='正在生成本地预览…';
    // Snapshot user choices before awaiting the version file.
    const result={format:'dongjiexi-feedback',schema:1,kind:get('[data-kind]').value,description:get('[data-description]').value};
    try{
      if(get('[data-question]').checked)result.question=document.querySelector('#question')?.value||'';
      if(get('[data-scene]').checked){const raw=document.querySelector('#sceneJson')?.value||'';if(raw.length>200000)throw Error('图形模型过大，请取消附加图形，改为单独导出题稿。');result.scene=JSON.parse(raw||'null');}
      // Version lookup is local to the deployed site, not a feedback submission.
      try{const response=await fetch('app-version.json');result.version=(await response.json()).version;}catch{result.version='无法读取';}
      if(token!==generation||!dialog.open)return;
      reviewed=JSON.stringify(result,null,2);get('[data-output]').textContent=reviewed;get('[data-download]').disabled=false;status.textContent='请检查预览。下载后由你决定是否发送给维护者。';
    }catch(error){if(token===generation)status.textContent=error.message;}
  });
  get('[data-download]').addEventListener('click',()=>{if(!reviewed)return;const url=URL.createObjectURL(new Blob([reviewed],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='董解析-问题反馈.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
})();
