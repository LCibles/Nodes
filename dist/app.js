(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), world = $('world'), nodesEl = $('nodes'), edgesEl = $('edges');
  const commentTooltip = document.createElement('div');
  commentTooltip.id = 'comment-tooltip';
  commentTooltip.setAttribute('role', 'tooltip');
  commentTooltip.hidden = true;
  document.body.append(commentTooltip);
  let tooltipTarget;
  let tooltipTimer;
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
  function visibleNodes() {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const visibility = new Map();
    function isVisible(node) {
      if (visibility.has(node.id)) return visibility.get(node.id);
      visibility.set(node.id, false);
      const parent = node.code && byId.get(node.code.parent);
      const visible = !node.code || Boolean(parent && !parent.mapCollapsed && isVisible(parent));
      visibility.set(node.id, visible);
      return visible;
    }
    return nodes.filter(isVisible);
  }

  function lineLabel(part) {
    if (!part.start) return 'Etiqueta implícita';
    return part.start === part.end ? `Línea ${part.start}` : `Líneas ${part.start}–${part.end}`;
  }

  function hideComment() {
    clearTimeout(tooltipTimer);
    tooltipTarget = null;
    commentTooltip.hidden = true;
  }

  function showComment(node, comment) {
    if (drag?.moved) return;
    clearTimeout(tooltipTimer);
    tooltipTarget = node;
    commentTooltip.textContent = comment;
    commentTooltip.hidden = false;
    commentTooltip.scrollTop = 0;
    const anchor = node.getBoundingClientRect();
    const {width, height} = commentTooltip.getBoundingClientRect();
    const gap = 8;
    const paddedWidth = document.documentElement.clientWidth;
    const paddedHeight = document.documentElement.clientHeight;
    const x = clamp(anchor.left + (anchor.width - width) / 2, gap, Math.max(gap, paddedWidth - width - gap));
    const below = anchor.bottom + gap;
    const above = anchor.top - height - gap;
    const preferredY = below + height <= paddedHeight - gap ? below : above;
    const y = clamp(preferredY, gap, Math.max(gap, paddedHeight - height - gap));
    commentTooltip.style.left = x + 'px';
    commentTooltip.style.top = y + 'px';
  }

  function scheduleHideComment() {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(hideComment, 140);
  }

  commentTooltip.addEventListener('pointerenter', () => clearTimeout(tooltipTimer));
  commentTooltip.addEventListener('pointerleave', () => {
    if (!tooltipTarget?.matches(':focus-visible')) scheduleHideComment();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || commentTooltip.hidden) return;
    hideComment();
    event.stopPropagation();
  }, {capture:true});

  function render(){
    hideComment();
    const visible = visibleNodes();
    nodesEl.replaceChildren();
    visible.forEach((n,i)=>{
      const el=document.createElement('div');el.className='node';el.dataset.id=n.id;el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',`${n.label}. Nodo ${i+1}`);el.setAttribute('aria-pressed',String(selected===n.id));el.style.left=n.x+'px';el.style.top=n.y+'px';styleColor(el,n.color);
      const number=document.createElement('span');number.className='node-number';number.textContent=String(i+1).padStart(2,'0');
      const label=document.createElement('span');label.className='node-label';label.textContent=n.label;
      if (n.github) {
        el.classList.add('repo-node');
        el.title = n.github.repo + ' · ' + n.github.branch + '\n' + n.github.title;
        label.textContent = n.github.title;
        const branch = document.createElement('span');
        branch.className = 'repo-branch';
        branch.textContent = n.github.branch;
        el.setAttribute('aria-label', n.github.title + ' · Rama ' + n.github.branch);
        label.prepend(branch);
      } else if (n.file) {
        el.classList.add('file-node');
        el.title = n.file.path;
        el.setAttribute('aria-label', n.file.path);
      } else if (n.code) {
        el.classList.add('code-node', n.code.kind + '-part');
        const description = n.code.path + ' · ' + n.label + ' · ' + lineLabel(n.code);
        el.setAttribute('aria-label', description);
        if (n.code.kind === 'css' || n.code.kind === 'js') {
          el.classList.add('comment-node');
          el.addEventListener('pointerenter', event => {
            if (event.pointerType !== 'touch') showComment(el, n.label);
          });
          el.addEventListener('pointerleave', () => {
            if (tooltipTarget === el && !el.matches(':focus-visible')) scheduleHideComment();
          });
          el.addEventListener('focus', () => {
            if (el.matches(':focus-visible')) showComment(el, n.label);
          });
          el.addEventListener('blur', () => {
            if (tooltipTarget === el && !el.matches(':hover')) hideComment();
          });
        } else el.title = description;
        const name = document.createElement('span');
        name.className = 'code-part-name';
        name.textContent = n.label;
        const range = document.createElement('span');
        range.className = 'code-range';
        range.textContent = n.code.kind === 'css'
          ? n.code.path.split('/').at(-1) + ' · ' + lineLabel(n.code)
          : lineLabel(n.code);
        label.replaceChildren(name, range);
      }
      const port=document.createElement('span');port.className='node-port';el.append(number,label,port);
      if(n.id===selected)el.classList.add('selected');if(n.id===source)el.classList.add('connect-source');
      el.addEventListener('pointerdown',e=>nodeDown(e,n));
      el.addEventListener('dblclick',e=>{e.stopPropagation();activateNode(n);});
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(mode==='connect')connect(n.id);else activateNode(n);}});
      nodesEl.append(el);
    });
    renderEdges(visible);$('count').textContent=`${visible.length} ${visible.length===1?'nodo':'nodos'}`;$('empty').hidden=nodes.length>0;updatePanel();applyView();
  }
  function renderEdges(visible = visibleNodes()){
    edgesEl.replaceChildren();
    const byId = new Map(visible.map(node => [node.id, node]));
    let hasCssMatches = false;
    for(const edge of edges){
      const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
      const ra=Math.min(a.github ? 93 : 66,d/3), rb=Math.min(b.github ? 93 : 66,d/3);
      const x1=a.x+dx/d*ra,y1=a.y+dy/d*ra,x2=b.x-dx/d*rb,y2=b.y-dy/d*rb;
      const bend=Math.max(45,Math.abs(x2-x1)*.42),direction=dx>=0?1:-1;
      const path=`M ${x1} ${y1} C ${x1+bend*direction} ${y1}, ${x2-bend*direction} ${y2}, ${x2} ${y2}`;
      if (edge.kind === 'css-match' || edge.kind === 'structure') {
        const line = document.createElementNS('http://www.w3.org/2000/svg','path');
        line.setAttribute('d', path);
        const selectedMatch = selected === edge.from || selected === edge.to;
        line.setAttribute('class', edge.kind === 'css-match'
          ? 'css-match-edge' + (selectedMatch ? ' focused' : '')
          : 'structure-edge');
        edgesEl.append(line);
        if (edge.kind === 'css-match') hasCssMatches = true;
        continue;
      }
      for(const hit of [true,false]){
        const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',path);el.setAttribute('class',hit?'edge-hit':`edge${selectedEdge===edge.id?' selected':''}`);el.dataset.edge=edge.id;
        el.addEventListener('pointerdown',e=>{if(mode==='pan')return;e.stopPropagation();selected=null;selectedEdge=edge.id;source=null;render();toast('Conexión seleccionada. Pulsa Supr para eliminarla.');});edgesEl.append(el);
      }
    }
    $('css-legend').hidden = !hasCssMatches;
  }
  function applyView(){world.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.zoom})`;$('zoom-label').textContent=Math.round(view.zoom*100)+'%';canvas.style.backgroundSize=`${24*view.zoom}px ${24*view.zoom}px`;canvas.style.backgroundPosition=`${view.x}px ${view.y}px`;}
  function select(nodeId){if(document.activeElement===$('node-name'))$('node-name').blur();selected=nodeId;selectedEdge=null;render();}
  function activateNode(node) {
    select(node.id);
    if (node.code && nodes.some(candidate => candidate.code?.parent === node.id)) toggleCode(node);
    else if (node.code) openCodeSource(node);
    else if (node.file) showFile(node.file);
    else if (node.github) $('github-link').focus();
    else { $('node-name').focus(); $('node-name').select(); }
  }
  function updatePanel(){
    const n=nodes.find(n=>n.id===selected);$('inspector').hidden=!n||mode==='connect';if(!n)return;
    if(document.activeElement!==$('node-name')||$('node-name').dataset.nodeId!==n.id)$('node-name').value=n.label;
    $('node-name').dataset.nodeId=n.id;
    $('node-name').readOnly = Boolean(n.github || n.file || n.code);
    $('node-name').value = n.file ? n.file.path : n.github ? n.github.repo : $('node-name').value;
    $('github-link').hidden = Boolean(n.file || n.code);
    $('github-link').textContent = n.github ? 'Cambiar repositorio o rama' : 'Vincular a GitHub';
    $('github-refresh').hidden = !n.github;
    $('github-preview').hidden = !n.file && !n.code;
    $('github-preview').textContent = n.code ? 'Ver fragmento' : 'Ver contenido';
    const canMap = n.file && /\.(html?|css|[cm]?js)$/i.test(n.file.path) && !n.file.submodule;
    $('code-map').hidden = !canMap || Boolean(n.mapReady);
    const hasChildren = nodes.some(child => child.code?.parent === n.id);
    $('code-expand').hidden = !hasChildren;
    $('code-expand').textContent = n.mapCollapsed ? 'Desplegar hijos' : 'Plegar hijos';
    const matches = edges.filter(edge => edge.kind === 'css-match' && (edge.from === n.id || edge.to === n.id));
    $('code-matches').hidden = n.code?.kind !== 'css' || !matches.length;
    $('code-detail').hidden = !n.code;
    if (n.code) {
      const detail = n.code.kind === 'css'
        ? ` · ${matches.length} ${matches.length === 1 ? 'coincidencia' : 'coincidencias'} HTML`
        : '';
      $('code-detail').textContent = n.code.path + ' · ' + lineLabel(n.code) + detail;
    }
    const url = n.github
      ? window.nodoGithub.githubUrl(n.github.repo, 'commit', n.github.sha)
      : n.code ? codeSourceUrl(n.code) : n.file && window.nodoGithub.githubUrl(n.file.repo, 'blob', n.file.commit, n.file.path);
    $('github-open').hidden = !url;
    if (url) $('github-open').href = url;
    $('duplicate').hidden = Boolean(n.github || n.file || n.code);
    $('delete').hidden = Boolean(n.code);
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
    if (e.target.closest('a,button,input,aside,nav,dialog,.zoom-controls,#help-button')) return;
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
    if (!drag.moved) hideComment();
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
    hideComment();
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
  function fit(){fitNodes(visibleNodes());}
  function fitNodes(group) {
    const r = canvas.getBoundingClientRect();
    if (!group.length) {
      view = {x:r.width*.38, y:r.height*.48, zoom:1};
      applyView();
      return;
    }
    const minX = Math.min(...group.map(n => n.x)) - 94;
    const maxX = Math.max(...group.map(n => n.x)) + 94;
    const minY = Math.min(...group.map(n => n.y)) - 94;
    const maxY = Math.max(...group.map(n => n.y)) + 94;
    const availableWidth = Math.max(220, r.width - (r.width > 800 ? 390 : 48));
    const availableHeight = Math.max(180, r.height - 270);
    view.zoom = clamp(Math.min(availableWidth/(maxX-minX), availableHeight/(maxY-minY), 1.15), .25, 2);
    view.x = r.width * (r.width > 800 ? .46 : .5) - (minX + maxX) / 2 * view.zoom;
    view.y = r.height * .5 + 15 - (minY + maxY) / 2 * view.zoom;
    applyView();
    persist();
  }
  function removeSelected(){
    if (!selected && !selectedEdge) return;
    if (nodes.some(node => node.id === selected && node.code)) return;
    remember();
    if (selected) {
      const removed = new Set([selected, ...nodes.filter(n => n.file?.parent === selected).map(n => n.id)]);
      for (const node of nodes) if (node.code && removed.has(node.code.fileId)) removed.add(node.id);
      nodes = nodes.filter(n => !removed.has(n.id));
      edges = edges.filter(e => !removed.has(e.from) && !removed.has(e.to));
    } else edges = edges.filter(e => e.id !== selectedEdge);
    selected = null;
    selectedEdge = null;
    render();
    persist();
    toast('Eliminado. Puedes deshacer con Ctrl + Z.');
  }
  function undo(){if(!history.length)return;const data=JSON.parse(history.pop());nodes=data.nodes;edges=data.edges;selected=null;selectedEdge=null;source=null;$('undo').disabled=!history.length;render();persist();toast('Cambio deshecho.');}
  let nameBefore=null;
  $('node-name').addEventListener('focus',()=>{nameBefore=snapshot();});
  $('node-name').addEventListener('input',e=>{const n=nodes.find(n=>n.id===selected);if(!n)return;n.label=e.target.value;const el=[...nodesEl.children].find(el=>el.dataset.id===n.id);el.querySelector('.node-label').textContent=n.label;el.setAttribute('aria-label',n.label);persist();});
  $('node-name').addEventListener('blur',()=>{const n=nodes.find(n=>n.id===selected);if(n&&!n.label.trim())n.label='Sin título';if(nameBefore&&nameBefore!==snapshot()){history.push(nameBefore);if(history.length>60)history.shift();$('undo').disabled=false;}nameBefore=null;render();persist();});
  $('node-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.target.blur();canvas.focus();}e.stopPropagation();});
  const githubDialog = $('github-dialog');
  const fileDialog = $('file-dialog');
  const exampleRepo = 'LCibles/new_web_is';
  let linkTarget = null;
  let linkRequest;
  let previewRequest;

  function openGithub(node = null) {
    linkTarget = node?.id ?? null;
    $('github-title').textContent = node?.github ? 'Cambiar repositorio o rama' : 'Vincular repositorio';
    $('github-repo').value = node?.github?.repo ?? exampleRepo;
    $('github-branch').value = node?.github?.branch ?? '';
    $('github-error').textContent = '';
    githubDialog.showModal();
  }

  function applyRepository(result, parent, recordHistory = true) {
    if (recordHistory) remember();
    const {files, ...github} = result;
    const sameRepo = parent?.github?.repo.toLowerCase() === github.repo.toLowerCase();
    if (!parent) {
      const center = centerPoint();
      const right = nodes.length ? Math.max(...nodes.map(node => node.x)) : center.x - 225;
      parent = {id:id(), x:right + 225, y:center.y, color:3, label:github.repo};
      nodes.push(parent);
    }
    const previous = nodes.filter(node => node.file?.parent === parent.id);
    const previousIds = new Set(previous.map(node => node.id));
    const byPath = new Map(sameRepo ? previous.map(node => [node.file.path, node]) : []);
    const rows = Math.min(7, Math.max(1, Math.ceil(Math.sqrt(files.length))));
    const nextPaths = new Set(files.map(file => file.path));
    const occupied = nodes.filter(node => node.id !== parent.id &&
      (node.file?.parent !== parent.id || (sameRepo && nextPaths.has(node.file.path))));
    const children = files.map((file, index) => {
      const original = byPath.get(file.path);
      let x = original?.x ?? parent.x + 245 + Math.floor(index / rows) * 177;
      const y = original?.y ?? parent.y + (index % rows - (rows - 1) / 2) * 162;
      while (!original && occupied.some(node => Math.hypot(node.x - x, node.y - y) < (node.github ? 171 : 144))) x += 177;
      const child = {
        id:original?.id ?? id(), x, y, color:original?.color ?? 0,
        label:file.path.split('/').at(-1),
        file:{...file, parent:parent.id, repo:github.repo, commit:github.sha}
      };
      if (original?.mapReady && original.file.sha === file.sha) {
        child.mapReady = true;
        child.mapCollapsed = original.mapCollapsed;
      }
      if (!original) occupied.push(child);
      return child;
    });
    parent.github = github;
    const kept = new Set(children.map(child => child.id));
    const validMaps = new Set(children.filter(child => child.mapReady).map(child => child.id));
    const staleCodes = new Set(nodes.filter(node => node.code && previousIds.has(node.code.fileId) && !validMaps.has(node.code.fileId)).map(node => node.id));
    const removed = nodeId => (previousIds.has(nodeId) && !kept.has(nodeId)) || staleCodes.has(nodeId);
    nodes = nodes.filter(node => !previousIds.has(node.id) && !staleCodes.has(node.id)).concat(children);
    edges = edges.filter(edge => edge.repository !== parent.id && !removed(edge.from) && !removed(edge.to));
    edges = edges.concat(children.map(child => ({id:id(), from:parent.id, to:child.id, repository:parent.id})));
    return parent;
  }

  $('github-add').onclick = () => openGithub();
  $('github-link').onclick = () => openGithub(nodes.find(node => node.id === selected));
  $('github-cancel').onclick = () => githubDialog.close();
  githubDialog.addEventListener('close', () => {
    linkRequest?.abort();
    $('github-submit').disabled = false;
  });
  $('github-form').addEventListener('submit', async event => {
    event.preventDefault();
    linkRequest?.abort();
    const request = new AbortController();
    linkRequest = request;
    const target = linkTarget;
    $('github-submit').disabled = true;
    $('github-error').textContent = 'Consultando GitHub…';
    try {
      const result = await window.nodoGithub.load($('github-repo').value, $('github-branch').value, request.signal);
      if (request.signal.aborted) return;
      const parent = nodes.find(node => node.id === target);
      if (target && !parent) throw new Error('El nodo seleccionado ya no existe.');
      const linked = applyRepository(result, parent);
      selected = linked.id;
      selectedEdge = null;
      setMode('select', false);
      githubDialog.close();
      fit();
      persist();
      toast(result.files.length + ' archivos vinculados');
    } catch (error) {
      if (!request.signal.aborted) $('github-error').textContent = error.message || 'No se pudo consultar GitHub.';
    } finally {
      if (linkRequest === request) $('github-submit').disabled = false;
    }
  });

  const refreshing = new Set();
  async function refreshRepo(node, quiet = false) {
    if (!node?.github || refreshing.has(node.id)) return;
    const {id: nodeId, github: previous} = node;
    refreshing.add(nodeId);
    if (!quiet) toast('Consultando GitHub…');
    try {
      const result = await window.nodoGithub.load(previous.repo, previous.branch, AbortSignal.timeout(15000));
      const current = nodes.find(candidate => candidate.id === nodeId);
      if (!current || current.github !== previous || drag) return;
      if (result.sha !== previous.sha || !quiet) {
        applyRepository(result, current, !quiet);
        if (selected && !nodes.some(candidate => candidate.id === selected)) selected = null;
        render();
        persist();
      }
      if (!quiet) toast(result.files.length + ' archivos actualizados');
    } catch (error) {
      if (!quiet) toast(error.message || 'No se pudo actualizar el repositorio.');
    } finally {
      refreshing.delete(nodeId);
    }
  }
  $('github-refresh').onclick = () => refreshRepo(nodes.find(node => node.id === selected));

  const analysisCache = new Map();
  let mapping = false;

  async function analyzeFile(file) {
    const key = file.repo + ':' + file.path + ':' + file.sha;
    if (analysisCache.has(key)) return analysisCache.get(key);
    const content = await window.nodoGithub.preview(file, AbortSignal.timeout(15000));
    let analysis;
    if (/\.css$/i.test(file.path)) analysis = {parts:window.nodoCodeMap.parseCss(content)};
    else if (/\.[cm]?js$/i.test(file.path)) analysis = {parts:window.nodoCodeMap.parseJavaScript(content)};
    else analysis = window.nodoCodeMap.parseHtml(content);
    if (analysisCache.size >= 16) analysisCache.delete(analysisCache.keys().next().value);
    analysisCache.set(key, analysis);
    return analysis;
  }

  function placeVisibleCode() {
    const visible = visibleNodes();
    const byId = new Map(visible.map(node => [node.id, node]));
    const positioned = visible.filter(node => !node.code || node.mapPlaced);
    const siblings = new Map();
    for (const node of visible) {
      if (!node.code) continue;
      if (!siblings.has(node.code.parent)) siblings.set(node.code.parent, []);
      siblings.get(node.code.parent).push(node);
    }
    for (const [parentId, children] of siblings) {
      const parent = byId.get(parentId);
      const rows = Math.min(5, children.length);
      children.forEach((node, index) => {
        if (node.mapPlaced) return;
        const horizontal = children.length > 5;
        node.x = parent.x + 178 + Math.floor(index / rows) * 148;
        node.y = parent.y + (index % rows - (rows - 1) / 2) * 147;
        while (positioned.some(other => Math.hypot(other.x - node.x, other.y - node.y) < (other.github ? 166 : 137))) {
          if (horizontal) node.x += 148;
          else node.y += 147;
        }
        node.mapPlaced = true;
        positioned.push(node);
      });
    }
  }

  function attachStructure(fileNode, analysis) {
    const byKey = new Map(analysis.parts.map(part => [part.key, id()]));
    const deepParts = new Set(analysis.parts.filter(part => part.parent !== null).map(part => part.key));
    const codeNodes = analysis.parts.map(part => ({
      id:byKey.get(part.key),
      x:fileNode.x, y:fileNode.y, color:part.kind === 'css' ? 2 : 3,
      label:part.title,
      mapCollapsed:deepParts.has(part.key),
      code:{
        fileId:fileNode.id, path:fileNode.file.path, parent:byKey.get(part.parent) ?? fileNode.id,
        kind:part.kind, key:part.key, start:part.start, end:part.end
      }
    }));
    fileNode.mapReady = true;
    fileNode.mapCollapsed = false;
    nodes = nodes.concat(codeNodes);
    edges = edges.concat(codeNodes.map(node => ({id:id(), from:node.code.parent, to:node.id, kind:'structure'})));
    return byKey;
  }

  async function analyzeMatches(fileNode, analysis) {
    if (/\.[cm]?js$/i.test(fileNode.file.path)) return [];
    const isCss = /\.css$/i.test(fileNode.file.path);
    const siblings = nodes.filter(node => node.mapReady && node.file?.parent === fileNode.file.parent &&
      (isCss ? /\.html?$/i : /\.css$/i).test(node.file.path));
    return Promise.allSettled(siblings.map(async other => {
      const parsed = await analyzeFile(other.file);
      const matches = isCss
        ? window.nodoCodeMap.cssMatches(analysis.parts, fileNode.file.path, parsed, other.file.path)
        : window.nodoCodeMap.cssMatches(parsed.parts, other.file.path, analysis, fileNode.file.path);
      return {other, matches, isCss};
    }));
  }

  function addCodeMatches(fileNode, mapKeys, results) {
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const {other, matches, isCss} = result.value;
      if (!nodes.includes(other)) continue;
      const otherKeys = new Map(nodes.filter(node => node.code?.fileId === other.id).map(node => [node.code.key, node.id]));
      for (const match of matches) {
        const from = (isCss ? mapKeys : otherKeys).get(match.cssKey);
        const to = (isCss ? otherKeys : mapKeys).get(match.htmlKey);
        if (from && to) edges.push({id:id(), from, to, kind:'css-match'});
      }
    }
  }

  $('code-map').onclick = async () => {
    const fileNode = nodes.find(node => node.id === selected);
    if (!fileNode?.file || fileNode.mapReady || mapping) return;
    mapping = true;
    $('code-map').disabled = true;
    toast('Analizando el código…');
    try {
      const analysis = await analyzeFile(fileNode.file);
      const matches = await analyzeMatches(fileNode, analysis);
      if (!nodes.includes(fileNode) || fileNode.mapReady) return;
      if (!analysis.parts.length) {
        toast('No se encontraron estructuras para desplegar.');
        return;
      }
      remember();
      const mapKeys = attachStructure(fileNode, analysis);
      addCodeMatches(fileNode, mapKeys, matches);
      placeVisibleCode();
      render();
      if (selected === fileNode.id) fitNodes(visibleNodes().filter(node => node.id === fileNode.id || node.code?.fileId === fileNode.id));
      persist();
      const partial = matches.some(result => result.status === 'rejected');
      toast(partial ? 'Mapa creado. Algunas coincidencias no se pudieron comprobar.' : 'Estructura del archivo desplegada.');
    } catch (error) {
      toast(error.message || 'No se pudo mapear el código.');
    } finally {
      mapping = false;
      $('code-map').disabled = false;
    }
  };

  function toggleCode(node) {
    if (!node) return;
    remember();
    node.mapCollapsed = !node.mapCollapsed;
    placeVisibleCode();
    render();
    if (!node.mapCollapsed) fitNodes(visibleNodes().filter(candidate => candidate === node || candidate.code?.parent === node.id));
    persist();
  }
  $('code-expand').onclick = () => toggleCode(nodes.find(node => node.id === selected));

  $('code-matches').onclick = () => {
    const targets = new Set(edges.filter(edge => edge.kind === 'css-match' && edge.from === selected).map(edge => edge.to));
    const byId = new Map(nodes.map(node => [node.id, node]));
    remember();
    for (const target of targets) {
      let node = byId.get(target);
      while (node?.code) {
        node = byId.get(node.code.parent);
        if (node) node.mapCollapsed = false;
      }
    }
    placeVisibleCode();
    render();
    fitNodes(visibleNodes().filter(node => node.id === selected || targets.has(node.id)));
    persist();
  };

  function codeSourceUrl(part) {
    const file = nodes.find(node => node.id === part.fileId)?.file;
    if (!file) return null;
    const url = window.nodoGithub.githubUrl(file.repo, 'blob', file.commit, file.path);
    const anchor = !part.start ? '' : '#L' + part.start + (part.end > part.start ? '-L' + part.end : '');
    return url && url + anchor;
  }

  function openCodeSource(node) {
    const file = nodes.find(candidate => candidate.id === node.code.fileId)?.file;
    if (file) showFile(file, node.code);
  }

  async function showFile(file, part) {
    previewRequest?.abort();
    const request = new AbortController();
    previewRequest = request;
    $('file-path').textContent = part ? file.path + ' · ' + lineLabel(part) : file.path;
    $('file-content').textContent = '';
    $('file-content').hidden = true;
    $('file-open').href = part ? codeSourceUrl(part) : window.nodoGithub.githubUrl(file.repo, 'blob', file.commit, file.path);
    $('file-status').textContent = 'Cargando archivo…';
    if (!fileDialog.open) fileDialog.showModal();
    try {
      const content = await window.nodoGithub.preview(file, request.signal);
      if (request.signal.aborted) return;
      const text = part?.start ? content.split(/\r?\n/).slice(part.start - 1, part.end).join('\n') : content;
      $('file-content').textContent = text || 'Archivo vacío';
      $('file-content').hidden = false;
      $('file-status').textContent = '';
    } catch (error) {
      if (!request.signal.aborted) $('file-status').textContent = error.message || 'No se pudo abrir el archivo.';
    }
  }
  $('github-preview').onclick = () => {
    const node = nodes.find(candidate => candidate.id === selected);
    if (node?.code) openCodeSource(node);
    else if (node?.file) showFile(node.file);
  };
  $('file-close').onclick = () => fileDialog.close();
  fileDialog.addEventListener('close', () => previewRequest?.abort());
  $('duplicate').onclick=()=>{const n=nodes.find(n=>n.id===selected);if(!n)return;remember();const copy={...n,id:id(),x:n.x+170,y:n.y+60,label:n.label+' (copia)'};nodes.push(copy);selected=copy.id;render();persist();};
  $('delete').onclick=removeSelected;$('close-panel').onclick=()=>select(null);$('undo').onclick=undo;$('add').onclick=()=>addNode();$('empty-add').onclick=()=>addNode();
  document.querySelectorAll('.tool[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $('zoom-in').onclick=()=>zoomTo(view.zoom+.1);$('zoom-out').onclick=()=>zoomTo(view.zoom-.1);$('zoom-label').onclick=()=>zoomTo(1);$('fit').onclick=fit;
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,nodes,edges,view},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mi-tablero.nodo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Tablero exportado.');};
  $('help-button').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();
  document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,dialog'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}if(e.ctrlKey||e.metaKey||e.altKey)return;switch(e.key.toLowerCase()){case'n':e.preventDefault();addNode();break;case'v':setMode('select');break;case'h':setMode('pan');break;case'c':setMode('connect');break;case'delete':case'backspace':e.preventDefault();removeSelected();break;case'escape':selected=null;selectedEdge=null;setMode('select',false);canvas.focus();break;case'?':$('help').showModal();break;}});
  if(!restoredView){const r=canvas.getBoundingClientRect();view={x:r.width*.36,y:r.height*.48,zoom:r.width<600?.65:1};}
  canvas.dataset.mode=mode;render();
  (async () => {
    for (const node of nodes.filter(node => node.github)) await refreshRepo(node, true);
  })();
  let lastSize={width:canvas.clientWidth,height:canvas.clientHeight};
  function keepVisible(){const r=canvas.getBoundingClientRect();if(nodes.length&&!nodes.some(n=>{const x=n.x*view.zoom+view.x,y=n.y*view.zoom+view.y;return x>64&&x<r.width-64&&y>165&&y<r.height-160;}))fit();}
  keepVisible();
  window.addEventListener('resize',()=>{const r=canvas.getBoundingClientRect();view.x+=(r.width-lastSize.width)/2;view.y+=(r.height-lastSize.height)/2;lastSize={width:r.width,height:r.height};if(r.width<800)fit();else{applyView();keepVisible();persist();}});
})();
