(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), world = $('world'), nodesEl = $('nodes'), edgesEl = $('edges');
  const palette = [
    {name:'Salvia',bg:'#e0e9d5',border:'#91a87a',ink:'#425d35'},
    {name:'Arena',bg:'#f2e8d4',border:'#ccba91',ink:'#826c45'},
    {name:'Lavanda',bg:'#e9e5f2',border:'#b3a5cc',ink:'#78658f'},
    {name:'Azul',bg:'#dfeaf0',border:'#92b4c7',ink:'#476f85'},
    {name:'Coral',bg:'#f3dfd9',border:'#ceaaa0',ink:'#945d4e'}
  ];
  const storageKey = 'nodo-board-v1';
  let nodes = [{id:'1',label:'Idea central',x:0,y:0,color:0},{id:'2',label:'Explorar',x:270,y:-94,color:1},{id:'3',label:'Construir',x:270,y:116,color:2}];
  let edges = [{id:'e1',from:'1',to:'2'},{id:'e2',from:'1',to:'3'}];
  let view = {x:0,y:0,zoom:1}, selected = null, selectedEdge = null, mode = 'select', source = null, drag = null, history = [], saveTimer, toastTimer;
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  let restoredView = false;
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (data && Array.isArray(data.nodes) && data.nodes.every(n => typeof n.id==='string' && typeof n.label==='string' && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isInteger(n.color) && n.color>=0 && n.color<palette.length) && Array.isArray(data.edges)) {
      nodes = data.nodes; edges = data.edges.filter(e => typeof e.id==='string' && nodes.some(n=>n.id===e.from) && nodes.some(n=>n.id===e.to));
      if(data.view && Number.isFinite(data.view.x) && Number.isFinite(data.view.y) && Number.isFinite(data.view.zoom)){view = {...data.view,zoom:clamp(data.view.zoom,.25,2)};restoredView=true;}
    }
  } catch {}
  function snapshot(){return JSON.stringify({nodes,edges});}
  function remember(){history.push(snapshot());if(history.length>60)history.shift();$('undo').disabled=false;}
  function persist(){
    clearTimeout(saveTimer);$('saved').innerHTML='<i></i> Guardando…';
    saveTimer = setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify({nodes,edges,view}));$('saved').innerHTML='<i></i> Guardado en este navegador';}catch{$('saved').textContent='No se pudo guardar';toast('El navegador no permite guardar este tablero. Puedes exportarlo.');}},220);
  }
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
  function styleColor(el,color){const p=palette[color];el.style.setProperty('--node-bg',p.bg);el.style.setProperty('--node-border',p.border);el.style.setProperty('--node-ink',p.ink);}
  function render(){
    nodesEl.replaceChildren();
    nodes.forEach((n,i)=>{
      const el=document.createElement('div');el.className='node';el.dataset.id=n.id;el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',`${n.label}. Nodo ${i+1}`);el.setAttribute('aria-pressed',String(selected===n.id));el.style.left=n.x+'px';el.style.top=n.y+'px';styleColor(el,n.color);
      const number=document.createElement('span');number.className='node-number';number.textContent=String(i+1).padStart(2,'0');
      const label=document.createElement('span');label.className='node-label';label.textContent=n.label;
      const port=document.createElement('span');port.className='node-port';el.append(number,label,port);
      if(n.id===selected)el.classList.add('selected');if(n.id===source)el.classList.add('connect-source');
      el.addEventListener('pointerdown',e=>nodeDown(e,n));
      el.addEventListener('dblclick',e=>{e.stopPropagation();select(n.id);$('node-name').focus();$('node-name').select();});
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(mode==='connect')connect(n.id);else{select(n.id);$('node-name').focus();}}});
      nodesEl.append(el);
    });
    renderEdges();$('count').textContent=`${nodes.length} ${nodes.length===1?'nodo':'nodos'}`;$('empty').hidden=nodes.length>0;updatePanel();applyView();
  }
  function renderEdges(){
    edgesEl.replaceChildren();
    for(const edge of edges){
      const a=nodes.find(n=>n.id===edge.from),b=nodes.find(n=>n.id===edge.to);if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,r=Math.min(66,d/3);
      const x1=a.x+dx/d*r,y1=a.y+dy/d*r,x2=b.x-dx/d*r,y2=b.y-dy/d*r;
      const bend=Math.max(45,Math.abs(x2-x1)*.42),direction=dx>=0?1:-1;
      const path=`M ${x1} ${y1} C ${x1+bend*direction} ${y1}, ${x2-bend*direction} ${y2}, ${x2} ${y2}`;
      for(const hit of [true,false]){
        const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',path);el.setAttribute('class',hit?'edge-hit':`edge${selectedEdge===edge.id?' selected':''}`);el.dataset.edge=edge.id;
        el.addEventListener('pointerdown',e=>{if(mode==='pan')return;e.stopPropagation();selected=null;selectedEdge=edge.id;source=null;render();toast('Conexión seleccionada. Pulsa Supr para eliminarla.');});edgesEl.append(el);
      }
    }
  }
  function applyView(){world.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.zoom})`;$('zoom-label').textContent=Math.round(view.zoom*100)+'%';canvas.style.backgroundSize=`${24*view.zoom}px ${24*view.zoom}px`;canvas.style.backgroundPosition=`${view.x}px ${view.y}px`;}
  function select(nodeId){if(document.activeElement===$('node-name'))$('node-name').blur();selected=nodeId;selectedEdge=null;render();}
  function updatePanel(){
    const n=nodes.find(n=>n.id===selected);$('inspector').hidden=!n||mode==='connect';if(!n)return;
    if(document.activeElement!==$('node-name')||$('node-name').dataset.nodeId!==n.id)$('node-name').value=n.label;
    $('node-name').dataset.nodeId=n.id;
    [...$('colors').children].forEach((el,i)=>{el.classList.toggle('active',i===n.color);el.setAttribute('aria-pressed',String(i===n.color));});
  }
  palette.forEach((p,i)=>{const el=document.createElement('button');el.className='swatch';styleColor(el,i);el.title=p.name;el.setAttribute('aria-label',p.name);el.addEventListener('click',()=>{const n=nodes.find(n=>n.id===selected);if(!n||n.color===i)return;remember();n.color=i;render();persist();});$('colors').append(el);});
  function localPoint(clientX,clientY){const r=canvas.getBoundingClientRect();return{x:(clientX-r.left-view.x)/view.zoom,y:(clientY-r.top-view.y)/view.zoom};}
  function centerPoint(){const r=canvas.getBoundingClientRect();return localPoint(r.left+r.width*.48,r.top+r.height*.48);}
  function addNode(point){remember();const p=point||centerPoint();if(!point){let tries=0;while(nodes.some(n=>Math.hypot(n.x-p.x,n.y-p.y)<145)&&tries++<12){p.x+=55;p.y+=55;}}const n={id:id(),label:`Idea ${nodes.length+1}`,x:p.x,y:p.y,color:0};nodes.push(n);setMode('select',false);selected=n.id;selectedEdge=null;render();persist();toast('Nodo creado. Dale un nombre.');$('node-name').focus();$('node-name').select();}
  function setMode(next,announce=true){mode=next;source=null;canvas.dataset.mode=next;document.querySelectorAll('[data-mode].tool').forEach(b=>{b.classList.toggle('active',b.dataset.mode===next);b.setAttribute('aria-pressed',String(b.dataset.mode===next));});render();if(announce&&next==='connect')toast('Elige un nodo y después otro para conectarlos.');}
  function connect(nodeId){
    if(!source){source=nodeId;render();toast('Ahora elige el nodo de destino.');return;}
    if(source===nodeId){source=null;render();return;}
    if(edges.some(e=>(e.from===source&&e.to===nodeId)||(e.from===nodeId&&e.to===source))){toast('Estos nodos ya están conectados.');source=null;render();return;}
    remember();edges.push({id:id(),from:source,to:nodeId});source=null;render();persist();toast('Ideas conectadas.');
  }
  function nodeDown(e,n){if(e.button!==0)return;if(mode==='pan')return;e.stopPropagation();if(document.activeElement===$('node-name'))$('node-name').blur();if(mode==='connect'){e.preventDefault();connect(n.id);return;}selected=n.id;selectedEdge=null;const p=localPoint(e.clientX,e.clientY);drag={type:'node',nodeId:n.id,startX:e.clientX,startY:e.clientY,offsetX:p.x-n.x,offsetY:p.y-n.y,before:snapshot(),moved:false,pointerId:e.pointerId};[...nodesEl.children].find(el=>el.dataset.id===n.id).setPointerCapture(e.pointerId);for(const el of nodesEl.children){el.classList.toggle('selected',el.dataset.id===selected);el.setAttribute('aria-pressed',String(el.dataset.id===selected));}renderEdges();updatePanel();}
  const dragThreshold = 5;
  let stationaryClicks = 0;
  const isBackground = target => target === canvas || target === world || target === edgesEl;
  const canCreate = e => e.button === 0 && isBackground(e.target);

  canvas.addEventListener('pointerdown', e => {
    if (!canCreate(e)) stationaryClicks = 0;
  }, {capture:true});

  canvas.addEventListener('pointerdown', e => {
    if (drag || (e.button !== 0 && e.button !== 1)) return;
    if (e.target.closest('button,input,aside,nav,dialog,.zoom-controls,#help-button')) return;
    if (e.target.closest('.node') && mode !== 'pan') return;
    canvas.focus({preventScroll:true});
    if (mode === 'connect' && e.button === 0) {
      source = null;
      selected = null;
      selectedEdge = null;
      render();
    }
    drag = {
      type: 'pan', startX: e.clientX, startY: e.clientY, x: view.x, y: view.y,
      moved: false, pointerId: e.pointerId, canCreate: canCreate(e)
    };
    canvas.setPointerCapture(e.pointerId);
  });

  function updateDrag(e) {
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) <= dragThreshold) return;
    drag.moved = true;
    stationaryClicks = 0;
    if (drag.type === 'node') {
      const node = nodes.find(n => n.id === drag.nodeId);
      if (!node) return;
      const point = localPoint(e.clientX, e.clientY);
      node.x = point.x - drag.offsetX;
      node.y = point.y - drag.offsetY;
      const element = [...nodesEl.children].find(el => el.dataset.id === node.id);
      element.style.left = node.x + 'px';
      element.style.top = node.y + 'px';
      renderEdges();
    } else {
      view.x = drag.x + dx;
      view.y = drag.y + dy;
      applyView();
    }
  }

  canvas.addEventListener('pointermove', e => {
    if (drag?.pointerId === e.pointerId) updateDrag(e);
  });

  function endDrag(e) {
    if (drag?.pointerId !== e.pointerId) return;
    const cancelled = e.type === 'pointercancel';
    if (!cancelled) updateDrag(e);
    const current = drag;
    drag = null;

    if (current.canCreate && !current.moved && !cancelled) stationaryClicks++;
    else stationaryClicks = 0;

    if (current.type === 'node' && current.moved) {
      history.push(current.before);
      if (history.length > 60) history.shift();
      $('undo').disabled = false;
    } else if (current.type === 'pan' && !current.moved && !cancelled) {
      selected = null;
      selectedEdge = null;
      render();
    }
    persist();
  }
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('dblclick', e => {
    const create = canCreate(e) && stationaryClicks >= 2;
    stationaryClicks = 0;
    if (create) addNode(localPoint(e.clientX, e.clientY));
  });
  function zoomTo(z,cx,cy){const rect=canvas.getBoundingClientRect();const x=cx??rect.width/2,y=cy??rect.height/2;z=clamp(z,.25,2);const scale=z/view.zoom;view.x=x-(x-view.x)*scale;view.y=y-(y-view.y)*scale;view.zoom=z;applyView();persist();}
  canvas.addEventListener('wheel', e => {
    if (e.target.closest('aside,dialog')) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (dx === 0 && dy === 0) return;
    stationaryClicks = 0;
    if (drag) {
      drag.canCreate = false;
      return;
    }
    const zoomModifier = e.ctrlKey || e.metaKey;
    if (!zoomModifier && Math.abs(dx) > Math.abs(dy)) {
      view.x -= dx;
      applyView();
      persist();
      return;
    }
    if (dy === 0) return;
    const rect = canvas.getBoundingClientRect();
    const zoomDelta = zoomModifier ? dy : clamp(dy, -120, 120);
    zoomTo(view.zoom * Math.exp(-zoomDelta * .003), e.clientX - rect.left, e.clientY - rect.top);
  }, {passive:false});
  function fit(){const r=canvas.getBoundingClientRect();if(!nodes.length){view={x:r.width*.38,y:r.height*.48,zoom:1};applyView();return;}const minX=Math.min(...nodes.map(n=>n.x))-85,maxX=Math.max(...nodes.map(n=>n.x))+85,minY=Math.min(...nodes.map(n=>n.y))-90,maxY=Math.max(...nodes.map(n=>n.y))+85;const availableWidth=Math.max(220,r.width-(r.width>800?390:48)),availableHeight=Math.max(180,r.height-290);view.zoom=clamp(Math.min(availableWidth/(maxX-minX),availableHeight/(maxY-minY),1.15),.25,2);view.x=r.width*(r.width>800?.46:.5)-(minX+maxX)/2*view.zoom;view.y=r.height*.5+15-(minY+maxY)/2*view.zoom;applyView();persist();}
  function removeSelected(){if(!selected&&!selectedEdge)return;remember();if(selected){nodes=nodes.filter(n=>n.id!==selected);edges=edges.filter(e=>e.from!==selected&&e.to!==selected);}else edges=edges.filter(e=>e.id!==selectedEdge);selected=null;selectedEdge=null;render();persist();toast('Eliminado. Puedes deshacer con Ctrl + Z.');}
  function undo(){if(!history.length)return;const data=JSON.parse(history.pop());nodes=data.nodes;edges=data.edges;selected=null;selectedEdge=null;source=null;$('undo').disabled=!history.length;render();persist();toast('Cambio deshecho.');}
  let nameBefore=null;
  $('node-name').addEventListener('focus',()=>{nameBefore=snapshot();});
  $('node-name').addEventListener('input',e=>{const n=nodes.find(n=>n.id===selected);if(!n)return;n.label=e.target.value;const el=[...nodesEl.children].find(el=>el.dataset.id===n.id);el.querySelector('.node-label').textContent=n.label;el.setAttribute('aria-label',n.label);persist();});
  $('node-name').addEventListener('blur',()=>{const n=nodes.find(n=>n.id===selected);if(n&&!n.label.trim())n.label='Sin título';if(nameBefore&&nameBefore!==snapshot()){history.push(nameBefore);if(history.length>60)history.shift();$('undo').disabled=false;}nameBefore=null;render();persist();});
  $('node-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.target.blur();canvas.focus();}e.stopPropagation();});
  $('duplicate').onclick=()=>{const n=nodes.find(n=>n.id===selected);if(!n)return;remember();const copy={...n,id:id(),x:n.x+170,y:n.y+60,label:n.label+' (copia)'};nodes.push(copy);selected=copy.id;render();persist();};
  $('delete').onclick=removeSelected;$('close-panel').onclick=()=>select(null);$('undo').onclick=undo;$('add').onclick=()=>addNode();$('empty-add').onclick=()=>addNode();
  document.querySelectorAll('.tool[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $('zoom-in').onclick=()=>zoomTo(view.zoom+.1);$('zoom-out').onclick=()=>zoomTo(view.zoom-.1);$('zoom-label').onclick=()=>zoomTo(1);$('fit').onclick=fit;
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,nodes,edges,view},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mi-tablero.nodo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Tablero exportado.');};
  $('help-button').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();
  document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,dialog'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}if(e.ctrlKey||e.metaKey||e.altKey)return;switch(e.key.toLowerCase()){case'n':e.preventDefault();addNode();break;case'v':setMode('select');break;case'h':setMode('pan');break;case'c':setMode('connect');break;case'delete':case'backspace':e.preventDefault();removeSelected();break;case'escape':selected=null;selectedEdge=null;setMode('select',false);canvas.focus();break;case'?':$('help').showModal();break;}});
  if(!restoredView){const r=canvas.getBoundingClientRect();view={x:r.width*.36,y:r.height*.48,zoom:r.width<600?.65:1};}
  canvas.dataset.mode=mode;render();
  let lastSize={width:canvas.clientWidth,height:canvas.clientHeight};
  function keepVisible(){const r=canvas.getBoundingClientRect();if(nodes.length&&!nodes.some(n=>{const x=n.x*view.zoom+view.x,y=n.y*view.zoom+view.y;return x>64&&x<r.width-64&&y>165&&y<r.height-160;}))fit();}
  keepVisible();
  window.addEventListener('resize',()=>{const r=canvas.getBoundingClientRect();view.x+=(r.width-lastSize.width)/2;view.y+=(r.height-lastSize.height)/2;lastSize={width:r.width,height:r.height};if(r.width<800)fit();else{applyView();keepVisible();persist();}});
})();
