import DxfParser from 'https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/+esm';

const FR=document.documentElement.lang.toLowerCase().startsWith('fr');
const T=FR?{
  noDxf:'Aucun DXF', entities:'entités', units:'Unités', unitless:'sans unité', loadFail:'Impossible de lire ce DXF.',
  firstPoint:'Cliquez le premier point.', secondPoint:'Cliquez le deuxième point.', moveBase:'Cliquez le point de base.', moveTarget:'Cliquez le point cible.',
  selected:'sélectionnée(s)', noSelection:'Aucune sélection', deleted:'Entité(s) supprimée(s).', moved:'Entité(s) déplacée(s).', exported:'DXF exporté.',
  analysisDone:'Analyse terminée.', openContours:'Contours ouverts', duplicates:'Doublons potentiels', unsupported:'Entités non prises en charge', approx:'Entités approximées', layers:'Layers',
  clean:'Aucun problème évident détecté.', chooseSelection:'Sélectionnez au moins une entité.', parser:'Moteur DXF', normalized:'DXF normalisé', snap:'Snap',
}: {
  noDxf:'No DXF', entities:'entities', units:'Units', unitless:'unitless', loadFail:'Unable to read this DXF.',
  firstPoint:'Click the first point.', secondPoint:'Click the second point.', moveBase:'Click the base point.', moveTarget:'Click the target point.',
  selected:'selected', noSelection:'No selection', deleted:'Entity/entities deleted.', moved:'Entity/entities moved.', exported:'DXF exported.',
  analysisDone:'Analysis complete.', openContours:'Open contours', duplicates:'Potential duplicates', unsupported:'Unsupported entities', approx:'Approximated entities', layers:'Layers',
  clean:'No obvious issue detected.', chooseSelection:'Select at least one entity.', parser:'DXF engine', normalized:'Normalized DXF', snap:'Snap',
};

const $=id=>document.getElementById(id);
const E={
  workspace:$('n2-workspace'),canvas:$('n2-canvas'),file:$('n2-file'),empty:$('n2-empty'),
  select:$('n2-select'),measure:$('n2-measure'),move:$('n2-move'),del:$('n2-delete'),undo:$('n2-undo'),redo:$('n2-redo'),fit:$('n2-fit'),grid:$('n2-grid'),snap:$('n2-snap'),layers:$('n2-layers'),analyze:$('n2-analyze'),props:$('n2-properties'),export:$('n2-export'),close:$('n2-close'),
  layerDrawer:$('n2-layer-drawer'),propDrawer:$('n2-prop-drawer'),layerList:$('n2-layer-list'),layersAll:$('n2-layers-all'),layersNone:$('n2-layers-none'),
  propFile:$('n2-prop-file'),propUnits:$('n2-prop-units'),propEntities:$('n2-prop-entities'),propLayers:$('n2-prop-layers'),propSize:$('n2-prop-size'),selectionInfo:$('n2-selection-info'),analysisInfo:$('n2-analysis-info'),
  measureCard:$('n2-measure-card'),measureMain:$('n2-measure-main'),measureDx:$('n2-measure-dx'),measureDy:$('n2-measure-dy'),measureHelp:$('n2-measure-help'),measureClear:$('n2-measure-clear'),
  toast:$('n2-toast'),statusFile:$('n2-status-file'),statusEntities:$('n2-status-entities'),statusUnits:$('n2-status-units')
};

const ctx=E.canvas.getContext('2d',{alpha:false});
const DPR=()=>Math.min(window.devicePixelRatio||1,2);
const state={
  file:null,dxf:null,entities:[],layers:new Map(),unsupported:[],selected:new Set(),hover:null,
  tool:'select',grid:true,snap:true,unitCode:0,unitLabel:'u',bounds:null,
  view:{scale:1,cx:0,cy:0},drag:null,pointer:{x:0,y:0},measure:[],moveBase:null,
  history:[],future:[],analysis:null,dirty:false
};

const UNIT_LABELS={0:'u',1:'in',2:'ft',3:'mi',4:'mm',5:'cm',6:'m',7:'km',8:'µin',9:'mil',10:'yd',11:'Å',12:'nm',13:'µm',14:'dm'};
const ACI=['#ffffff','#ff5555','#ffd45a','#6ee7a5','#65d9ff','#6f85ff','#de76ff','#d9d9d9','#8f9aa3','#c1c7cc'];
let toastTimer=0;

init();

function init(){
  bindUI();resize();setTool('select');requestAnimationFrame(frame);
}

