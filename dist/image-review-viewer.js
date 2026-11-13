(function(root){
  'use strict';
  function mount(container){
    const find=selector=>container.querySelector(selector);
    const viewport=find('#recognitionImageViewport'),image=find('#recognitionOriginal');
    const percent=find('#recognitionImageScale'),expand=find('#expandRecognitionImage');
    const controls=[...container.querySelectorAll('[data-review-view]')],views=new Map();
    const defaults=()=>({mode:'fit',scale:1,x:.5,y:.5});
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    let source='',view=defaults(),scale=0,drag=null,loaded=false;

    function center(){
      const frame=viewport.getBoundingClientRect(),rect=image.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      view.x=clamp((frame.left+viewport.clientLeft+viewport.clientWidth/2-rect.left)/rect.width,0,1);
      view.y=clamp((frame.top+viewport.clientTop+viewport.clientHeight/2-rect.top)/rect.height,0,1);
    }
    function render(){
      if(!loaded||!viewport.clientWidth||!viewport.clientHeight)return;
      const width=image.naturalWidth,height=image.naturalHeight;
      const fit=Math.min(1,viewport.clientWidth/width,viewport.clientHeight/height);
      scale=view.mode==='fit'?fit:view.mode==='width'?Math.min(4,viewport.clientWidth/width):clamp(view.scale,fit,4);
      image.style.width=Math.max(1,Math.floor(width*scale))+'px';
      image.style.height=Math.max(1,Math.floor(height*scale))+'px';
      viewport.scrollLeft=image.offsetLeft+image.offsetWidth*view.x-viewport.clientWidth/2;
      viewport.scrollTop=image.offsetTop+image.offsetHeight*view.y-viewport.clientHeight/2;
      percent.value=Math.max(1,Math.round(scale*100))+'%';
      for(const button of controls){
        const action=button.dataset.reviewView;
        button.disabled=action==='out'?scale<=fit:action==='in'?scale>=4:false;
        if(action==='fit'||action==='width')button.setAttribute('aria-pressed',String(view.mode===action));
      }
    }
    function loadedImage(){
      if(!image.complete||!image.naturalWidth)return;
      loaded=true;
      render();
    }
    function show(url,label){
      image.alt=label;
      if(source===url)return;
      if(loaded){center();views.set(source,view);}
      loaded=false;source=url;view=views.get(url)||defaults();
      controls.forEach(button=>button.disabled=true);
      percent.value='—';
      image.style.removeProperty('width');image.style.removeProperty('height');
      image.src=url;
      loadedImage();
    }
    function setExpanded(value){
      container.classList.toggle('review-image-expanded',value);
      expand.setAttribute('aria-expanded',String(value));
      expand.textContent=value?'缩小查看区':'扩大查看区';
      render();
    }
    function reset(){
      loaded=false;source='';scale=0;drag=null;
      views.clear();
      image.removeAttribute('src');
      setExpanded(false);
    }
    function change(action){
      if(!loaded)return;
      center();
      if(action==='in'||action==='out'){
        view.mode='custom';
        view.scale=scale*(action==='in'?1.4:1/1.4);
      }else if(action==='actual'){
        view.mode='custom';
        view.scale=1;
      }else{
        view.mode=action;
        view.x=.5;
        view.y=action==='width'?0:.5;
      }
      render();
    }
    controls.forEach(button=>button.addEventListener('click',()=>change(button.dataset.reviewView)));
    expand.addEventListener('click',()=>{
      if(loaded)center();
      setExpanded(expand.getAttribute('aria-expanded')!=='true');
    });
    image.addEventListener('load',loadedImage);
    const resize=new ResizeObserver(render);
    resize.observe(viewport);
    viewport.addEventListener('scroll',()=>{if(loaded)center();});
    viewport.addEventListener('keydown',event=>{
      if(event.ctrlKey||event.altKey||event.metaKey)return;
      const action={'+':'in','=':'in','-':'out','0':'fit','1':'actual'}[event.key];
      if(!action)return;
      event.preventDefault();
      change(action);
    });
    viewport.addEventListener('pointerdown',event=>{
      if(!loaded||event.pointerType!=='mouse'||event.button!==0||event.target!==image)return;
      if(viewport.scrollWidth<=viewport.clientWidth&&viewport.scrollHeight<=viewport.clientHeight)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
      viewport.focus({preventScroll:true});
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-panning');
      event.preventDefault();
    });
    viewport.addEventListener('pointermove',event=>{
      if(drag?.id!==event.pointerId)return;
      viewport.scrollLeft=drag.left+drag.x-event.clientX;
      viewport.scrollTop=drag.top+drag.y-event.clientY;
    });
    viewport.addEventListener('lostpointercapture',()=>{
      drag=null;
      viewport.classList.remove('is-panning');
    });
    return {show,reset};
  }
  root.DongImageReviewViewer={mount};
})(window);
