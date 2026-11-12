(function(){
  'use strict';

  const fullCrop={left:0,top:0,right:1000,bottom:1000};
  const original={turns:0,tilt:0,crop:fullCrop};
  const same=(a,b)=>a.turns===b.turns&&a.tilt===b.tilt&&
    Object.keys(fullCrop).every(edge=>a.crop[edge]===b.crop[edge]);

  function layout(bitmap,edit){
    const radians=(edit.turns*90+edit.tilt)*Math.PI/180;
    const cos=Math.abs(Math.cos(radians)),sin=Math.abs(Math.sin(radians));
    const width=Math.round(bitmap.width*cos+bitmap.height*sin);
    const height=Math.round(bitmap.width*sin+bitmap.height*cos);
    const {left,top,right,bottom}=edit.crop;
    const x=Math.floor(left*width/1000),y=Math.floor(top*height/1000);
    return {width,height,radians,x,y,
      cropWidth:Math.ceil(right*width/1000)-x,cropHeight:Math.ceil(bottom*height/1000)-y};
  }

  function paint(canvas,bitmap,view,limit,cropped=false){
    const width=cropped?view.cropWidth:view.width,height=cropped?view.cropHeight:view.height;
    const scale=Math.min(1,limit/Math.max(width,height));
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.scale(canvas.width/width,canvas.height/height);
    ctx.translate(view.width/2-(cropped?view.x:0),view.height/2-(cropped?view.y:0));
    ctx.rotate(view.radians);
    ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);
  }

  function rotate(edit,step){
    const {left,top,right,bottom}=edit.crop;
    const crop=step>0?
      {left:1000-bottom,top:left,right:1000-top,bottom:right}:
      {left:top,top:1000-right,right:bottom,bottom:1000-left};
    return {...edit,turns:(edit.turns+step+4)%4,crop};
  }

  async function saveImage(file,bitmap,edit){
    const canvas=document.createElement('canvas');
    paint(canvas,bitmap,layout(bitmap,edit),3000,true);
    const encode=(type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
    try{
      let blob=await encode('image/png');
      if(blob?.size>8*1024*1024)blob=await encode('image/jpeg',.94);
      if(!blob)throw new Error('无法保存调整后的题图，请重试。');
      return new File([blob],file.name,{type:blob.type,lastModified:file.lastModified});
    }finally{canvas.width=canvas.height=1;}
  }

  function mount(dialog,apply){
    const find=selector=>dialog.querySelector(selector);
    const canvas=find('#imageAdjustCanvas'),stage=find('#imageAdjustStage'),box=find('#imageAdjustBox');
    const controls=find('#imageAdjustControls'),message=find('#imageAdjustMessage'),save=find('#applyImageAdjust');
    const tilt=find('#imageAdjustTilt'),edges=[...dialog.querySelectorAll('[data-crop-edge]')];
    let session=null;

    function renderCrop(){
      const {edit,bitmap,initial}=session;
      const {left,top,right,bottom}=edit.crop,view=layout(bitmap,edit);
      Object.assign(box.style,{left:left/10+'%',top:top/10+'%',width:(right-left)/10+'%',height:(bottom-top)/10+'%'});
      for(const input of edges)input.value=edit.crop[input.dataset.cropEdge];
      find('#imageAdjustSize').textContent=`选区 ${view.cropWidth} × ${view.cropHeight} 像素`;
      find('#resetImageAdjust').disabled=same(edit,original);
      save.disabled=session.saving||same(edit,initial);
    }

    function render(){
      const {edit,bitmap}=session,view=layout(bitmap,edit);
      paint(canvas,bitmap,view,960);
      stage.style.width=`min(100%, ${canvas.width}px, ${42*canvas.width/canvas.height}dvh)`;
      tilt.value=edit.tilt;
      find('#imageAdjustAngle').textContent=edit.tilt+'°';
      renderCrop();
    }

    const editable=()=>dialog.open&&session?.bitmap&&!session.saving;
    const release=()=>{
      session?.bitmap?.close();
      session=null;
      canvas.width=canvas.height=1;
    };
    dialog.addEventListener('close',()=>{if(!dialog.open)release();});
    dialog.addEventListener('cancel',event=>{if(session?.saving)event.preventDefault();});

    async function open(page,index){
      if(dialog.open)return;
      release();
      const initial=page.adjustment||original;
      const active={page,initial,edit:initial,bitmap:null,drag:null,saving:false};
      session=active;
      find('#imageAdjustTitle').textContent='调整第 '+(index+1)+' 页题图';
      find('[data-close-dialog]').disabled=false;
      message.textContent='正在打开题图…';
      controls.hidden=true;save.disabled=true;
      dialog.showModal();
      try{
        const bitmap=await createImageBitmap(page.file);
        if(!dialog.open||session!==active){bitmap.close();return;}
        active.bitmap=bitmap;
        controls.hidden=false;
        message.textContent='';
        render();
      }catch{
        if(session===active&&dialog.open)message.textContent='无法打开这张图片。请改用 JPG 或 PNG，再重新添加。';
      }
    }

    for(const button of dialog.querySelectorAll('[data-image-turn]'))button.addEventListener('click',()=>{
      if(editable()){session.edit=rotate(session.edit,Number(button.dataset.imageTurn));render();}
    });
    tilt.addEventListener('input',()=>{
      if(editable()){session.edit={...session.edit,tilt:Number(tilt.value)};render();}
    });
    find('#resetImageCrop').addEventListener('click',()=>{
      if(editable()){session.edit={...session.edit,crop:fullCrop};renderCrop();}
    });
    find('#resetImageAdjust').addEventListener('click',()=>{
      if(editable()){session.edit=original;render();}
    });
    for(const input of edges)input.addEventListener('input',()=>{
      if(!editable())return;
      const edge=input.dataset.cropEdge,crop={...session.edit.crop},value=Number(input.value);
      switch(edge){
        case 'left':crop.left=Math.min(value,crop.right-10);break;
        case 'top':crop.top=Math.min(value,crop.bottom-10);break;
        case 'right':crop.right=Math.max(value,crop.left+10);break;
        case 'bottom':crop.bottom=Math.max(value,crop.top+10);break;
      }
      session.edit={...session.edit,crop};
      renderCrop();
    });

    function pointer(event){
      const rect=stage.getBoundingClientRect();
      const limit=value=>Math.max(0,Math.min(1000,Math.round(value*1000)));
      return {x:limit((event.clientX-rect.left)/rect.width),y:limit((event.clientY-rect.top)/rect.height)};
    }
    stage.addEventListener('pointerdown',event=>{
      if(!editable()||session.drag||event.button!==0)return;
      session.drag={...pointer(event),crop:session.edit.crop,id:event.pointerId};
      stage.setPointerCapture(event.pointerId);
    });
    stage.addEventListener('pointermove',event=>{
      if(!editable()||session.drag?.id!==event.pointerId)return;
      const start=session.drag,end=pointer(event);
      const crop={left:Math.min(start.x,end.x),top:Math.min(start.y,end.y),
        right:Math.max(start.x,end.x),bottom:Math.max(start.y,end.y)};
      if(crop.right-crop.left>=10&&crop.bottom-crop.top>=10){
        session.edit={...session.edit,crop};
        renderCrop();
      }
    });
    stage.addEventListener('lostpointercapture',()=>{if(session)session.drag=null;});
    stage.addEventListener('pointercancel',event=>{
      if(session?.drag?.id!==event.pointerId)return;
      session.edit={...session.edit,crop:session.drag.crop};
      renderCrop();
    });

    save.addEventListener('click',async()=>{
      if(!editable()||save.disabled)return;
      const active=session,cancel=find('[data-close-dialog]');
      active.saving=true;controls.inert=true;save.disabled=cancel.disabled=true;
      message.textContent='正在保存题图…';
      try{
        const changed=!same(active.edit,original);
        const file=changed?await saveImage(active.page.file,active.bitmap,active.edit):null;
        if(session!==active||!dialog.open)return;
        apply(active.page,changed?active.edit:null,file);
        dialog.close();
      }catch(error){message.textContent=error.message;}
      finally{
        active.saving=false;
        controls.inert=false;cancel.disabled=false;
        if(session===active&&dialog.open)renderCrop();
      }
    });

    return {open};
  }

  window.DongImageAdjust={mount};
})();