function bindUI(){
  addEventListener('resize',resize);
  E.file.addEventListener('change',()=>{const f=E.file.files?.[0];if(f)loadDxf(f);E.file.value='';});
  ['dragenter','dragover'].forEach(type=>E.workspace.addEventListener(type,e=>{e.preventDefault();E.workspace.classList.add('drag-over');}));
  ['dragleave','drop'].forEach(type=>E.workspace.addEventListener(type,e=>{e.preventDefault();E.workspace.classList.remove('drag-over');}));
  E.workspace.addEventListener('drop',e=>{const f=[...(e.dataTransfer?.files||[])].find(x=>x.name.toLowerCase().endsWith('.dxf'));if(f)loadDxf(f);});

  E.select.addEventListener('click',()=>setTool('select'));
  E.measure.addEventListener('click',()=>setTool('measure'));
  E.move.addEventListener('click',()=>{if(!state.selected.size)return toast(T.chooseSelection);setTool('move');state.moveBase=null;toast(T.moveBase);});
  E.del.addEventListener('click',deleteSelected);
  E.undo.addEventListener('click',undo);
  E.redo.addEventListener('click',redo);
  E.fit.addEventListener('click',fitView);
  E.grid.addEventListener('click',()=>{state.grid=!state.grid;E.grid.classList.toggle('active',state.grid);});
  E.snap.addEventListener('click',()=>{state.snap=!state.snap;E.snap.classList.toggle('active',state.snap);});
  E.layers.addEventListener('click',()=>toggleDrawer('layers'));
  E.props.addEventListener('click',()=>toggleDrawer('properties'));
  E.analyze.addEventListener('click',runAnalysis);
  E.export.addEventListener('click',exportDxf);
  E.close.addEventListener('click',clearFile);
  E.layersAll.addEventListener('click',()=>setAllLayers(true));
  E.layersNone.addEventListener('click',()=>setAllLayers(false));
  E.measureClear.addEventListener('click',()=>clearMeasure());
  document.querySelectorAll('[data-close-drawer]').forEach(b=>b.addEventListener('click',()=>toggleDrawer(b.dataset.closeDrawer,false)));
  document.querySelectorAll('[data-assign-layer]').forEach(b=>b.addEventListener('click',()=>assignSelectedLayer(b.dataset.assignLayer)));

  E.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  E.canvas.addEventListener('pointerdown',pointerDown);
  E.canvas.addEventListener('pointermove',pointerMove);
  E.canvas.addEventListener('pointerup',pointerUp);
  E.canvas.addEventListener('pointercancel',pointerUp);
  E.canvas.addEventListener('wheel',wheel,{passive:false});

  addEventListener('keydown',e=>{
    if(e.key==='Escape'){state.drag=null;state.moveBase=null;clearMeasure();setTool('select');}
    if(e.key==='Delete'||e.key==='Backspace'){if(state.selected.size){e.preventDefault();deleteSelected();}}
    if(e.key.toLowerCase()==='f'){e.preventDefault();fitView();}
    if(e.key.toLowerCase()==='m'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();setTool('measure');}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  });
}

async function loadDxf(file){
  try{
    const text=await file.text();
    const parser=new DxfParser();
    const dxf=parser.parseSync(text);
    state.file=file;state.dxf=dxf;state.unsupported=[];state.selected.clear();state.history=[];state.future=[];state.analysis=null;state.dirty=false;
    state.unitCode=Number(dxf?.header?.$INSUNITS??0)||0;state.unitLabel=UNIT_LABELS[state.unitCode]||'u';
    state.entities=normalizeDxf(dxf);
    rebuildLayers();recomputeBounds();fitView();syncUI();renderLayerList();renderProperties();
    E.empty.hidden=true;toast(`${file.name} · ${state.entities.length} ${T.entities}`);
  }catch(err){console.error(err);toast(T.loadFail);}
}

function normalizeDxf(dxf){
  const out=[];let id=1;
  for(const raw of dxf?.entities||[]){
    const entity=canonicalize(raw,id++);
    if(Array.isArray(entity))out.push(...entity);else if(entity)out.push(entity);else state.unsupported.push(raw?.type||'UNKNOWN');
  }
  return out;
}

function canonicalize(raw,id){
  const type=String(raw?.type||'').toUpperCase();
  const layer=raw?.layer||'0';
  const base={id:`e${id}`,type,layer,color:entityColor(raw),rawType:type,approx:false};
  if(type==='LINE'&&raw.vertices?.length>=2)return {...base,p1:p(raw.vertices[0]),p2:p(raw.vertices[1])};
  if((type==='LWPOLYLINE'||type==='POLYLINE')&&raw.vertices?.length>=2){
    return {...base,type:'POLYLINE',points:raw.vertices.map(v=>({x:+v.x||0,y:+v.y||0,bulge:+v.bulge||0})),closed:Boolean(raw.shape||raw.closed||((raw.flags||0)&1))};
  }
  if(type==='CIRCLE'&&raw.center&&Number.isFinite(raw.radius))return {...base,center:p(raw.center),radius:Math.abs(+raw.radius)};
  if(type==='ARC'&&raw.center&&Number.isFinite(raw.radius))return {...base,center:p(raw.center),radius:Math.abs(+raw.radius),start:+raw.startAngle||0,end:+raw.endAngle||0};
  if(type==='POINT'&&(raw.position||raw.point||raw.vertices?.[0]))return {...base,point:p(raw.position||raw.point||raw.vertices[0])};
  if(type==='ELLIPSE'&&raw.center&&raw.majorAxisEndPoint){
    const pts=sampleEllipse(raw);if(pts.length>1)return {...base,type:'POLYLINE',rawType:'ELLIPSE',points:pts.map(q=>({...q,bulge:0})),closed:isFullEllipse(raw),approx:true};
  }
  if(type==='SPLINE'&&raw.controlPoints?.length>=2){
    const pts=sampleSpline(raw);if(pts.length>1)return {...base,type:'POLYLINE',rawType:'SPLINE',points:pts.map(q=>({...q,bulge:0})),closed:Boolean(raw.closed),approx:true};
  }
  if((type==='TEXT'||type==='MTEXT')){
    const pos=raw.startPoint||raw.position||raw.anchorPoint||raw.vertices?.[0];
    if(pos)return {...base,type:'TEXT',point:p(pos),text:String(raw.text??raw.string??''),height:Math.abs(+raw.textHeight||+raw.height||2.5),rotation:+raw.rotation||0};
  }
  return null;
}

function p(v){return{x:+v?.x||0,y:+v?.y||0};}
function entityColor(raw){const c=Number(raw?.colorNumber??raw?.colorIndex??7);return ACI[Math.abs(c)%ACI.length]||'#c4cdd2';}

function sampleEllipse(raw){
  const c=p(raw.center),m=p(raw.majorAxisEndPoint),ratio=Math.abs(+raw.axisRatio||1),start=Number.isFinite(raw.startAngle)?+raw.startAngle:0,end=Number.isFinite(raw.endAngle)?+raw.endAngle:Math.PI*2;
  const len=Math.hypot(m.x,m.y);if(!len)return[];const ux={x:m.x/len,y:m.y/len},uy={x:-ux.y,y:ux.x};let span=end-start;if(span<=0)span+=Math.PI*2;
  const n=Math.max(24,Math.ceil(span/(Math.PI/48)));const pts=[];for(let i=0;i<=n;i++){const t=start+span*i/n;pts.push({x:c.x+ux.x*len*Math.cos(t)+uy.x*len*ratio*Math.sin(t),y:c.y+ux.y*len*Math.cos(t)+uy.y*len*ratio*Math.sin(t)});}return pts;
}
function isFullEllipse(raw){let a=Number.isFinite(raw.startAngle)?+raw.startAngle:0,b=Number.isFinite(raw.endAngle)?+raw.endAngle:Math.PI*2;let span=b-a;if(span<=0)span+=Math.PI*2;return Math.abs(span-Math.PI*2)<1e-4;}

function sampleSpline(raw){
  const cps=(raw.controlPoints||[]).map(p),degree=Math.max(1,Math.min(+raw.degreeOfSpline||3,cps.length-1)),knots=(raw.knots||[]).map(Number),weights=(raw.weights||[]).map(Number);
  if(knots.length<cps.length+degree+1)return cps;
  const u0=knots[degree],u1=knots[knots.length-degree-1],n=Math.max(32,cps.length*12),pts=[];
  for(let i=0;i<=n;i++){const u=i===n?u1:u0+(u1-u0)*i/n;const q=deBoorPoint(cps,degree,knots,weights,u);if(q)pts.push(q);}return pts;
}
function deBoorPoint(cps,k,knots,weights,u){
  let s=k;for(let i=k;i<knots.length-k-1;i++){if(u>=knots[i]&&u<knots[i+1]){s=i;break;}if(u===knots[knots.length-k-1])s=cps.length-1;}
  const d=[];for(let j=0;j<=k;j++){const idx=Math.max(0,Math.min(cps.length-1,s-k+j)),w=Number.isFinite(weights[idx])?weights[idx]:1;d.push({x:cps[idx].x*w,y:cps[idx].y*w,w});}
  for(let r=1;r<=k;r++)for(let j=k;j>=r;j--){const i=s-k+j,den=knots[i+k-r+1]-knots[i],a=Math.abs(den)<1e-12?0:(u-knots[i])/den;d[j]={x:(1-a)*d[j-1].x+a*d[j].x,y:(1-a)*d[j-1].y+a*d[j].y,w:(1-a)*d[j-1].w+a*d[j].w};}
  const q=d[k];return Math.abs(q.w)<1e-12?null:{x:q.x/q.w,y:q.y/q.w};
}

function rebuildLayers(){
  state.layers.clear();for(const e of state.entities){if(!state.layers.has(e.layer))state.layers.set(e.layer,{name:e.layer,visible:true,count:0,color:e.color});state.layers.get(e.layer).count++;}
}
function recomputeBounds(){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const e of state.entities){if(!layerVisible(e.layer))continue;for(const q of entitySamples(e)){if(!Number.isFinite(q.x)||!Number.isFinite(q.y))continue;minX=Math.min(minX,q.x);minY=Math.min(minY,q.y);maxX=Math.max(maxX,q.x);maxY=Math.max(maxY,q.y);}}
  state.bounds=Number.isFinite(minX)?{minX,minY,maxX,maxY,width:Math.max(maxX-minX,1e-9),height:Math.max(maxY-minY,1e-9)}:null;
}
function entitySamples(e){
  if(e.type==='LINE')return[e.p1,e.p2];if(e.type==='POLYLINE')return polylineSamples(e);if(e.type==='CIRCLE'){const a=[];for(let i=0;i<48;i++){const t=i/48*Math.PI*2;a.push({x:e.center.x+e.radius*Math.cos(t),y:e.center.y+e.radius*Math.sin(t)});}return a;}
  if(e.type==='ARC'){const a=[],span=positiveSpan(e.start,e.end);for(let i=0;i<=32;i++){const t=e.start+span*i/32;a.push({x:e.center.x+e.radius*Math.cos(t),y:e.center.y+e.radius*Math.sin(t)});}return a;}
  if(e.type==='POINT'||e.type==='TEXT')return[e.point];return[];
}
function polylineSamples(e){const out=[];const pts=e.points||[];for(let i=0;i<pts.length;i++){out.push({x:pts[i].x,y:pts[i].y});const last=i===pts.length-1;if(last&&!e.closed)break;const next=pts[(i+1)%pts.length];if(Math.abs(pts[i].bulge||0)>1e-10){const arc=bulgeArc(pts[i],next,pts[i].bulge);if(arc)for(let j=1;j<arc.samples.length;j++)out.push(arc.samples[j]);}}return out;}
function bulgeArc(a,b,bulge){
  const theta=4*Math.atan(Math.abs(bulge)),c=Math.hypot(b.x-a.x,b.y-a.y);if(c<1e-12||theta<1e-12)return null;const r=(c/2)/Math.sin(theta/2),gamma=(Math.PI-theta)/2,base=Math.atan2(b.y-a.y,b.x-a.x),phi=base+Math.sign(bulge)*gamma,center={x:a.x+r*Math.cos(phi),y:a.y+r*Math.sin(phi)};
  let start=Math.atan2(a.y-center.y,a.x-center.x),span=Math.sign(bulge)*theta;const n=Math.max(8,Math.ceil(theta/(Math.PI/24))),samples=[];for(let i=0;i<=n;i++){const t=start+span*i/n;samples.push({x:center.x+r*Math.cos(t),y:center.y+r*Math.sin(t)});}return{center,r,start,span,samples};
}
function positiveSpan(a,b){let s=b-a;while(s<0)s+=Math.PI*2;while(s>Math.PI*2)s-=Math.PI*2;return s;}

function resize(){const r=E.canvas.getBoundingClientRect(),d=DPR();E.canvas.width=Math.max(1,Math.round(r.width*d));E.canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);}
function frame(){draw();requestAnimationFrame(frame);}
function draw(){
  const r=E.canvas.getBoundingClientRect();ctx.save();ctx.setTransform(DPR(),0,0,DPR(),0,0);ctx.fillStyle='#0b1016';ctx.fillRect(0,0,r.width,r.height);if(state.grid&&state.file)drawGrid(r.width,r.height);if(state.file)drawEntities();drawMeasure();ctx.restore();
}
function worldToScreen(q){const r=E.canvas.getBoundingClientRect();return{x:(q.x-state.view.cx)*state.view.scale+r.width/2,y:(state.view.cy-q.y)*state.view.scale+r.height/2};}
function screenToWorld(x,y){const r=E.canvas.getBoundingClientRect();return{x:(x-r.left-r.width/2)/state.view.scale+state.view.cx,y:state.view.cy-(y-r.top-r.height/2)/state.view.scale};}
function drawGrid(w,h){
  const target=55/state.view.scale,pow=Math.pow(10,Math.floor(Math.log10(Math.max(target,1e-12)))),f=target/pow,step=(f<2?1:f<5?2:5)*pow;
  const tl=screenToWorld(E.canvas.getBoundingClientRect().left,E.canvas.getBoundingClientRect().top),br=screenToWorld(E.canvas.getBoundingClientRect().right,E.canvas.getBoundingClientRect().bottom);
  ctx.lineWidth=1;ctx.strokeStyle='rgba(130,150,160,.085)';ctx.beginPath();for(let x=Math.floor(tl.x/step)*step;x<=br.x;x+=step){const s=worldToScreen({x,y:0});ctx.moveTo(Math.round(s.x)+.5,0);ctx.lineTo(Math.round(s.x)+.5,h);}for(let y=Math.floor(br.y/step)*step;y<=tl.y;y+=step){const s=worldToScreen({x:0,y});ctx.moveTo(0,Math.round(s.y)+.5);ctx.lineTo(w,Math.round(s.y)+.5);}ctx.stroke();
  const o=worldToScreen({x:0,y:0});ctx.strokeStyle='rgba(53,211,154,.18)';ctx.beginPath();ctx.moveTo(o.x,0);ctx.lineTo(o.x,h);ctx.moveTo(0,o.y);ctx.lineTo(w,o.y);ctx.stroke();
}
function drawEntities(){for(const e of state.entities){if(!layerVisible(e.layer))continue;const selected=state.selected.has(e.id),hover=state.hover===e.id;drawEntity(e,selected?'#006dff':hover?'#35d39a':e.color,selected?2.2:hover?1.8:1.15);}}
function drawEntity(e,color,width){
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  if(e.type==='LINE'){const a=worldToScreen(e.p1),b=worldToScreen(e.p2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();return;}
  if(e.type==='POLYLINE'){const pts=e.points||[];if(!pts.length)return;ctx.beginPath();let s=worldToScreen(pts[0]);ctx.moveTo(s.x,s.y);for(let i=0;i<pts.length-1+(e.closed?1:0);i++){const a=pts[i%pts.length],b=pts[(i+1)%pts.length],bulge=a.bulge||0;if(Math.abs(bulge)<1e-10){s=worldToScreen(b);ctx.lineTo(s.x,s.y);}else{const arc=bulgeArc(a,b,bulge);for(const q of arc?.samples?.slice(1)||[]){s=worldToScreen(q);ctx.lineTo(s.x,s.y);}}}ctx.stroke();return;}
  if(e.type==='CIRCLE'){const c=worldToScreen(e.center);ctx.beginPath();ctx.arc(c.x,c.y,e.radius*state.view.scale,0,Math.PI*2);ctx.stroke();return;}
  if(e.type==='ARC'){const c=worldToScreen(e.center);ctx.save();ctx.translate(c.x,c.y);ctx.scale(1,-1);ctx.beginPath();ctx.arc(0,0,e.radius*state.view.scale,e.start,e.start+positiveSpan(e.start,e.end));ctx.stroke();ctx.restore();return;}
  if(e.type==='POINT'){const s=worldToScreen(e.point);ctx.beginPath();ctx.arc(s.x,s.y,3.2,0,Math.PI*2);ctx.fill();return;}
  if(e.type==='TEXT'){const s=worldToScreen(e.point);ctx.save();ctx.translate(s.x,s.y);ctx.rotate(-e.rotation*Math.PI/180);ctx.font=`${Math.max(8,e.height*state.view.scale)}px ui-monospace,monospace`;ctx.fillText(e.text,0,0);ctx.restore();}
}
function drawMeasure(){
  if(!state.measure.length)return;const pts=[...state.measure];if(pts.length===1&&state.tool==='measure')pts.push(currentSnap()||screenToWorld(state.pointer.x,state.pointer.y));if(pts.length<2)return;const a=worldToScreen(pts[0]),b=worldToScreen(pts[1]);ctx.strokeStyle='#35d39a';ctx.fillStyle='#35d39a';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);for(const q of[a,b]){ctx.beginPath();ctx.arc(q.x,q.y,3.5,0,Math.PI*2);ctx.fill();}
}

function pointerDown(ev){
  if(!state.file)return;state.pointer={x:ev.clientX,y:ev.clientY};
  if(ev.button===1||ev.button===2){ev.preventDefault();state.drag={mode:'pan',id:ev.pointerId,lastX:ev.clientX,lastY:ev.clientY,moved:false};try{E.canvas.setPointerCapture(ev.pointerId)}catch{};return;}
  if(ev.button!==0)return;state.drag={mode:'left',id:ev.pointerId,startX:ev.clientX,startY:ev.clientY,moved:false};try{E.canvas.setPointerCapture(ev.pointerId)}catch{};
}
function pointerMove(ev){state.pointer={x:ev.clientX,y:ev.clientY};if(state.drag?.id===ev.pointerId){const dx=ev.clientX-(state.drag.lastX??ev.clientX),dy=ev.clientY-(state.drag.lastY??ev.clientY);if(Math.hypot(ev.clientX-(state.drag.startX??ev.clientX),ev.clientY-(state.drag.startY??ev.clientY))>3)state.drag.moved=true;if(state.drag.mode==='pan'){state.view.cx-=dx/state.view.scale;state.view.cy+=dy/state.view.scale;state.drag.lastX=ev.clientX;state.drag.lastY=ev.clientY;return;}}if(state.tool==='select'&&!state.drag?.moved){const hit=hitTest(ev.clientX,ev.clientY);state.hover=hit?.id||null;}}
function pointerUp(ev){
  if(!state.drag||state.drag.id!==ev.pointerId)return;const d=state.drag;state.drag=null;try{E.canvas.releasePointerCapture(ev.pointerId)}catch{};if(d.mode==='pan'||d.moved)return;if(ev.button!==0)return;
  const raw=screenToWorld(ev.clientX,ev.clientY),snap=state.snap?(nearestSnap(ev.clientX,ev.clientY)?.point||raw):raw;
  if(state.tool==='select'){const hit=hitTest(ev.clientX,ev.clientY);if(hit){if(ev.ctrlKey||ev.metaKey){state.selected.has(hit.id)?state.selected.delete(hit.id):state.selected.add(hit.id);}else{state.selected.clear();state.selected.add(hit.id);}}else if(!ev.ctrlKey&&!ev.metaKey)state.selected.clear();syncSelectionUI();return;}
  if(state.tool==='measure'){if(state.measure.length>=2)state.measure=[];state.measure.push(snap);E.measureCard.hidden=false;if(state.measure.length===1)E.measureHelp.textContent=T.secondPoint;else updateMeasureCard();return;}
  if(state.tool==='move'){if(!state.selected.size)return toast(T.chooseSelection);if(!state.moveBase){state.moveBase=snap;toast(T.moveTarget);return;}const dx=snap.x-state.moveBase.x,dy=snap.y-state.moveBase.y;pushHistory();translateSelected(dx,dy);state.moveBase=null;setTool('select');toast(T.moved);}
}
function wheel(ev){if(!state.file)return;ev.preventDefault();const before=screenToWorld(ev.clientX,ev.clientY),factor=Math.exp(-Math.sign(ev.deltaY)*Math.min(0.22,Math.abs(ev.deltaY)*0.0018));state.view.scale=clamp(state.view.scale*factor,1e-6,1e7);const after=screenToWorld(ev.clientX,ev.clientY);state.view.cx+=before.x-after.x;state.view.cy+=before.y-after.y;}

function hitTest(clientX,clientY){const w=screenToWorld(clientX,clientY),tol=8/state.view.scale;let best=null,bestD=tol;for(let i=state.entities.length-1;i>=0;i--){const e=state.entities[i];if(!layerVisible(e.layer))continue;const d=distanceToEntity(w,e);if(d<=bestD){best=e;bestD=d;}}return best;}
function distanceToEntity(q,e){
  if(e.type==='LINE')return pointSegmentDistance(q,e.p1,e.p2);if(e.type==='POLYLINE'){const s=polylineSamples(e);let d=Infinity;for(let i=0;i<s.length-1;i++)d=Math.min(d,pointSegmentDistance(q,s[i],s[i+1]));return d;}
  if(e.type==='CIRCLE')return Math.abs(Math.hypot(q.x-e.center.x,q.y-e.center.y)-e.radius);if(e.type==='ARC'){const a=Math.atan2(q.y-e.center.y,q.x-e.center.x);if(angleWithin(a,e.start,e.end))return Math.abs(Math.hypot(q.x-e.center.x,q.y-e.center.y)-e.radius);const p1={x:e.center.x+e.radius*Math.cos(e.start),y:e.center.y+e.radius*Math.sin(e.start)},p2={x:e.center.x+e.radius*Math.cos(e.end),y:e.center.y+e.radius*Math.sin(e.end)};return Math.min(dist(q,p1),dist(q,p2));}
  if(e.type==='POINT'||e.type==='TEXT')return dist(q,e.point);return Infinity;
}
function pointSegmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,l=vx*vx+vy*vy;if(l<1e-20)return dist(p,a);const t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/l,0,1);return Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy));}
function angleWithin(a,start,end){let span=positiveSpan(start,end),x=a-start;while(x<0)x+=Math.PI*2;while(x>=Math.PI*2)x-=Math.PI*2;return x<=span+1e-9;}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

function nearestSnap(clientX,clientY){if(!state.snap)return null;const q=screenToWorld(clientX,clientY),tol=12/state.view.scale;let best=null,bestD=tol;for(const e of state.entities){if(!layerVisible(e.layer))continue;for(const s of entitySnapPoints(e)){const d=dist(q,s.point);if(d<bestD){bestD=d;best=s;}}}return best;}
function currentSnap(){return nearestSnap(state.pointer.x,state.pointer.y)?.point||null;}
function entitySnapPoints(e){
  if(e.type==='LINE')return[{point:e.p1,type:'end'},{point:e.p2,type:'end'},{point:{x:(e.p1.x+e.p2.x)/2,y:(e.p1.y+e.p2.y)/2},type:'mid'}];
  if(e.type==='POLYLINE'){const a=[];for(const v of e.points)a.push({point:{x:v.x,y:v.y},type:'end'});return a;}
  if(e.type==='CIRCLE')return[{point:e.center,type:'center'}];if(e.type==='ARC')return[{point:e.center,type:'center'},{point:{x:e.center.x+e.radius*Math.cos(e.start),y:e.center.y+e.radius*Math.sin(e.start)},type:'end'},{point:{x:e.center.x+e.radius*Math.cos(e.end),y:e.center.y+e.radius*Math.sin(e.end)},type:'end'}];
  if(e.type==='POINT'||e.type==='TEXT')return[{point:e.point,type:'point'}];return[];
}

function setTool(tool){state.tool=tool;state.hover=null;state.moveBase=null;if(tool!=='measure')clearMeasure();for(const [el,name] of [[E.select,'select'],[E.measure,'measure'],[E.move,'move']])el.classList.toggle('active',tool===name);E.workspace.classList.remove('tool-select','tool-measure','tool-move','tool-pan');E.workspace.classList.add(`tool-${tool}`);if(tool==='measure'){E.measureCard.hidden=false;E.measureHelp.textContent=T.firstPoint;}}
function clearMeasure(){state.measure=[];E.measureCard.hidden=true;E.measureMain.textContent='—';E.measureDx.textContent='—';E.measureDy.textContent='—';E.measureHelp.textContent=T.firstPoint;}
function updateMeasureCard(){if(state.measure.length<2)return;const[a,b]=state.measure,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);E.measureMain.textContent=formatLength(d);E.measureDx.textContent=formatLength(dx);E.measureDy.textContent=formatLength(dy);E.measureHelp.textContent=`(${fmt(a.x)}, ${fmt(a.y)}) → (${fmt(b.x)}, ${fmt(b.y)})`;}
function formatLength(v){return`${fmt(v)} ${state.unitLabel}`;}
function fmt(v){return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{maximumFractionDigits:4}).format(v);}

function fitView(){recomputeBounds();if(!state.bounds)return;const r=E.canvas.getBoundingClientRect(),pad=90,scale=Math.min((r.width-pad*2)/state.bounds.width,(r.height-pad*2)/state.bounds.height);state.view.scale=clamp(scale,1e-6,1e7);state.view.cx=(state.bounds.minX+state.bounds.maxX)/2;state.view.cy=(state.bounds.minY+state.bounds.maxY)/2;}
function layerVisible(name){return state.layers.get(name)?.visible!==false;}
function setAllLayers(value){for(const l of state.layers.values())l.visible=value;renderLayerList();recomputeBounds();}
function assignSelectedLayer(name){
  if(!state.selected.size)return toast(T.chooseSelection);
  pushHistory();
  for(const e of state.entities)if(state.selected.has(e.id))e.layer=name;
  rebuildLayers();renderLayerList();recomputeBounds();syncUI();toast(`Layer → ${name}`);
}
function renderLayerList(){E.layerList.innerHTML='';for(const layer of [...state.layers.values()].sort((a,b)=>a.name.localeCompare(b.name))){const row=document.createElement('label');row.className='n2-layer-row';const cb=document.createElement('input');cb.type='checkbox';cb.checked=layer.visible;cb.addEventListener('change',()=>{layer.visible=cb.checked;recomputeBounds();});const sw=document.createElement('i');sw.className='n2-layer-swatch';sw.style.background=layer.color;const name=document.createElement('span');name.className='n2-layer-name';name.textContent=layer.name;const count=document.createElement('span');count.className='n2-layer-count';count.textContent=layer.count;row.append(cb,sw,name,count);E.layerList.append(row);}}

function pushHistory(){state.history.push(JSON.stringify(state.entities));if(state.history.length>30)state.history.shift();state.future=[];syncHistoryButtons();state.dirty=true;}
function undo(){if(!state.history.length)return;state.future.push(JSON.stringify(state.entities));state.entities=JSON.parse(state.history.pop());state.selected.clear();rebuildLayers();recomputeBounds();renderLayerList();syncUI();}
function redo(){if(!state.future.length)return;state.history.push(JSON.stringify(state.entities));state.entities=JSON.parse(state.future.pop());state.selected.clear();rebuildLayers();recomputeBounds();renderLayerList();syncUI();}
function deleteSelected(){if(!state.selected.size)return;pushHistory();state.entities=state.entities.filter(e=>!state.selected.has(e.id));state.selected.clear();rebuildLayers();recomputeBounds();renderLayerList();syncUI();toast(T.deleted);}
function translateSelected(dx,dy){for(const e of state.entities)if(state.selected.has(e.id))translateEntity(e,dx,dy);recomputeBounds();syncUI();}
function translateEntity(e,dx,dy){const mv=q=>{q.x+=dx;q.y+=dy;};if(e.type==='LINE'){mv(e.p1);mv(e.p2);}else if(e.type==='POLYLINE'){for(const q of e.points)mv(q);}else if(e.type==='CIRCLE'||e.type==='ARC')mv(e.center);else if(e.type==='POINT'||e.type==='TEXT')mv(e.point);}

function runAnalysis(){
  const open=state.entities.filter(e=>e.type==='POLYLINE'&&!e.closed).length,approx=state.entities.filter(e=>e.approx).length,duplicates=countDuplicates(),unsupported=state.unsupported.length;
  state.analysis={open,duplicates,unsupported,approx};renderAnalysis();toggleDrawer('properties',true);toast(T.analysisDone);
}
function countDuplicates(){const seen=new Set();let n=0;for(const e of state.entities){const k=duplicateKey(e);if(!k)continue;if(seen.has(k))n++;else seen.add(k);}return n;}
function duplicateKey(e){const r=n=>Math.round(n*1e6)/1e6,pt=q=>`${r(q.x)},${r(q.y)}`;if(e.type==='LINE'){const a=pt(e.p1),b=pt(e.p2);return`L:${[a,b].sort().join('|')}:${e.layer}`;}if(e.type==='CIRCLE')return`C:${pt(e.center)}:${r(e.radius)}:${e.layer}`;if(e.type==='ARC')return`A:${pt(e.center)}:${r(e.radius)}:${r(e.start)}:${r(e.end)}:${e.layer}`;if(e.type==='POLYLINE')return`P:${e.points.map(pt).join(';')}:${e.closed}:${e.layer}`;return null;}
function renderAnalysis(){const a=state.analysis;if(!a){E.analysisInfo.innerHTML=`<span>${FR?'Analyse non exécutée.':'Analysis not run.'}</span>`;return;}const rows=[[T.openContours,a.open,a.open?'warn':'ok'],[T.duplicates,a.duplicates,a.duplicates?'warn':'ok'],[T.unsupported,a.unsupported,a.unsupported?'bad':'ok'],[T.approx,a.approx,a.approx?'warn':'ok']];E.analysisInfo.innerHTML=rows.map(([k,v,c])=>`<div class="${c}"><b>${escapeHtml(k)}</b> · ${v}</div>`).join('')+(rows.every(r=>r[1]===0)?`<div class="ok">${T.clean}</div>`:'');}

function renderProperties(){
  E.propFile.textContent=state.file?.name||'—';E.propUnits.textContent=state.unitLabel==='u'?T.unitless:state.unitLabel;E.propEntities.textContent=state.entities.length||'—';E.propLayers.textContent=state.layers.size||'—';
  recomputeBounds();E.propSize.textContent=state.bounds?`${fmt(state.bounds.width)} × ${fmt(state.bounds.height)} ${state.unitLabel}`:'—';syncSelectionUI();renderAnalysis();
}
function syncSelectionUI(){
  E.del.disabled=!state.selected.size;E.move.disabled=!state.selected.size;const sel=state.entities.filter(e=>state.selected.has(e.id));if(!sel.length)E.selectionInfo.textContent=T.noSelection;else if(sel.length===1){const e=sel[0];let s=`${e.rawType||e.type}\nLayer: ${e.layer}`;if(e.type==='LINE')s+=`\nLength: ${formatLength(dist(e.p1,e.p2))}`;if(e.type==='CIRCLE')s+=`\nØ ${formatLength(e.radius*2)}`;if(e.type==='ARC')s+=`\nR ${formatLength(e.radius)}`;if(e.approx)s+=`\n≈ ${FR?'géométrie approximée':'approximated geometry'}`;E.selectionInfo.textContent=s;}else E.selectionInfo.textContent=`${sel.length} ${T.selected}`;}
function syncHistoryButtons(){E.undo.disabled=!state.history.length;E.redo.disabled=!state.future.length;}
function syncUI(){const has=Boolean(state.file);for(const b of[E.select,E.measure,E.fit,E.grid,E.snap,E.layers,E.analyze,E.props,E.export,E.close])b.disabled=!has;E.statusFile.textContent=state.file?.name||T.noDxf;E.statusEntities.textContent=has?`${state.entities.length} ${T.entities}`:'—';E.statusUnits.textContent=has?state.unitLabel:'—';E.empty.hidden=has;syncHistoryButtons();renderProperties();}
function clearFile(){state.file=null;state.dxf=null;state.entities=[];state.layers.clear();state.unsupported=[];state.selected.clear();state.history=[];state.future=[];state.analysis=null;state.bounds=null;clearMeasure();syncUI();E.layerDrawer.hidden=true;E.propDrawer.hidden=true;}
function toggleDrawer(which,force){const el=which==='layers'?E.layerDrawer:E.propDrawer,other=which==='layers'?E.propDrawer:E.layerDrawer;const show=force??el.hidden;el.hidden=!show;if(show)other.hidden=true;if(which==='properties'&&show)renderProperties();}

function exportDxf(){if(!state.file)return;const text=writeDxf();const name=(state.file.name.replace(/\.dxf$/i,'')||'navo2d')+'-Navo2D.dxf';downloadBlob(text,name,'application/dxf');toast(T.exported);}
function writeDxf(){
  const lines=[];const add=(c,v)=>{lines.push(String(c),String(v));};add(0,'SECTION');add(2,'HEADER');add(9,'$ACADVER');add(1,'AC1015');add(9,'$INSUNITS');add(70,state.unitCode||0);add(0,'ENDSEC');
  add(0,'SECTION');add(2,'TABLES');add(0,'TABLE');add(2,'LAYER');add(70,state.layers.size);for(const l of state.layers.values()){add(0,'LAYER');add(2,l.name);add(70,0);add(62,7);add(6,'CONTINUOUS');}add(0,'ENDTAB');add(0,'ENDSEC');
  add(0,'SECTION');add(2,'ENTITIES');for(const e of state.entities)writeEntity(add,e);add(0,'ENDSEC');add(0,'EOF');return lines.join('\r\n')+'\r\n';
}
function writeEntity(add,e){
  const common=()=>{add(8,e.layer||'0');};
  if(e.type==='LINE'){add(0,'LINE');common();add(10,e.p1.x);add(20,e.p1.y);add(30,0);add(11,e.p2.x);add(21,e.p2.y);add(31,0);return;}
  if(e.type==='CIRCLE'){add(0,'CIRCLE');common();add(10,e.center.x);add(20,e.center.y);add(30,0);add(40,e.radius);return;}
  if(e.type==='ARC'){add(0,'ARC');common();add(10,e.center.x);add(20,e.center.y);add(30,0);add(40,e.radius);add(50,radToDeg(e.start));add(51,radToDeg(e.end));return;}
  if(e.type==='POINT'){add(0,'POINT');common();add(10,e.point.x);add(20,e.point.y);add(30,0);return;}
  if(e.type==='TEXT'){add(0,'TEXT');common();add(10,e.point.x);add(20,e.point.y);add(30,0);add(40,e.height||2.5);add(1,e.text||'');add(50,e.rotation||0);return;}
  if(e.type==='POLYLINE'){add(0,'LWPOLYLINE');common();add(90,e.points.length);add(70,e.closed?1:0);for(const q of e.points){add(10,q.x);add(20,q.y);if(Math.abs(q.bulge||0)>1e-12)add(42,q.bulge);}return;}
}
function radToDeg(v){let d=v*180/Math.PI;while(d<0)d+=360;while(d>=360)d-=360;return d;}
function downloadBlob(text,name,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function toast(msg){clearTimeout(toastTimer);E.toast.textContent=msg;E.toast.hidden=false;toastTimer=setTimeout(()=>E.toast.hidden=true,2300);}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
