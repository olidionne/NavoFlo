import DxfParser from 'https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/+esm';
import AUTO_CAD_COLOR_INDEX from 'https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/AutoCadColorIndex.js';

const FR=document.documentElement.lang.toLowerCase().startsWith('fr');
const T=FR?{
  noDxf:'Aucun DXF', entities:'entités', units:'Unités', unitless:'sans unité', loadFail:'Impossible de lire ce DXF.',
  firstPoint:'Cliquez le premier point.', secondPoint:'Cliquez le deuxième point.', moveBase:'Cliquez le point de base.', moveTarget:'Cliquez le point cible.',
  selected:'sélectionnée(s)', noSelection:'Aucune sélection', deleted:'Entité(s) supprimée(s).', moved:'Entité(s) déplacée(s).', exported:'DXF exporté.',
  analysisDone:'Analyse terminée.', openContours:'Contours ouverts', duplicates:'Doublons potentiels', unsupported:'Entités non prises en charge', approx:'Entités approximées', layers:'Layers',
  clean:'Aucun problème évident détecté.', chooseSelection:'Sélectionnez au moins une entité.', parser:'Moteur DXF', normalized:'DXF normalisé', snap:'Snap',
  unused:'INUTILISÉ', frozen:'GELÉ', off:'OFF', window:'FENÊTRE', crossing:'CROSSING', selectAdded:'Sélection ajoutée', selectRemoved:'Sélection retirée',
}: {
  noDxf:'No DXF', entities:'entities', units:'Units', unitless:'unitless', loadFail:'Unable to read this DXF.',
  firstPoint:'Click the first point.', secondPoint:'Click the second point.', moveBase:'Click the base point.', moveTarget:'Click the target point.',
  selected:'selected', noSelection:'No selection', deleted:'Entity/entities deleted.', moved:'Entity/entities moved.', exported:'DXF exported.',
  analysisDone:'Analysis complete.', openContours:'Open contours', duplicates:'Potential duplicates', unsupported:'Unsupported entities', approx:'Approximated entities', layers:'Layers',
  clean:'No obvious issue detected.', chooseSelection:'Select at least one entity.', parser:'DXF engine', normalized:'Normalized DXF', snap:'Snap',
  unused:'UNUSED', frozen:'FROZEN', off:'OFF', window:'WINDOW', crossing:'CROSSING', selectAdded:'Selection added', selectRemoved:'Selection removed',
 };

const CMDT=FR?{
  command:'Commande:', ready:'Prêt', unknown:'Commande inconnue', notYet:'Commande reconnue mais pas encore implantée dans Navo2D.',
  specifyFirst:'Spécifiez le premier point', specifyNext:'Spécifiez le point suivant', specifyCenter:'Spécifiez le centre du cercle',
  specifyRadius:'Spécifiez le rayon ou [Diamètre]', specifySecond:'Spécifiez le deuxième point', specifyThird:'Spécifiez le troisième point',
  specifyCorner:'Spécifiez le coin opposé', selectObjects:'Sélectionnez les objets puis Entrée', basePoint:'Spécifiez le point de base',
  secondPoint:'Spécifiez le deuxième point', rotationAngle:'Spécifiez l’angle de rotation', scaleFactor:'Spécifiez le facteur d’échelle',
  mirrorFirst:'Spécifiez le premier point de la ligne miroir', mirrorSecond:'Spécifiez le deuxième point de la ligne miroir',
  eraseSource:'Effacer les objets source ? [Oui/Non] <Non>', offsetDistance:'Spécifiez la distance de décalage',
  offsetObject:'Sélectionnez l’objet à décaler', offsetSide:'Spécifiez le côté du décalage', distanceFirst:'Spécifiez le premier point',
  distanceSecond:'Spécifiez le deuxième point', idPoint:'Spécifiez un point', canceled:'*Annuler*', complete:'Commande terminée',
  close:'Fermer', undo:'Annuler', diameter:'Diamètre', yes:'Oui', no:'Non', unsupportedSelection:'Type d’objet non pris en charge pour cette commande.',
  orthoOn:'ORTHO activé', orthoOff:'ORTHO désactivé', polarOn:'POLAR activé', polarOff:'POLAR désactivé',
  osnapOn:'OSNAP activé', osnapOff:'OSNAP désactivé', gridSnapOn:'SNAP grille activé', gridSnapOff:'SNAP grille désactivé',
  otrackOn:'OTRACK activé', otrackOff:'OTRACK désactivé', dynOn:'DYN activé', dynOff:'DYN désactivé',
  copied:'Objet(s) copié(s)', rotated:'Objet(s) tourné(s)', scaled:'Objet(s) mis à l’échelle', mirrored:'Objet(s) miroir créés',
  offsetDone:'Décalage créé', exploded:'Objet(s) explosé(s)', joined:'Objets joints', pointInvalid:'Entrée de point invalide', valueInvalid:'Valeur invalide',
}: {
  command:'Command:', ready:'Ready', unknown:'Unknown command', notYet:'Command recognized but not implemented in Navo2D yet.',
  specifyFirst:'Specify first point', specifyNext:'Specify next point', specifyCenter:'Specify center point for circle',
  specifyRadius:'Specify radius or [Diameter]', specifySecond:'Specify second point', specifyThird:'Specify third point',
  specifyCorner:'Specify opposite corner', selectObjects:'Select objects then press Enter', basePoint:'Specify base point',
  secondPoint:'Specify second point', rotationAngle:'Specify rotation angle', scaleFactor:'Specify scale factor',
  mirrorFirst:'Specify first point of mirror line', mirrorSecond:'Specify second point of mirror line',
  eraseSource:'Erase source objects? [Yes/No] <No>', offsetDistance:'Specify offset distance',
  offsetObject:'Select object to offset', offsetSide:'Specify side to offset', distanceFirst:'Specify first point',
  distanceSecond:'Specify second point', idPoint:'Specify point', canceled:'*Cancel*', complete:'Command complete',
  close:'Close', undo:'Undo', diameter:'Diameter', yes:'Yes', no:'No', unsupportedSelection:'Object type is not supported for this command.',
  orthoOn:'ORTHO on', orthoOff:'ORTHO off', polarOn:'POLAR on', polarOff:'POLAR off',
  osnapOn:'OSNAP on', osnapOff:'OSNAP off', gridSnapOn:'Grid SNAP on', gridSnapOff:'Grid SNAP off',
  otrackOn:'OTRACK on', otrackOff:'OTRACK off', dynOn:'DYN on', dynOff:'DYN off',
  copied:'Object(s) copied', rotated:'Object(s) rotated', scaled:'Object(s) scaled', mirrored:'Mirrored object(s) created',
  offsetDone:'Offset created', exploded:'Object(s) exploded', joined:'Objects joined', pointInvalid:'Invalid point input', valueInvalid:'Invalid value',
};

const $=id=>document.getElementById(id);
const E={
  workspace:$('n2-workspace'),canvas:$('n2-canvas'),file:$('n2-file'),empty:$('n2-empty'),fullscreen:$('n2-fullscreen'),
  select:$('n2-select'),measure:$('n2-measure'),move:$('n2-move'),del:$('n2-delete'),undo:$('n2-undo'),redo:$('n2-redo'),fit:$('n2-fit'),grid:$('n2-grid'),snap:$('n2-snap'),layers:$('n2-layers'),analyze:$('n2-analyze'),props:$('n2-properties'),export:$('n2-export'),close:$('n2-close'),
  layerDrawer:$('n2-layer-drawer'),propDrawer:$('n2-prop-drawer'),layerList:$('n2-layer-list'),layersAll:$('n2-layers-all'),layersNone:$('n2-layers-none'),
  propFile:$('n2-prop-file'),propUnits:$('n2-prop-units'),propEntities:$('n2-prop-entities'),propLayers:$('n2-prop-layers'),propSize:$('n2-prop-size'),selectionInfo:$('n2-selection-info'),analysisInfo:$('n2-analysis-info'),
  measureCard:$('n2-measure-card'),measureMain:$('n2-measure-main'),measureDx:$('n2-measure-dx'),measureDy:$('n2-measure-dy'),measureHelp:$('n2-measure-help'),measureClear:$('n2-measure-clear'),
  toast:$('n2-toast'),statusFile:$('n2-status-file'),statusEntities:$('n2-status-entities'),statusUnits:$('n2-status-units'),currentLayer:$('n2-current-layer'),
  commandHistory:$('n2-command-history'),commandPrompt:$('n2-command-prompt'),commandInput:$('n2-command-input'),
  osnapPanel:$('n2-osnap-panel'),osnapClose:$('n2-osnap-close'),
  statusGrid:$('n2-status-grid'),statusGridSnap:$('n2-status-gridsnap'),statusOrtho:$('n2-status-ortho'),statusPolar:$('n2-status-polar'),
  statusOsnap:$('n2-status-osnap'),statusOtrack:$('n2-status-otrack'),statusDyn:$('n2-status-dyn'),polarAngle:$('n2-polar-angle')
};

const ctx=E.canvas.getContext('2d',{alpha:false});
const DPR=()=>Math.min(window.devicePixelRatio||1,2);
const state={
  file:null,dxf:null,rawText:'',entities:[],layers:new Map(),layerDefinitions:new Map(),unsupported:[],selected:new Set(),hover:null,
  tool:'select',grid:true,snap:true,unitCode:0,unitLabel:'u',bounds:null,
  view:{scale:1,cx:0,cy:0},drag:null,selectionBox:null,pointer:{x:0,y:0},measure:[],moveBase:null,
  history:[],future:[],analysis:null,dirty:false,
  command:null,lastCommand:'',commandLog:[],entitySeq:0,activeLayer:'0',
  ortho:false,polar:true,polarIncrement:45,gridSnap:false,gridSnapStep:1,otrack:true,dyn:true,
  osnapModes:new Set(['end','mid','center','quad','intersection','node']),snapOverride:null,
  trackingPoint:null,trackingSince:0,lastSnap:null,snapCycle:0,snapCandidateKey:''
};

const UNIT_LABELS={0:'u',1:'in',2:'ft',3:'mi',4:'mm',5:'cm',6:'m',7:'km',8:'µin',9:'mil',10:'yd',11:'Å',12:'nm',13:'µm',14:'dm'};
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
  E.move.addEventListener('click',()=>startCommand('MOVE'));
  E.del.addEventListener('click',()=>startCommand('ERASE'));
  E.undo.addEventListener('click',undo);
  E.redo.addEventListener('click',redo);
  E.fit.addEventListener('click',fitView);
  E.grid.addEventListener('click',()=>toggleDraftSetting('grid'));
  E.snap.addEventListener('click',()=>toggleDraftSetting('osnap'));
  E.layers.addEventListener('click',()=>toggleDrawer('layers'));
  E.props.addEventListener('click',()=>toggleDrawer('properties'));
  E.analyze.addEventListener('click',runAnalysis);
  E.export.addEventListener('click',exportDxf);
  E.close.addEventListener('click',clearFile);
  E.fullscreen?.addEventListener('click',toggleFullscreen);
  document.addEventListener('fullscreenchange',()=>setTimeout(resize,30));
  E.layersAll.addEventListener('click',()=>setAllLayers(true));
  E.layersNone.addEventListener('click',()=>setAllLayers(false));
  E.measureClear.addEventListener('click',()=>clearMeasure());
  document.querySelectorAll('[data-close-drawer]').forEach(b=>b.addEventListener('click',()=>toggleDrawer(b.dataset.closeDrawer,false)));
  document.querySelectorAll('[data-assign-layer]').forEach(b=>b.addEventListener('click',()=>assignSelectedLayer(b.dataset.assignLayer)));

  document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>startCommand(b.dataset.command)));
  E.commandInput.addEventListener('keydown',handleCommandInputKeyDown);
  E.commandInput.addEventListener('input',()=>{E.commandInput.value=E.commandInput.value;});
  E.osnapClose?.addEventListener('click',()=>E.osnapPanel.hidden=true);
  document.querySelectorAll('[data-osnap]').forEach(cb=>{
    cb.checked=state.osnapModes.has(cb.dataset.osnap);
    cb.addEventListener('change',()=>{
      if(cb.checked)state.osnapModes.add(cb.dataset.osnap);else state.osnapModes.delete(cb.dataset.osnap);
    });
  });
  E.snap.addEventListener('contextmenu',event=>{event.preventDefault();E.osnapPanel.hidden=!E.osnapPanel.hidden;});
  E.statusOsnap?.addEventListener('contextmenu',event=>{event.preventDefault();E.osnapPanel.hidden=!E.osnapPanel.hidden;});
  E.statusGrid?.addEventListener('click',()=>toggleDraftSetting('grid'));
  E.statusGridSnap?.addEventListener('click',()=>toggleDraftSetting('gridSnap'));
  E.statusOrtho?.addEventListener('click',()=>toggleDraftSetting('ortho'));
  E.statusPolar?.addEventListener('click',()=>toggleDraftSetting('polar'));
  E.statusOsnap?.addEventListener('click',()=>toggleDraftSetting('osnap'));
  E.statusOtrack?.addEventListener('click',()=>toggleDraftSetting('otrack'));
  E.statusDyn?.addEventListener('click',()=>toggleDraftSetting('dyn'));
  E.polarAngle?.addEventListener('change',()=>{state.polarIncrement=Math.max(0.1,Number(E.polarAngle.value)||45);syncDraftingUI();});

  E.canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(e.shiftKey)return openOsnapQuickMenu(e.clientX,e.clientY);if(state.file||state.command)openContextMenu(e.clientX,e.clientY);});
  E.canvas.addEventListener('pointerdown',pointerDown);
  E.canvas.addEventListener('pointermove',pointerMove);
  E.canvas.addEventListener('pointerup',pointerUp);
  E.canvas.addEventListener('pointercancel',pointerUp);
  E.canvas.addEventListener('wheel',wheel,{passive:false});

  addEventListener('keydown',handleGlobalKeyDown);
  syncDraftingUI();
  updateCommandPrompt();
}

async function loadDxf(file){
  try{
    const text=await file.text();
    const parser=new DxfParser();
    const dxf=parser.parseSync(text);
    state.file=file;state.dxf=dxf;state.rawText=text;state.unsupported=[];state.selected.clear();state.history=[];state.future=[];state.analysis=null;state.dirty=false;state.selectionBox=null;
    state.unitCode=Number(dxf?.header?.$INSUNITS??0)||0;state.unitLabel=UNIT_LABELS[state.unitCode]||'u';
    state.layerDefinitions=buildLayerDefinitions(dxf,text);
    state.entities=normalizeDxf(dxf);
    state.entitySeq=state.entities.length;state.activeLayer=state.layerDefinitions.has('0')?'0':(state.layerDefinitions.keys().next().value||'0');
    cancelCommand(false);
    rebuildLayers();recomputeBounds();fitView();syncUI();renderLayerList();renderProperties();syncDraftingUI();
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
  const base={id:`e${id}`,type,layer,...entityColorInfo(raw),rawType:type,approx:false};
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
function entityColorInfo(raw){
  const idx=Number.isFinite(raw?.colorIndex)?Number(raw.colorIndex):256;
  const packed=Number.isFinite(raw?.color)?Number(raw.color):null;
  const aciPacked=idx>=1&&idx<=255?AUTO_CAD_COLOR_INDEX[idx]:null;
  const trueColor=packed!==null&&(idx<1||idx>255||packed!==aciPacked)?packed:null;
  if(trueColor!==null)return{colorMode:'true',colorIndex:idx,trueColor};
  if(idx>=1&&idx<=255)return{colorMode:'aci',colorIndex:idx,trueColor:null};
  if(idx===0)return{colorMode:'byblock',colorIndex:0,trueColor:null};
  return{colorMode:'bylayer',colorIndex:256,trueColor:null};
}
function packedColorToHex(value){
  const n=Math.max(0,Math.min(0xffffff,Number(value)||0));
  return`#${n.toString(16).padStart(6,'0')}`;
}
function aciColorToHex(index){
  const i=Math.abs(Number(index)||7);
  const packed=AUTO_CAD_COLOR_INDEX[i]??AUTO_CAD_COLOR_INDEX[7]??0xffffff;
  return packedColorToHex(packed);
}
function resolvedEntityColor(entity){
  if(entity.colorMode==='true'&&Number.isFinite(entity.trueColor))return packedColorToHex(entity.trueColor);
  if(entity.colorMode==='aci'&&entity.colorIndex>=1&&entity.colorIndex<=255)return aciColorToHex(entity.colorIndex);
  if(entity.colorMode==='byblock')return aciColorToHex(7);
  return state.layers.get(entity.layer)?.color||aciColorToHex(7);
}

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

function buildLayerDefinitions(dxf,text){
  const defs=parseRawLayerTable(text);
  const parsed=dxf?.tables?.layer?.layers||{};
  for(const [name,layer] of Object.entries(parsed)){
    if(defs.has(name))continue;
    const colorIndex=Math.abs(Number(layer?.colorIndex)||7);
    defs.set(name,{
      name,
      colorIndex,
      trueColor:null,
      color:packedColorToHex(Number(layer?.color)||AUTO_CAD_COLOR_INDEX[colorIndex]||0xffffff),
      visible:layer?.visible!==false&&!layer?.frozen,
      frozen:Boolean(layer?.frozen),
      flags:layer?.frozen?1:0,
      linetype:'CONTINUOUS',
      lineweight:null,
      plot:true
    });
  }
  if(!defs.has('0'))defs.set('0',{name:'0',colorIndex:7,trueColor:null,color:aciColorToHex(7),visible:true,frozen:false,flags:0,linetype:'CONTINUOUS',lineweight:null,plot:true});
  return defs;
}

function parseRawLayerTable(text){
  const lines=String(text||'').split(/\r\n|\r|\n/);
  const pairs=[];
  for(let i=0;i+1<lines.length;i+=2){
    const code=Number(String(lines[i]).trim());
    if(!Number.isFinite(code))continue;
    pairs.push({code,value:String(lines[i+1]??'').trim()});
  }
  const defs=new Map();
  let inLayerTable=false,current=null;
  const commit=()=>{
    if(!current?.name)return;
    const rawAci=Number.isFinite(current.rawColorIndex)?current.rawColorIndex:7;
    const colorIndex=Math.max(1,Math.min(255,Math.abs(rawAci)||7));
    const flags=Number(current.flags)||0;
    const frozen=Boolean(flags&1||flags&2);
    const visible=rawAci>=0&&!frozen;
    const trueColor=Number.isFinite(current.trueColor)?current.trueColor:null;
    defs.set(current.name,{
      name:current.name,
      colorIndex,
      trueColor,
      color:trueColor!==null?packedColorToHex(trueColor):aciColorToHex(colorIndex),
      visible,
      frozen,
      flags,
      linetype:current.linetype||'CONTINUOUS',
      lineweight:Number.isFinite(current.lineweight)?current.lineweight:null,
      plot:current.plot!==false
    });
  };
  for(let i=0;i<pairs.length;i++){
    const g=pairs[i];
    if(!inLayerTable&&g.code===0&&g.value.toUpperCase()==='TABLE'&&pairs[i+1]?.code===2&&pairs[i+1]?.value.toUpperCase()==='LAYER'){
      inLayerTable=true;i++;continue;
    }
    if(!inLayerTable)continue;
    if(g.code===0&&g.value.toUpperCase()==='ENDTAB'){commit();break;}
    if(g.code===0&&g.value.toUpperCase()==='LAYER'){commit();current={};continue;}
    if(!current)continue;
    if(g.code===2)current.name=g.value;
    else if(g.code===70)current.flags=Number(g.value)||0;
    else if(g.code===62)current.rawColorIndex=Number(g.value);
    else if(g.code===6)current.linetype=g.value||'CONTINUOUS';
    else if(g.code===290)current.plot=Number(g.value)!==0;
    else if(g.code===370)current.lineweight=Number(g.value);
    else if(g.code===420)current.trueColor=Number(g.value);
  }
  return defs;
}

function ensureLayerDefinition(name){
  if(state.layerDefinitions.has(name))return state.layerDefinitions.get(name);
  const defaults={
    CUT:{colorIndex:1},
    PLIS_UP:{colorIndex:3},
    PLIS_DOWN:{colorIndex:4}
  }[name]||{colorIndex:7};
  const def={name,colorIndex:defaults.colorIndex,trueColor:null,color:aciColorToHex(defaults.colorIndex),visible:true,frozen:false,flags:0,linetype:'CONTINUOUS',lineweight:null,plot:true};
  state.layerDefinitions.set(name,def);
  return def;
}

function rebuildLayers(){
  const previous=state.layers;
  const next=new Map();
  for(const [name,source] of state.layerDefinitions){
    const old=previous.get(name);
    const layer={
      ...source,
      visible:old?.visible??source.visible,
      frozen:old?.frozen??source.frozen,
      trueColor:old?.trueColor??source.trueColor,
      color:old?.color??source.color,
      colorIndex:old?.colorIndex??source.colorIndex,
      count:0
    };
    next.set(name,layer);
  }
  for(const e of state.entities){
    if(!next.has(e.layer)){
      const source=ensureLayerDefinition(e.layer);
      next.set(e.layer,{...source,count:0});
    }
    next.get(e.layer).count++;
  }
  state.layers=next;
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
  const r=E.canvas.getBoundingClientRect();
  ctx.save();ctx.setTransform(DPR(),0,0,DPR(),0,0);
  ctx.fillStyle='#0b1016';ctx.fillRect(0,0,r.width,r.height);
  if(state.grid&&state.file)drawGrid(r.width,r.height);
  if(state.file){drawEntities();state.cursorPoint=resolveDraftPoint(state.pointer.x,state.pointer.y);}
  drawMeasure();
  drawCommandPreview();
  drawDraftingGuides();
  drawSnapMarker();
  drawSelectionBox();
  ctx.restore();
}
function worldToScreen(q){const r=E.canvas.getBoundingClientRect();return{x:(q.x-state.view.cx)*state.view.scale+r.width/2,y:(state.view.cy-q.y)*state.view.scale+r.height/2};}
function screenToWorld(x,y){const r=E.canvas.getBoundingClientRect();return{x:(x-r.left-r.width/2)/state.view.scale+state.view.cx,y:state.view.cy-(y-r.top-r.height/2)/state.view.scale};}
function drawGrid(w,h){
  const target=55/state.view.scale,pow=Math.pow(10,Math.floor(Math.log10(Math.max(target,1e-12)))),f=target/pow,step=(f<2?1:f<5?2:5)*pow;
  const tl=screenToWorld(E.canvas.getBoundingClientRect().left,E.canvas.getBoundingClientRect().top),br=screenToWorld(E.canvas.getBoundingClientRect().right,E.canvas.getBoundingClientRect().bottom);
  ctx.lineWidth=1;ctx.strokeStyle='rgba(130,150,160,.085)';ctx.beginPath();for(let x=Math.floor(tl.x/step)*step;x<=br.x;x+=step){const s=worldToScreen({x,y:0});ctx.moveTo(Math.round(s.x)+.5,0);ctx.lineTo(Math.round(s.x)+.5,h);}for(let y=Math.floor(br.y/step)*step;y<=tl.y;y+=step){const s=worldToScreen({x:0,y});ctx.moveTo(0,Math.round(s.y)+.5);ctx.lineTo(w,Math.round(s.y)+.5);}ctx.stroke();
  const o=worldToScreen({x:0,y:0});ctx.strokeStyle='rgba(53,211,154,.18)';ctx.beginPath();ctx.moveTo(o.x,0);ctx.lineTo(o.x,h);ctx.moveTo(0,o.y);ctx.lineTo(w,o.y);ctx.stroke();
}
function drawEntities(){
  for(const e of state.entities){
    if(!layerVisible(e.layer))continue;
    const selected=state.selected.has(e.id),hover=state.hover===e.id;
    drawEntity(e,selected?'#006dff':hover?'#35d39a':resolvedEntityColor(e),selected?2.2:hover?1.8:1.15);
  }
}
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
  if(!state.measure.length)return;const pts=[...state.measure];if(pts.length===1&&state.tool==='measure')pts.push(resolveDraftPoint(state.pointer.x,state.pointer.y));if(pts.length<2)return;const a=worldToScreen(pts[0]),b=worldToScreen(pts[1]);ctx.strokeStyle='#35d39a';ctx.fillStyle='#35d39a';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);for(const q of[a,b]){ctx.beginPath();ctx.arc(q.x,q.y,3.5,0,Math.PI*2);ctx.fill();}
}

function drawSelectionBox(){
  const box=state.selectionBox;
  if(!box)return;
  const r=E.canvas.getBoundingClientRect();
  const x1=box.x1-r.left,y1=box.y1-r.top,x2=box.x2-r.left,y2=box.y2-r.top;
  const left=Math.min(x1,x2),top=Math.min(y1,y2),w=Math.abs(x2-x1),h=Math.abs(y2-y1);
  const crossing=x2<x1;
  ctx.save();
  ctx.lineWidth=1;
  ctx.fillStyle=crossing?'rgba(63,178,102,.16)':'rgba(47,128,237,.16)';
  ctx.strokeStyle=crossing?'rgba(100,225,139,.95)':'rgba(93,157,255,.95)';
  ctx.setLineDash(crossing?[7,5]:[]);
  ctx.fillRect(left,top,w,h);
  ctx.strokeRect(Math.round(left)+.5,Math.round(top)+.5,Math.max(0,w-1),Math.max(0,h-1));
  ctx.setLineDash([]);
  const label=crossing?T.crossing:T.window;
  ctx.font='800 9px ui-monospace,SFMono-Regular,Menlo,monospace';
  const tw=ctx.measureText(label).width;
  const lx=Math.min(Math.max(x2+10,8),r.width-tw-18),ly=Math.min(Math.max(y2-10,18),r.height-8);
  ctx.fillStyle='rgba(5,10,14,.93)';ctx.fillRect(lx-5,ly-12,tw+10,17);
  ctx.fillStyle=crossing?'#72e89c':'#72a9ff';ctx.fillText(label,lx,ly);
  ctx.restore();
}

function pointerDown(ev){
  if(!state.file)return;
  state.pointer={x:ev.clientX,y:ev.clientY};

  // AutoCAD-style 2D navigation: wheel button pans. Right-click is reserved
  // for the shortcut menu instead of competing with navigation.
  if(ev.button===1){
    ev.preventDefault();
    closeContextMenu();
    state.drag={mode:'pan',id:ev.pointerId,lastX:ev.clientX,lastY:ev.clientY,startX:ev.clientX,startY:ev.clientY,moved:false};
    try{E.canvas.setPointerCapture(ev.pointerId)}catch{}
    E.workspace.classList.add('is-panning');
    return;
  }

  if(ev.button!==0)return;
  closeContextMenu();

  if(state.command?.selecting||(!state.command&&state.tool==='select')){
    state.drag={
      mode:'select-candidate',
      id:ev.pointerId,
      startX:ev.clientX,startY:ev.clientY,
      lastX:ev.clientX,lastY:ev.clientY,
      startHit:hitTest(ev.clientX,ev.clientY),
      shift:Boolean(ev.shiftKey),
      moved:false
    };
  }else{
    state.drag={mode:'left',id:ev.pointerId,startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,moved:false};
  }
  try{E.canvas.setPointerCapture(ev.pointerId)}catch{}
}

function pointerMove(ev){
  state.pointer={x:ev.clientX,y:ev.clientY};
  const d=state.drag;

  if(d?.id===ev.pointerId){
    const dx=ev.clientX-(d.lastX??ev.clientX),dy=ev.clientY-(d.lastY??ev.clientY);
    const total=Math.hypot(ev.clientX-(d.startX??ev.clientX),ev.clientY-(d.startY??ev.clientY));

    if(d.mode==='pan'){
      if(total>2)d.moved=true;
      state.view.cx-=dx/state.view.scale;
      state.view.cy+=dy/state.view.scale;
      d.lastX=ev.clientX;d.lastY=ev.clientY;
      return;
    }

    if(d.mode==='select-candidate'&&total>4){
      d.mode='selection-box';
      d.moved=true;
      state.hover=null;
      state.selectionBox={x1:d.startX,y1:d.startY,x2:ev.clientX,y2:ev.clientY};
      return;
    }

    if(d.mode==='selection-box'){
      state.selectionBox={x1:d.startX,y1:d.startY,x2:ev.clientX,y2:ev.clientY};
      return;
    }

    if(total>3)d.moved=true;
  }

  if((state.command?.selecting||(!state.command&&state.tool==='select'))&&(!d||d.mode==='select-candidate')){
    const hit=hitTest(ev.clientX,ev.clientY);
    state.hover=hit?.id||null;
  }
}

function pointerUp(ev){
  if(!state.drag||state.drag.id!==ev.pointerId)return;
  const d=state.drag;
  state.drag=null;
  E.workspace.classList.remove('is-panning');
  try{E.canvas.releasePointerCapture(ev.pointerId)}catch{}

  if(d.mode==='pan')return;

  if(d.mode==='selection-box'){
    const box=state.selectionBox||{x1:d.startX,y1:d.startY,x2:ev.clientX,y2:ev.clientY};
    state.selectionBox=null;
    selectByBox(box,d.shift||ev.shiftKey);
    syncSelectionUI();
    return;
  }

  if(d.moved)return;
  if(ev.button!==0)return;

  const raw=screenToWorld(ev.clientX,ev.clientY);
  const point=resolveDraftPoint(ev.clientX,ev.clientY);

  if(state.command&&!state.command.selecting){
    commandPoint(point,ev);
    return;
  }

  if(state.command?.selecting||(!state.command&&state.tool==='select')){
    const hit=hitTest(ev.clientX,ev.clientY);
    if(hit){
      // AutoCAD selection sets accumulate. Shift removes from the set.
      if(ev.shiftKey)state.selected.delete(hit.id);
      else state.selected.add(hit.id);
    }else if(!ev.shiftKey){
      state.selected.clear();
    }
    syncSelectionUI();
    return;
  }

  if(state.tool==='measure'){
    if(state.measure.length>=2)state.measure=[];
    state.measure.push(point);
    E.measureCard.hidden=false;
    if(state.measure.length===1)E.measureHelp.textContent=T.secondPoint;
    else updateMeasureCard();
    return;
  }

  if(state.tool==='move'){
    if(!state.selected.size)return toast(T.chooseSelection);
    if(!state.moveBase){state.moveBase=point;toast(T.moveTarget);return;}
    const dx=point.x-state.moveBase.x,dy=point.y-state.moveBase.y;
    pushHistory();translateSelected(dx,dy);state.moveBase=null;setTool('select');toast(T.moved);
  }
}

function selectByBox(box,subtract=false){
  const crossing=box.x2<box.x1;
  const a=screenToWorld(box.x1,box.y1),b=screenToWorld(box.x2,box.y2);
  const rect={minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)};
  const matches=[];

  for(const entity of state.entities){
    if(!layerVisible(entity.layer))continue;
    const match=crossing?entityCrossesRect(entity,rect):entityInsideRect(entity,rect);
    if(match)matches.push(entity.id);
  }

  for(const id of matches){
    if(subtract)state.selected.delete(id);
    else state.selected.add(id);
  }

  toast(`${crossing?T.crossing:T.window} · ${matches.length} ${subtract?T.selectRemoved:T.selectAdded}`);
}

function entityInsideRect(entity,rect){
  const b=entityBounds(entity);
  if(!b)return false;
  return b.minX>=rect.minX&&b.maxX<=rect.maxX&&b.minY>=rect.minY&&b.maxY<=rect.maxY;
}

function entityCrossesRect(entity,rect){
  const samples=selectionSamples(entity);
  if(!samples.length)return false;
  const b=boundsFromPoints(samples);
  if(!b||b.maxX<rect.minX||b.minX>rect.maxX||b.maxY<rect.minY||b.minY>rect.maxY)return false;
  if(samples.some(q=>pointInRect(q,rect)))return true;
  const segments=selectionSegments(entity,samples);
  return segments.some(([a,b])=>segmentIntersectsRect(a,b,rect));
}

function entityBounds(entity){return boundsFromPoints(selectionSamples(entity));}
function boundsFromPoints(points){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const q of points){
    if(!Number.isFinite(q?.x)||!Number.isFinite(q?.y))continue;
    minX=Math.min(minX,q.x);minY=Math.min(minY,q.y);maxX=Math.max(maxX,q.x);maxY=Math.max(maxY,q.y);
  }
  return Number.isFinite(minX)?{minX,minY,maxX,maxY}:null;
}
function selectionSamples(entity){
  if(entity.type==='CIRCLE'){
    const out=[];for(let i=0;i<128;i++){const t=i/128*Math.PI*2;out.push({x:entity.center.x+entity.radius*Math.cos(t),y:entity.center.y+entity.radius*Math.sin(t)});}return out;
  }
  if(entity.type==='ARC'){
    const out=[],span=positiveSpan(entity.start,entity.end),n=Math.max(32,Math.ceil(span/(Math.PI/64)));
    for(let i=0;i<=n;i++){const t=entity.start+span*i/n;out.push({x:entity.center.x+entity.radius*Math.cos(t),y:entity.center.y+entity.radius*Math.sin(t)});}return out;
  }
  return entitySamples(entity);
}
function selectionSegments(entity,samples){
  if(samples.length<2)return[];
  const out=[];for(let i=0;i<samples.length-1;i++)out.push([samples[i],samples[i+1]]);
  if(entity.type==='CIRCLE'||(entity.type==='POLYLINE'&&entity.closed))out.push([samples[samples.length-1],samples[0]]);
  return out;
}
function pointInRect(p,r){return p.x>=r.minX&&p.x<=r.maxX&&p.y>=r.minY&&p.y<=r.maxY;}
function segmentIntersectsRect(a,b,r){
  if(pointInRect(a,r)||pointInRect(b,r))return true;
  const c1={x:r.minX,y:r.minY},c2={x:r.maxX,y:r.minY},c3={x:r.maxX,y:r.maxY},c4={x:r.minX,y:r.maxY};
  return segmentsIntersect(a,b,c1,c2)||segmentsIntersect(a,b,c2,c3)||segmentsIntersect(a,b,c3,c4)||segmentsIntersect(a,b,c4,c1);
}
function segmentsIntersect(a,b,c,d){
  const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const on=(p,q,r)=>Math.min(p.x,r.x)-1e-10<=q.x&&q.x<=Math.max(p.x,r.x)+1e-10&&Math.min(p.y,r.y)-1e-10<=q.y&&q.y<=Math.max(p.y,r.y)+1e-10;
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  if((o1>0)!==(o2>0)&&(o3>0)!==(o4>0))return true;
  if(Math.abs(o1)<1e-10&&on(a,c,b))return true;
  if(Math.abs(o2)<1e-10&&on(a,d,b))return true;
  if(Math.abs(o3)<1e-10&&on(c,a,d))return true;
  if(Math.abs(o4)<1e-10&&on(c,b,d))return true;
  return false;
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

function legacyNearestSnap(clientX,clientY){if(!state.snap)return null;const q=screenToWorld(clientX,clientY),tol=12/state.view.scale;let best=null,bestD=tol;for(const e of state.entities){if(!layerVisible(e.layer))continue;for(const s of legacyEntitySnapPoints(e)){const d=dist(q,s.point);if(d<bestD){bestD=d;best=s;}}}return best;}
function legacyCurrentSnap(){return legacyNearestSnap(state.pointer.x,state.pointer.y)?.point||null;}
function legacyEntitySnapPoints(e){
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
function setAllLayers(value){
  for(const layer of state.layers.values()){
    layer.visible=value;
    if(value)layer.frozen=false;
    syncLayerDefinition(layer);
  }
  renderLayerList();recomputeBounds();
}
function syncLayerDefinition(layer){
  const def=ensureLayerDefinition(layer.name);
  Object.assign(def,{
    colorIndex:layer.colorIndex,
    trueColor:layer.trueColor,
    color:layer.color,
    visible:layer.visible,
    frozen:layer.frozen,
    flags:layer.flags,
    linetype:layer.linetype,
    lineweight:layer.lineweight,
    plot:layer.plot
  });
}
function assignSelectedLayer(name){
  if(!state.selected.size)return toast(T.chooseSelection);
  pushHistory();ensureLayerDefinition(name);
  for(const e of state.entities)if(state.selected.has(e.id)){e.layer=name;e.colorMode='bylayer';e.colorIndex=256;e.trueColor=null;}
  rebuildLayers();renderLayerList();recomputeBounds();syncUI();toast(`Layer → ${name}`);
}
function renderLayerList(){
  E.layerList.innerHTML='';
  for(const layer of [...state.layers.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}))){
    const row=document.createElement('div');row.className='n2-layer-row';
    if(layer.count===0)row.classList.add('is-unused');
    if(layer.name===state.activeLayer)row.classList.add('is-current');
    row.title=FR?'Double-cliquez pour rendre ce layer courant':'Double-click to make this layer current';
    row.addEventListener('dblclick',()=>{state.activeLayer=layer.name;renderLayerList();syncUI();commandLog(`Layer: ${layer.name}`);});

    const cb=document.createElement('input');cb.type='checkbox';cb.className='n2-layer-visible';cb.checked=layer.visible;cb.title=FR?'Afficher / cacher':'Show / hide';
    cb.addEventListener('change',()=>{layer.visible=cb.checked;if(cb.checked)layer.frozen=false;syncLayerDefinition(layer);recomputeBounds();renderLayerList();});

    const color=document.createElement('input');color.type='color';color.className='n2-layer-color';color.value=layer.color||aciColorToHex(layer.colorIndex);color.title=FR?'Couleur du layer':'Layer color';
    color.addEventListener('input',()=>{
      layer.color=color.value.toLowerCase();
      layer.trueColor=parseInt(layer.color.slice(1),16);
      syncLayerDefinition(layer);
    });

    const name=document.createElement('span');name.className='n2-layer-name';name.textContent=layer.name;

    const meta=document.createElement('span');meta.className='n2-layer-meta';
    if(layer.count===0){const badge=document.createElement('b');badge.className='unused';badge.textContent=T.unused;meta.append(badge);}
    if(layer.frozen){const badge=document.createElement('b');badge.textContent=T.frozen;meta.append(badge);}
    if(!layer.visible){const badge=document.createElement('b');badge.textContent=T.off;meta.append(badge);}

    const count=document.createElement('span');count.className='n2-layer-count';count.textContent=String(layer.count);

    row.append(cb,color,name,meta,count);
    E.layerList.append(row);
  }
}

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
function syncUI(){const has=Boolean(state.file);for(const b of[E.select,E.measure,E.fit,E.grid,E.snap,E.layers,E.analyze,E.props,E.export,E.close])b.disabled=!has;E.statusFile.textContent=state.file?.name||T.noDxf;E.statusEntities.textContent=has?`${state.entities.length} ${T.entities}`:'—';E.statusUnits.textContent=has?state.unitLabel:'—';if(E.currentLayer)E.currentLayer.textContent=has?`Layer: ${state.activeLayer||'0'}`:'Layer: —';E.empty.hidden=has;syncHistoryButtons();renderProperties();syncDraftingUI();updateCommandPrompt();}
function clearFile(){cancelCommand(false);state.file=null;state.dxf=null;state.rawText='';state.entities=[];state.layers.clear();state.layerDefinitions.clear();state.unsupported=[];state.selected.clear();state.history=[];state.future=[];state.analysis=null;state.bounds=null;state.selectionBox=null;closeContextMenu();clearMeasure();syncUI();E.layerDrawer.hidden=true;E.propDrawer.hidden=true;}
function toggleDrawer(which,force){const el=which==='layers'?E.layerDrawer:E.propDrawer,other=which==='layers'?E.propDrawer:E.layerDrawer;const show=force??el.hidden;el.hidden=!show;if(show)other.hidden=true;if(which==='properties'&&show)renderProperties();}

function exportDxf(){if(!state.file)return;const text=writeDxf();const name=(state.file.name.replace(/\.dxf$/i,'')||'navo2d')+'-Navo2D.dxf';downloadBlob(text,name,'application/dxf');toast(T.exported);}
function writeDxf(){
  const lines=[];const add=(c,v)=>{lines.push(String(c),String(v));};
  add(0,'SECTION');add(2,'HEADER');add(9,'$ACADVER');add(1,'AC1015');add(9,'$INSUNITS');add(70,state.unitCode||0);add(0,'ENDSEC');

  add(0,'SECTION');add(2,'TABLES');add(0,'TABLE');add(2,'LAYER');add(70,state.layers.size);
  for(const layer of state.layers.values()){
    const baseFlags=Number(layer.flags)||0;
    const flags=layer.frozen?(baseFlags|1):(baseFlags&~3);
    const aci=Math.max(1,Math.min(255,Math.abs(Number(layer.colorIndex)||7)));
    add(0,'LAYER');add(2,layer.name);add(70,flags);add(62,layer.visible?aci:-aci);
    if(Number.isFinite(layer.trueColor))add(420,layer.trueColor);
    add(6,layer.linetype||'CONTINUOUS');
    if(Number.isFinite(layer.lineweight))add(370,layer.lineweight);
    add(290,layer.plot===false?0:1);
  }
  add(0,'ENDTAB');add(0,'ENDSEC');

  add(0,'SECTION');add(2,'ENTITIES');for(const e of state.entities)writeEntity(add,e);add(0,'ENDSEC');add(0,'EOF');
  return lines.join('\r\n')+'\r\n';
}
function writeEntity(add,e){
  const common=()=>{
    add(8,e.layer||'0');
    if(e.colorMode==='aci'&&e.colorIndex>=1&&e.colorIndex<=255)add(62,e.colorIndex);
    else if(e.colorMode==='byblock')add(62,0);
    if(e.colorMode==='true'&&Number.isFinite(e.trueColor))add(420,e.trueColor);
  };
  if(e.type==='LINE'){add(0,'LINE');common();add(10,e.p1.x);add(20,e.p1.y);add(30,0);add(11,e.p2.x);add(21,e.p2.y);add(31,0);return;}
  if(e.type==='CIRCLE'){add(0,'CIRCLE');common();add(10,e.center.x);add(20,e.center.y);add(30,0);add(40,e.radius);return;}
  if(e.type==='ARC'){add(0,'ARC');common();add(10,e.center.x);add(20,e.center.y);add(30,0);add(40,e.radius);add(50,radToDeg(e.start));add(51,radToDeg(e.end));return;}
  if(e.type==='POINT'){add(0,'POINT');common();add(10,e.point.x);add(20,e.point.y);add(30,0);return;}
  if(e.type==='TEXT'){add(0,'TEXT');common();add(10,e.point.x);add(20,e.point.y);add(30,0);add(40,e.height||2.5);add(1,e.text||'');add(50,e.rotation||0);return;}
  if(e.type==='POLYLINE'){add(0,'LWPOLYLINE');common();add(90,e.points.length);add(70,e.closed?1:0);for(const q of e.points){add(10,q.x);add(20,q.y);if(Math.abs(q.bulge||0)>1e-12)add(42,q.bulge);}return;}
}
function radToDeg(v){let d=v*180/Math.PI;while(d<0)d+=360;while(d>=360)d-=360;return d;}
function downloadBlob(text,name,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

let contextMenuEl=null;
function openContextMenu(clientX,clientY){
  closeContextMenu();
  const menu=document.createElement('div');menu.className='n2-context-menu';
  const item=(label,shortcut,action,disabled=false)=>{
    const b=document.createElement('button');b.type='button';b.disabled=disabled;
    const l=document.createElement('span');l.textContent=label;
    const s=document.createElement('span');s.textContent=shortcut||'';s.style.color='#657782';
    b.append(l,s);b.addEventListener('click',()=>{closeContextMenu();action?.();});
    menu.append(b);
  };
  const sep=()=>{const d=document.createElement('div');d.className='n2-context-sep';menu.append(d);};

  item(FR?'Annuler':'Undo','Ctrl+Z',undo,!state.history.length);
  item(FR?'Rétablir':'Redo','Ctrl+Y',redo,!state.future.length);
  sep();
  item(FR?'Tout sélectionner':'Select all','Ctrl+A',()=>{for(const entity of state.entities)if(layerVisible(entity.layer))state.selected.add(entity.id);syncSelectionUI();});
  item(FR?'Effacer la sélection':'Clear selection','Esc',()=>{state.selected.clear();syncSelectionUI();});
  sep();
  item(FR?'Zoom étendu':'Zoom Extents','F',fitView);
  item(FR?'Supprimer':'Erase','Del',deleteSelected,!state.selected.size);

  document.body.append(menu);contextMenuEl=menu;
  const r=menu.getBoundingClientRect();
  menu.style.left=`${Math.min(clientX,innerWidth-r.width-8)}px`;
  menu.style.top=`${Math.min(clientY,innerHeight-r.height-8)}px`;
  setTimeout(()=>document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))closeContextMenu();},{once:true,capture:true}),0);
}
function closeContextMenu(){
  if(contextMenuEl){contextMenuEl.remove();contextMenuEl=null;}
}
async function toggleFullscreen(){
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await E.workspace.requestFullscreen();
    setTimeout(resize,40);
  }catch(err){console.warn('Fullscreen unavailable',err);}
}

function toast(msg){clearTimeout(toastTimer);E.toast.textContent=msg;E.toast.hidden=false;toastTimer=setTimeout(()=>E.toast.hidden=true,2300);}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// -----------------------------------------------------------------------------
// V3 — AutoCAD-style command line, aliases, drafting aids and creation tools
// -----------------------------------------------------------------------------

const COMMAND_ALIASES=new Map(Object.entries({
  L:'LINE',LINE:'LINE',PL:'PLINE',PLINE:'PLINE',C:'CIRCLE',CIRCLE:'CIRCLE',A:'ARC',ARC:'ARC',
  REC:'RECTANG',RECTANG:'RECTANG',RECTANGLE:'RECTANG',
  M:'MOVE',MOVE:'MOVE',CO:'COPY',CP:'COPY',COPY:'COPY',RO:'ROTATE',ROTATE:'ROTATE',MI:'MIRROR',MIRROR:'MIRROR',
  SC:'SCALE',SCALE:'SCALE',O:'OFFSET',OFFSET:'OFFSET',E:'ERASE',ERASE:'ERASE',DEL:'ERASE',
  X:'EXPLODE',EXPLODE:'EXPLODE',J:'JOIN',JOIN:'JOIN',
  DI:'DIST',DIST:'DIST',DISTANCE:'DIST',ID:'ID',
  Z:'ZOOM',ZOOM:'ZOOM',ZE:'ZOOMEXTENTS',LA:'LAYER',LAYER:'LAYER',
  U:'UNDO',UNDO:'UNDO',REDO:'REDO',
  OS:'OSNAP',OSNAP:'OSNAP',SNAP:'SNAP',ORTHO:'ORTHO',POLAR:'POLAR',
  NEW:'NEW',QNEW:'NEW',QSAVE:'SAVE',SAVE:'SAVE',OPEN:'OPEN',CLOSE:'CLOSE',PR:'PROPERTIES',PROPERTIES:'PROPERTIES',RE:'REGEN',REGEN:'REGEN'
}));

const KNOWN_UNIMPLEMENTED=new Set([
  'TR','TRIM','EX','EXTEND','F','FILLET','CHA','CHAMFER','S','STRETCH','BR','BREAK','BREAKATPOINT',
  'LEN','LENGTHEN','PE','PEDIT','H','HATCH','BHATCH','T','TEXT','MT','MTEXT','D','DIM','DIMLINEAR','DIMALIGNED',
  'AR','ARRAY','ARRAYRECT','ARRAYPOLAR','B','BLOCK','I','INSERT','WBLOCK','PURGE','PU','XL','XLINE','RAY',
  'EL','ELLIPSE','SPL','SPLINE','ML','MLINE','REG','REGION','BO','BOUNDARY','MA','MATCHPROP','CH','PROPERTIES',
  'ST','STYLE','LT','LINETYPE','LTSCALE','UN','UNITS','RE','REGEN','AUDIT','OVERKILL'
]);

const SNAP_OVERRIDE_NAMES={
  END:'end',ENDP:'end',MID:'mid',MIDP:'mid',CEN:'center',CENTER:'center',QUA:'quad',QUADRANT:'quad',
  INT:'intersection',INTERSECTION:'intersection',PER:'perp',PERP:'perp',TAN:'tangent',TANGENT:'tangent',
  NEA:'nearest',NEAR:'nearest',NOD:'node',NODE:'node',GCEN:'gcenter',GCE:'gcenter',INS:'insert',INSERTION:'insert'
};

function handleGlobalKeyDown(event){
  if(event.defaultPrevented)return;
  const target=event.target;
  const editing=target===E.commandInput||target?.matches?.('input,select,textarea,[contenteditable="true"]');

  if(event.key==='Tab'&&state.command&&commandNeedsPoint(state.command)){
    event.preventDefault();state.snapCycle=(state.snapCycle||0)+1;return;
  }
  if(/^F(?:3|7|8|9|10|11|12)$/.test(event.key)){
    event.preventDefault();
    ({F3:'osnap',F7:'grid',F8:'ortho',F9:'gridSnap',F10:'polar',F11:'otrack',F12:'dyn'})[event.key]&&toggleDraftSetting(({F3:'osnap',F7:'grid',F8:'ortho',F9:'gridSnap',F10:'polar',F11:'otrack',F12:'dyn'})[event.key]);
    return;
  }
  if(editing)return;

  if(event.key==='Escape'||((event.ctrlKey||event.metaKey)&&(event.key==='['||event.key==='\\'))){
    event.preventDefault();
    if(state.command)cancelCommand(true);
    else{
      state.drag=null;state.selectionBox=null;state.moveBase=null;state.selected.clear();clearMeasure();closeContextMenu();setTool('select');syncSelectionUI();
    }
    return;
  }
  if(event.key==='Delete'||event.key==='Backspace'){
    if(state.selected.size){event.preventDefault();startCommand('ERASE');}
    return;
  }
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(state.file)exportDxf();return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='o'){event.preventDefault();E.file.click();return;}
  if((event.ctrlKey||event.metaKey)&&event.key==='1'){event.preventDefault();if(state.file)toggleDrawer('properties',true);return;}
  if((event.ctrlKey||event.metaKey)&&event.key==='0'){event.preventDefault();toggleFullscreen();return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='g'){event.preventDefault();toggleDraftSetting('grid');return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){
    event.preventDefault();for(const entity of state.entities)if(layerVisible(entity.layer))state.selected.add(entity.id);syncSelectionUI();return;
  }
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
    event.preventDefault();event.shiftKey?redo():undo();return;
  }
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){
    event.preventDefault();redo();return;
  }
  if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    if(state.command)commandEnter();
    else if(state.lastCommand)startCommand(state.lastCommand);
    return;
  }
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault();
    E.commandInput.focus();
    E.commandInput.value=event.key;
    E.commandInput.setSelectionRange(E.commandInput.value.length,E.commandInput.value.length);
  }
}

function handleCommandInputKeyDown(event){
  if(event.key==='Tab'&&state.command&&commandNeedsPoint(state.command)){event.preventDefault();state.snapCycle=(state.snapCycle||0)+1;return;}
  if(/^F(?:3|7|8|9|10|11|12)$/.test(event.key)){
    event.preventDefault();
    const map={F3:'osnap',F7:'grid',F8:'ortho',F9:'gridSnap',F10:'polar',F11:'otrack',F12:'dyn'};
    toggleDraftSetting(map[event.key]);return;
  }
  if(event.key==='Escape'){
    event.preventDefault();E.commandInput.value='';cancelCommand(true);E.canvas.focus();return;
  }
  if(event.key==='Enter'||event.key===' '){
    event.preventDefault();submitCommandInput();return;
  }
  if(event.key==='ArrowUp'&&!state.command){
    event.preventDefault();E.commandInput.value=state.lastCommand||'';E.commandInput.select();
  }
}

function submitCommandInput(){
  const raw=E.commandInput.value.trim();
  E.commandInput.value='';
  if(state.command){
    if(!raw){commandEnter();return;}
    commandText(raw);return;
  }
  if(!raw){if(state.lastCommand)startCommand(state.lastCommand);return;}
  startCommand(raw);
}

function resolveCommandName(raw){
  const u=String(raw||'').trim().replace(/^_/,'').toUpperCase();
  return COMMAND_ALIASES.get(u)||u;
}

function startCommand(rawName){
  const name=resolveCommandName(rawName);
  if(state.command)cancelCommand(false);
  closeContextMenu();clearMeasure();state.hover=null;state.selectionBox=null;state.snapOverride=null;

  if(KNOWN_UNIMPLEMENTED.has(name)){
    commandLog(`${name} — ${CMDT.notYet}`);toast(`${name}: ${CMDT.notYet}`);return;
  }

  if(name==='UNDO'){undo();state.lastCommand='UNDO';commandLog('UNDO');return;}
  if(name==='REDO'){redo();state.lastCommand='REDO';commandLog('REDO');return;}
  if(name==='LAYER'){if(!state.file)ensureDrawing();toggleDrawer('layers',true);state.lastCommand='LAYER';commandLog('LAYER');return;}
  if(name==='OSNAP'){if(!state.file)ensureDrawing();E.osnapPanel.hidden=false;state.lastCommand='OSNAP';commandLog('OSNAP');return;}
  if(name==='ORTHO'){toggleDraftSetting('ortho');state.lastCommand='ORTHO';return;}
  if(name==='POLAR'){toggleDraftSetting('polar');state.lastCommand='POLAR';return;}
  if(name==='SNAP'){toggleDraftSetting('gridSnap');state.lastCommand='SNAP';return;}
  if(name==='ZOOM'||name==='ZOOMEXTENTS'){if(!state.file)return;fitView();state.lastCommand='ZOOM';commandLog('ZOOM Extents');return;}
  if(name==='NEW'){createBlankDrawing();state.lastCommand='NEW';return;}
  if(name==='SAVE'){if(state.file)exportDxf();state.lastCommand='SAVE';commandLog('QSAVE');return;}
  if(name==='OPEN'){E.file.click();state.lastCommand='OPEN';commandLog('OPEN');return;}
  if(name==='CLOSE'){if(state.file)clearFile();state.lastCommand='CLOSE';commandLog('CLOSE');return;}
  if(name==='PROPERTIES'){if(state.file)toggleDrawer('properties',true);state.lastCommand='PROPERTIES';commandLog('PROPERTIES');return;}
  if(name==='REGEN'){recomputeBounds();syncUI();state.lastCommand='REGEN';commandLog('REGEN');return;}

  const drawingCommands=new Set(['LINE','PLINE','CIRCLE','ARC','RECTANG']);
  if(drawingCommands.has(name)){ensureDrawing();state.selected.clear();syncSelectionUI();}
  if(!state.file){toast(FR?'Ouvrez un DXF ou tapez NEW.':'Open a DXF or type NEW.');return;}

  state.command={name,step:'',points:[],data:{},selecting:false,createdIds:[]};
  state.lastCommand=name;
  E.workspace.classList.add('command-active');

  if(name==='LINE'){state.command.step='first';setCommandPrompt(`${name} ${CMDT.specifyFirst}:`);}
  else if(name==='PLINE'){state.command.step='first';setCommandPrompt(`${name} ${CMDT.specifyFirst}:`);}
  else if(name==='CIRCLE'){state.command.step='center';setCommandPrompt(`${name} ${CMDT.specifyCenter}:`);}
  else if(name==='ARC'){state.command.step='first';setCommandPrompt(`${name} ${CMDT.specifyFirst}:`);}
  else if(name==='RECTANG'){state.command.step='first';setCommandPrompt(`${name} ${CMDT.specifyFirst}:`);}
  else if(['MOVE','COPY','ROTATE','MIRROR','SCALE','ERASE','EXPLODE','JOIN'].includes(name)){beginSelectionCommand(name);}
  else if(name==='OFFSET'){state.command.step='distance';setCommandPrompt(`${name} ${CMDT.offsetDistance}:`);}
  else if(name==='DIST'){state.command.step='first';setCommandPrompt(`${name} ${CMDT.distanceFirst}:`);}
  else if(name==='ID'){state.command.step='point';setCommandPrompt(`${name} ${CMDT.idPoint}:`);}
  else{
    cancelCommand(false);commandLog(`${name} — ${CMDT.unknown}`);toast(`${CMDT.unknown}: ${name}`);return;
  }
  updateCommandPrompt();
}

function beginSelectionCommand(name){
  if(state.selected.size){
    afterSelectionConfirmed(name);return;
  }
  state.command.selecting=true;state.command.step='select';
  setCommandPrompt(`${name} ${CMDT.selectObjects}:`);
}

function afterSelectionConfirmed(name){
  state.command.selecting=false;
  if(!state.selected.size){cancelCommand(true);return;}
  if(name==='ERASE'){deleteSelected();finishCommand();return;}
  if(name==='EXPLODE'){explodeSelected();finishCommand();return;}
  if(name==='JOIN'){joinSelected();finishCommand();return;}
  if(name==='MOVE'||name==='COPY'||name==='ROTATE'||name==='SCALE'){
    state.command.step='base';setCommandPrompt(`${name} ${CMDT.basePoint}:`);return;
  }
  if(name==='MIRROR'){
    state.command.step='mirror1';setCommandPrompt(`${name} ${CMDT.mirrorFirst}:`);return;
  }
}

function commandEnter(){
  const c=state.command;
  if(!c){if(state.lastCommand)startCommand(state.lastCommand);return;}
  if(c.selecting){afterSelectionConfirmed(c.name);return;}
  if(c.name==='LINE'){
    if(c.points.length>=1)finishCommand();else cancelCommand(true);return;
  }
  if(c.name==='PLINE'){
    if(c.points.length>=2){commitPolyline(c.points,false);finishCommand();}else cancelCommand(true);return;
  }
  if(c.name==='MIRROR'&&c.step==='eraseSource'){
    performMirror(false);finishCommand();return;
  }
  cancelCommand(true);
}

function commandText(raw){
  const c=state.command;if(!c)return;
  const u=String(raw).trim().toUpperCase();
  const override=SNAP_OVERRIDE_NAMES[u];
  if(override&&commandNeedsPoint(c)){
    state.snapOverride=override;commandLog(`${u} (${FR?'prochain point':'next point'})`);return;
  }

  if(c.name==='LINE'){
    if(u==='C'||u==='CLOSE'){
      if(c.points.length>=2){addLine(c.points[c.points.length-1],c.points[0]);finishCommand();}return;
    }
    if(u==='U'||u==='UNDO'){
      const id=c.createdIds.pop();if(id){state.entities=state.entities.filter(e=>e.id!==id);c.points.pop();afterGeometryChange();}return;
    }
  }
  if(c.name==='PLINE'){
    if(u==='C'||u==='CLOSE'){
      if(c.points.length>=2){commitPolyline(c.points,true);finishCommand();}return;
    }
    if(u==='U'||u==='UNDO'){if(c.points.length)c.points.pop();setCommandPrompt(`${c.name} ${c.points.length?CMDT.specifyNext:CMDT.specifyFirst}:`);return;}
  }
  if(c.name==='CIRCLE'&&c.step==='radius'&&(u==='D'||u==='DIAMETER')){
    c.data.diameter=true;setCommandPrompt(`${c.name} ${CMDT.diameter}:`);return;
  }
  if(c.name==='MIRROR'&&c.step==='eraseSource'){
    if(['Y','YES','O','OUI'].includes(u)){performMirror(true);finishCommand();return;}
    if(['N','NO','NON'].includes(u)){performMirror(false);finishCommand();return;}
  }

  if(c.name==='OFFSET'&&c.step==='distance'){
    const n=parseNumber(raw);if(!(n>0))return commandError(CMDT.valueInvalid);
    c.data.distance=n;c.step='selectEntity';setCommandPrompt(`${c.name} ${CMDT.offsetObject}:`);return;
  }
  if(c.name==='ROTATE'&&c.step==='angle'){
    const n=parseNumber(raw);if(!Number.isFinite(n))return commandError(CMDT.valueInvalid);
    performRotate(n*Math.PI/180);finishCommand();return;
  }
  if(c.name==='SCALE'&&c.step==='factor'){
    const n=parseNumber(raw);if(!(n>0))return commandError(CMDT.valueInvalid);
    performScale(n);finishCommand();return;
  }
  if(c.name==='CIRCLE'&&c.step==='radius'){
    const n=parseNumber(raw);if(!(n>0))return commandError(CMDT.valueInvalid);
    commitCircle(c.points[0],c.data.diameter?n/2:n);finishCommand();return;
  }

  if(commandNeedsPoint(c)){
    const base=commandReferencePoint();
    let point=parsePointInput(raw,base);
    if(!point&&base&&Number.isFinite(parseNumber(raw))){
      const d=parseNumber(raw);point=pointAtCurrentDirection(base,d);
    }
    if(!point)return commandError(CMDT.pointInvalid);
    commandPoint(point,null,true);return;
  }
  commandError(CMDT.valueInvalid);
}

function commandPoint(point,event,fromKeyboard=false){
  const c=state.command;if(!c||!point)return;
  state.snapOverride=null;

  if(c.name==='LINE'){
    if(c.step==='first'){
      c.points=[copyPoint(point)];c.step='next';setCommandPrompt(`${c.name} ${CMDT.specifyNext} [${CMDT.close}/${CMDT.undo}]:`);return;
    }
    const a=c.points[c.points.length-1],b=copyPoint(point);if(dist(a,b)<1e-12)return;
    const id=addLine(a,b);c.createdIds.push(id);c.points.push(b);setCommandPrompt(`${c.name} ${CMDT.specifyNext} [${CMDT.close}/${CMDT.undo}]:`);return;
  }
  if(c.name==='PLINE'){
    c.points.push(copyPoint(point));c.step='next';setCommandPrompt(`${c.name} ${CMDT.specifyNext} [${CMDT.close}/${CMDT.undo}]:`);return;
  }
  if(c.name==='CIRCLE'){
    if(c.step==='center'){c.points=[copyPoint(point)];c.step='radius';setCommandPrompt(`${c.name} ${CMDT.specifyRadius}:`);return;}
    let r=dist(c.points[0],point);if(c.data.diameter)r/=2;if(r>1e-12){commitCircle(c.points[0],r);finishCommand();}return;
  }
  if(c.name==='ARC'){
    c.points.push(copyPoint(point));
    if(c.points.length===1){c.step='second';setCommandPrompt(`${c.name} ${CMDT.specifySecond}:`);return;}
    if(c.points.length===2){c.step='third';setCommandPrompt(`${c.name} ${CMDT.specifyThird}:`);return;}
    const arc=arcFrom3Points(c.points[0],c.points[1],c.points[2]);
    if(!arc)return commandError(FR?'Les trois points sont colinéaires.':'The three points are collinear.');
    addEntity({...newEntityBase('ARC'),...arc});finishCommand();return;
  }
  if(c.name==='RECTANG'){
    if(c.step==='first'){c.points=[copyPoint(point)];c.step='second';setCommandPrompt(`${c.name} ${CMDT.specifyCorner}:`);return;}
    const a=c.points[0],b=point;
    commitPolyline([{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y},{x:a.x,y:b.y}],true);finishCommand();return;
  }
  if(c.name==='DIST'){
    c.points.push(copyPoint(point));
    if(c.points.length===1){c.step='second';setCommandPrompt(`${c.name} ${CMDT.distanceSecond}:`);return;}
    const a=c.points[0],b=c.points[1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),ang=radToDeg(Math.atan2(dy,dx));
    commandLog(`DIST = ${formatLength(d)}  ΔX = ${formatLength(dx)}  ΔY = ${formatLength(dy)}  ∠ ${fmt(ang)}°`);toast(`DIST ${formatLength(d)}`);finishCommand(false);return;
  }
  if(c.name==='ID'){
    commandLog(`X = ${fmt(point.x)}, Y = ${fmt(point.y)} ${state.unitLabel}`);toast(`X ${fmt(point.x)}  Y ${fmt(point.y)}`);finishCommand(false);return;
  }
  if(c.name==='MOVE'||c.name==='COPY'||c.name==='ROTATE'||c.name==='SCALE'){
    if(c.step==='base'){c.data.base=copyPoint(point);c.step=c.name==='ROTATE'?'angle':c.name==='SCALE'?'factor':'target';setCommandPrompt(`${c.name} ${c.name==='ROTATE'?CMDT.rotationAngle:c.name==='SCALE'?CMDT.scaleFactor:CMDT.secondPoint}:`);return;}
    if(c.step==='target'){
      const dx=point.x-c.data.base.x,dy=point.y-c.data.base.y;
      if(c.name==='MOVE'){pushHistory();translateSelected(dx,dy);toast(T.moved);}
      else{performCopy(dx,dy);toast(CMDT.copied);}
      finishCommand();return;
    }
    if(c.step==='angle'){
      const ang=Math.atan2(point.y-c.data.base.y,point.x-c.data.base.x);performRotate(ang);finishCommand();return;
    }
    if(c.step==='factor'){
      const factor=dist(c.data.base,point);
      if(factor>1e-12){performScale(factor);finishCommand();}return;
    }
  }
  if(c.name==='MIRROR'){
    if(c.step==='mirror1'){c.data.p1=copyPoint(point);c.step='mirror2';setCommandPrompt(`${c.name} ${CMDT.mirrorSecond}:`);return;}
    if(c.step==='mirror2'){
      if(dist(c.data.p1,point)<1e-12)return;
      c.data.p2=copyPoint(point);c.step='eraseSource';setCommandPrompt(`${c.name} ${CMDT.eraseSource}:`);return;
    }
  }
  if(c.name==='OFFSET'){
    if(c.step==='selectEntity'){
      const hit=event?hitTest(event.clientX,event.clientY):hitTest(state.pointer.x,state.pointer.y);
      if(!hit)return;
      if(!['LINE','CIRCLE','ARC'].includes(hit.type))return commandError(CMDT.unsupportedSelection);
      c.data.entityId=hit.id;c.step='side';setCommandPrompt(`${c.name} ${CMDT.offsetSide}:`);return;
    }
    if(c.step==='side'){
      const entity=state.entities.find(e=>e.id===c.data.entityId);if(!entity)return cancelCommand(true);
      const offset=offsetEntity(entity,c.data.distance,point);if(!offset)return commandError(CMDT.unsupportedSelection);
      addEntity(offset);toast(CMDT.offsetDone);finishCommand();return;
    }
  }
}

function commandNeedsPoint(c){
  if(!c||c.selecting)return false;
  if(['LINE','PLINE','ARC','RECTANG','DIST','ID'].includes(c.name))return true;
  if(c.name==='CIRCLE')return c.step==='center'||c.step==='radius';
  if(['MOVE','COPY'].includes(c.name))return c.step==='base'||c.step==='target';
  if(['ROTATE','SCALE'].includes(c.name))return c.step==='base'||c.step==='angle'||c.step==='factor';
  if(c.name==='MIRROR')return c.step==='mirror1'||c.step==='mirror2';
  if(c.name==='OFFSET')return c.step==='selectEntity'||c.step==='side';
  return false;
}

function commandReferencePoint(){
  const c=state.command;if(!c)return null;
  if((c.name==='LINE'||c.name==='PLINE')&&c.points.length)return c.points[c.points.length-1];
  if(c.name==='CIRCLE'&&c.points.length)return c.points[0];
  if(c.name==='ARC'&&c.points.length)return c.points[c.points.length-1];
  if(c.name==='RECTANG'&&c.points.length)return c.points[0];
  if(c.name==='DIST'&&c.points.length)return c.points[0];
  if(['MOVE','COPY','ROTATE','SCALE'].includes(c.name)&&c.data.base)return c.data.base;
  if(c.name==='MIRROR'&&c.data.p1)return c.data.p1;
  return null;
}

function commandReferenceDistance(base){
  const raw=screenToWorld(state.pointer.x,state.pointer.y);return Math.max(dist(base,raw),1e-9);
}

function finishCommand(log=true){
  const name=state.command?.name;
  state.command=null;state.snapOverride=null;state.trackingPoint=null;E.workspace.classList.remove('command-active');
  setTool('select');syncSelectionUI();updateCommandPrompt();
  if(log&&name)commandLog(`${name} — ${CMDT.complete}`);
  try{E.canvas.focus()}catch{}
}

function cancelCommand(log=true){
  const had=state.command;
  state.command=null;state.snapOverride=null;state.trackingPoint=null;state.selectionBox=null;E.workspace.classList.remove('command-active');
  if(log&&had)commandLog(CMDT.canceled);
  updateCommandPrompt();
}

function setCommandPrompt(text){
  if(E.commandPrompt)E.commandPrompt.textContent=text||CMDT.command;
  E.commandInput?.closest('.n2-commandline')?.classList.toggle('is-active',Boolean(state.command));
}
function updateCommandPrompt(){
  if(!state.command)setCommandPrompt(CMDT.command);
}
function commandLog(text){
  if(!text)return;state.commandLog.push(String(text));if(state.commandLog.length>30)state.commandLog.shift();
  if(E.commandHistory)E.commandHistory.textContent=String(text);
}
function commandError(text){commandLog(text);toast(text);}

function ensureDrawing(){if(!state.file)createBlankDrawing();}
function createBlankDrawing(){
  cancelCommand(false);state.file={name:'Drawing1.dxf',size:0};state.dxf={header:{$INSUNITS:4},entities:[]};state.rawText='';state.entities=[];state.unsupported=[];state.selected.clear();state.history=[];state.future=[];state.analysis=null;state.dirty=false;state.unitCode=4;state.unitLabel='mm';state.entitySeq=0;state.layerDefinitions=new Map();state.layers=new Map();ensureLayerDefinition('0');rebuildLayers();state.activeLayer='0';state.bounds=null;state.view={scale:1,cx:0,cy:0};syncUI();renderLayerList();E.empty.hidden=true;commandLog(FR?'Nouveau dessin DXF.':'New DXF drawing.');
}
function nextEntityId(){return`n${++state.entitySeq}`;}
function newEntityBase(type){
  ensureLayerDefinition(state.activeLayer||'0');return{id:nextEntityId(),type,rawType:type,layer:state.activeLayer||'0',colorMode:'bylayer',colorIndex:256,trueColor:null,approx:false};
}
function addEntity(entity){
  pushHistory();state.entities.push(entity);afterGeometryChange();return entity.id;
}
function addLine(a,b){return addEntity({...newEntityBase('LINE'),p1:copyPoint(a),p2:copyPoint(b)});}
function commitCircle(center,radius){return addEntity({...newEntityBase('CIRCLE'),center:copyPoint(center),radius:Math.abs(radius)});}
function commitPolyline(points,closed=false){return addEntity({...newEntityBase('POLYLINE'),points:points.map(q=>({x:q.x,y:q.y,bulge:q.bulge||0})),closed:Boolean(closed)});}
function afterGeometryChange(){rebuildLayers();recomputeBounds();renderLayerList();syncUI();state.dirty=true;}
function copyPoint(q){return{x:+q.x||0,y:+q.y||0};}
function parseNumber(v){const n=Number(String(v).trim().replace(',','.'));return Number.isFinite(n)?n:NaN;}

function parsePointInput(raw,base){
  let s=String(raw||'').trim().replace(/\s+/g,'');if(!s)return null;
  const relative=s.startsWith('@');const forcedAbsolute=s.startsWith('#');if(relative||forcedAbsolute)s=s.slice(1);
  if(s.includes('<')){
    const [ds,as]=s.split('<'),d=parseNumber(ds),a=parseNumber(as);if(!Number.isFinite(d)||!Number.isFinite(a))return null;
    const origin=relative||(!forcedAbsolute&&base)?(base||{x:0,y:0}):{x:0,y:0};const r=a*Math.PI/180;return{x:origin.x+d*Math.cos(r),y:origin.y+d*Math.sin(r)};
  }
  if(s.includes(',')){
    const parts=s.split(',');if(parts.length<2)return null;const x=parseNumber(parts[0]),y=parseNumber(parts[1]);if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    if(relative){const o=base||{x:0,y:0};return{x:o.x+x,y:o.y+y};}
    return{x,y};
  }
  return null;
}

function pointAtCurrentDirection(base,distance){
  let p=resolveDraftPoint(state.pointer.x,state.pointer.y,true);let vx=p.x-base.x,vy=p.y-base.y,len=Math.hypot(vx,vy);if(len<1e-12){vx=1;vy=0;len=1;}return{x:base.x+vx/len*distance,y:base.y+vy/len*distance};
}

function arcFrom3Points(a,b,c){
  const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-12)return null;
  const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
  const center={x:(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,y:(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d};
  const radius=dist(center,a);let start=Math.atan2(a.y-center.y,a.x-center.x),mid=Math.atan2(b.y-center.y,b.x-center.x),end=Math.atan2(c.y-center.y,c.x-center.x);
  if(!angleWithin(mid,start,end)){const tmp=start;start=end;end=tmp;}
  return{center,radius,start,end};
}

function selectedEntities(){return state.entities.filter(e=>state.selected.has(e.id));}
function cloneEntity(e,newId=true){const c=JSON.parse(JSON.stringify(e));if(newId)c.id=nextEntityId();return c;}
function performCopy(dx,dy){pushHistory();const copies=selectedEntities().map(e=>{const c=cloneEntity(e,true);translateEntity(c,dx,dy);return c;});state.entities.push(...copies);state.selected=new Set(copies.map(e=>e.id));afterGeometryChange();}
function performRotate(angle){
  const c=state.command,base=c?.data?.base;if(!base)return;pushHistory();for(const e of selectedEntities()){transformEntityPoints(e,q=>rotatePoint(q,base,angle));if(e.type==='TEXT')e.rotation=(e.rotation||0)+angle*180/Math.PI;}afterGeometryChange();toast(CMDT.rotated);
}
function performScale(factor){
  const c=state.command,base=c?.data?.base;if(!base)return;pushHistory();for(const e of selectedEntities())scaleEntity(e,base,factor);afterGeometryChange();toast(CMDT.scaled);
}
function performMirror(eraseSource){
  const c=state.command,a=c?.data?.p1,b=c?.data?.p2;if(!a||!b)return;pushHistory();const originals=selectedEntities(),copies=originals.map(e=>{const n=cloneEntity(e,true);mirrorEntity(n,a,b);return n;});state.entities.push(...copies);if(eraseSource)state.entities=state.entities.filter(e=>!state.selected.has(e.id));state.selected=new Set(copies.map(e=>e.id));afterGeometryChange();toast(CMDT.mirrored);
}
function rotatePoint(q,base,ang){const x=q.x-base.x,y=q.y-base.y,c=Math.cos(ang),s=Math.sin(ang);return{x:base.x+x*c-y*s,y:base.y+x*s+y*c};}
function transformEntityPoints(e,fn){
  if(e.type==='LINE'){Object.assign(e.p1,fn(copyPoint(e.p1)));Object.assign(e.p2,fn(copyPoint(e.p2)));}
  else if(e.type==='POLYLINE'){for(const p of e.points)Object.assign(p,fn(copyPoint(p)));}
  else if(e.type==='CIRCLE'){Object.assign(e.center,fn(copyPoint(e.center)));}
  else if(e.type==='ARC'){
    const center0=copyPoint(e.center),p10={x:center0.x+e.radius*Math.cos(e.start),y:center0.y+e.radius*Math.sin(e.start)},p20={x:center0.x+e.radius*Math.cos(e.end),y:center0.y+e.radius*Math.sin(e.end)};
    const center1=fn(center0),p1=fn(p10),p2=fn(p20);e.center=center1;e.start=Math.atan2(p1.y-center1.y,p1.x-center1.x);e.end=Math.atan2(p2.y-center1.y,p2.x-center1.x);
  }
  else if(e.type==='POINT'||e.type==='TEXT')Object.assign(e.point,fn(copyPoint(e.point)));
}
function scaleEntity(e,base,factor){
  const scalePt=q=>({x:base.x+(q.x-base.x)*factor,y:base.y+(q.y-base.y)*factor});
  if(e.type==='CIRCLE'||e.type==='ARC'){Object.assign(e.center,scalePt(e.center));e.radius*=Math.abs(factor);}
  else transformEntityPoints(e,scalePt);
  if(e.type==='TEXT')e.height*=Math.abs(factor);
}
function mirrorPoint(q,a,b){
  const vx=b.x-a.x,vy=b.y-a.y,l=vx*vx+vy*vy;if(l<1e-20)return copyPoint(q);const t=((q.x-a.x)*vx+(q.y-a.y)*vy)/l,px=a.x+t*vx,py=a.y+t*vy;return{x:2*px-q.x,y:2*py-q.y};
}
function mirrorEntity(e,a,b){
  if(e.type==='CIRCLE'){Object.assign(e.center,mirrorPoint(e.center,a,b));return;}
  if(e.type==='POLYLINE'){transformEntityPoints(e,q=>mirrorPoint(q,a,b));for(const p of e.points)p.bulge=-(p.bulge||0);return;}
  if(e.type==='ARC'){
    const center0=copyPoint(e.center),p1={x:center0.x+e.radius*Math.cos(e.start),y:center0.y+e.radius*Math.sin(e.start)},p2={x:center0.x+e.radius*Math.cos(e.end),y:center0.y+e.radius*Math.sin(e.end)};
    const mc=mirrorPoint(center0,a,b),m1=mirrorPoint(p1,a,b),m2=mirrorPoint(p2,a,b);e.center=mc;e.start=Math.atan2(m2.y-mc.y,m2.x-mc.x);e.end=Math.atan2(m1.y-mc.y,m1.x-mc.x);return;
  }
  transformEntityPoints(e,q=>mirrorPoint(q,a,b));
}

function offsetEntity(e,distance,sidePoint){
  const base={...newEntityBase(e.type),layer:e.layer,colorMode:e.colorMode,colorIndex:e.colorIndex,trueColor:e.trueColor};
  if(e.type==='LINE'){
    const dx=e.p2.x-e.p1.x,dy=e.p2.y-e.p1.y,len=Math.hypot(dx,dy);if(len<1e-12)return null;
    const nx=-dy/len,ny=dx/len,cross=dx*(sidePoint.y-e.p1.y)-dy*(sidePoint.x-e.p1.x),sgn=cross>=0?1:-1;
    return{...base,p1:{x:e.p1.x+nx*distance*sgn,y:e.p1.y+ny*distance*sgn},p2:{x:e.p2.x+nx*distance*sgn,y:e.p2.y+ny*distance*sgn}};
  }
  if(e.type==='CIRCLE'||e.type==='ARC'){
    const outward=dist(e.center,sidePoint)>=e.radius;const r=e.radius+(outward?distance:-distance);if(r<=1e-9)return null;
    return e.type==='CIRCLE'?{...base,center:copyPoint(e.center),radius:r}:{...base,center:copyPoint(e.center),radius:r,start:e.start,end:e.end};
  }
  return null;
}

function explodeSelected(){
  const targets=selectedEntities();if(!targets.length)return;pushHistory();const remove=new Set(),created=[];
  for(const e of targets){
    if(e.type!=='POLYLINE')continue;remove.add(e.id);const pts=e.points||[];
    for(let i=0;i<pts.length-1+(e.closed?1:0);i++){
      const a=pts[i%pts.length],b=pts[(i+1)%pts.length],bulge=a.bulge||0;
      if(Math.abs(bulge)<1e-10)created.push({...newEntityBase('LINE'),layer:e.layer,p1:copyPoint(a),p2:copyPoint(b)});
      else{
        const ba=bulgeArc(a,b,bulge);if(!ba)continue;let start=ba.start,end=ba.start+ba.span;if(ba.span<0){const t=start;start=end;end=t;}
        created.push({...newEntityBase('ARC'),layer:e.layer,center:ba.center,radius:ba.r,start,end});
      }
    }
  }
  state.entities=state.entities.filter(e=>!remove.has(e.id));state.entities.push(...created);state.selected=new Set(created.map(e=>e.id));afterGeometryChange();toast(CMDT.exploded);
}

function joinSelected(){
  const targets=selectedEntities().filter(e=>e.type==='LINE'||(e.type==='POLYLINE'&&e.points.every(p=>Math.abs(p.bulge||0)<1e-12)));
  if(targets.length<2)return commandError(FR?'Sélectionnez au moins deux lignes/polylignes droites.':'Select at least two straight lines/polylines.');
  const tol=Math.max((state.bounds?.width||1),(state.bounds?.height||1))*1e-8+1e-9;
  const paths=targets.map(e=>e.type==='LINE'?[copyPoint(e.p1),copyPoint(e.p2)]:e.points.map(copyPoint));
  let chain=paths.shift();
  while(paths.length){
    let found=-1,mode='';
    for(let i=0;i<paths.length;i++){
      const p=paths[i],a=chain[0],b=chain[chain.length-1],c=p[0],d=p[p.length-1];
      if(dist(b,c)<=tol){found=i;mode='bc';break;}if(dist(b,d)<=tol){found=i;mode='bd';break;}if(dist(a,d)<=tol){found=i;mode='ad';break;}if(dist(a,c)<=tol){found=i;mode='ac';break;}
    }
    if(found<0)return commandError(FR?'Les objets sélectionnés ne forment pas une chaîne continue.':'Selected objects do not form one continuous chain.');
    let p=paths.splice(found,1)[0];if(mode==='bd'||mode==='ac')p=p.reverse();if(mode==='bc'||mode==='bd')chain=chain.concat(p.slice(1));else chain=p.slice(0,-1).concat(chain);
  }
  pushHistory();const ids=new Set(targets.map(e=>e.id)),layer=targets[0].layer;state.entities=state.entities.filter(e=>!ids.has(e.id));const joined={...newEntityBase('POLYLINE'),layer,points:chain.map(q=>({...q,bulge:0})),closed:dist(chain[0],chain[chain.length-1])<=tol};state.entities.push(joined);state.selected=new Set([joined.id]);afterGeometryChange();toast(CMDT.joined);
}

function toggleDraftSetting(which){
  if(which==='grid')state.grid=!state.grid;
  else if(which==='gridSnap')state.gridSnap=!state.gridSnap;
  else if(which==='osnap')state.snap=!state.snap;
  else if(which==='otrack')state.otrack=!state.otrack;
  else if(which==='dyn')state.dyn=!state.dyn;
  else if(which==='ortho'){
    state.ortho=!state.ortho;if(state.ortho)state.polar=false;
    toast(state.ortho?CMDT.orthoOn:CMDT.orthoOff);
  }else if(which==='polar'){
    state.polar=!state.polar;if(state.polar)state.ortho=false;
    toast(state.polar?CMDT.polarOn:CMDT.polarOff);
  }
  if(which==='osnap')toast(state.snap?CMDT.osnapOn:CMDT.osnapOff);
  if(which==='gridSnap')toast(state.gridSnap?CMDT.gridSnapOn:CMDT.gridSnapOff);
  if(which==='otrack')toast(state.otrack?CMDT.otrackOn:CMDT.otrackOff);
  if(which==='dyn')toast(state.dyn?CMDT.dynOn:CMDT.dynOff);
  syncDraftingUI();
}
function syncDraftingUI(){
  E.grid?.classList.toggle('active',state.grid);E.snap?.classList.toggle('active',state.snap);
  E.statusGrid?.classList.toggle('active',state.grid);E.statusGridSnap?.classList.toggle('active',state.gridSnap);E.statusOrtho?.classList.toggle('active',state.ortho);E.statusPolar?.classList.toggle('active',state.polar);E.statusOsnap?.classList.toggle('active',state.snap);E.statusOtrack?.classList.toggle('active',state.otrack);E.statusDyn?.classList.toggle('active',state.dyn);
  if(E.polarAngle&&String(E.polarAngle.value)!==String(state.polarIncrement))E.polarAngle.value=String(state.polarIncrement);
}

function resolveDraftPoint(clientX,clientY,ignoreSnap=false){
  let raw=screenToWorld(clientX,clientY);state.draftingGuide=null;
  if(state.gridSnap){const step=Math.max(1e-12,state.gridSnapStep);raw={x:Math.round(raw.x/step)*step,y:Math.round(raw.y/step)*step};}
  const ref=commandReferencePoint();
  if(!ignoreSnap&&state.snap){
    const snap=nearestSnap(clientX,clientY,ref);if(snap){state.lastSnap=snap;return copyPoint(snap.point);}state.lastSnap=null;
  }
  if(ref&&state.otrack&&state.trackingPoint){
    const tol=8/state.view.scale,tx=state.trackingPoint.x,ty=state.trackingPoint.y;
    if(Math.abs(raw.x-tx)<=tol){raw.x=tx;state.draftingGuide={from:{x:tx,y:state.view.cy-100000/state.view.scale},to:{x:tx,y:state.view.cy+100000/state.view.scale},type:'track'};}
    else if(Math.abs(raw.y-ty)<=tol){raw.y=ty;state.draftingGuide={from:{x:state.view.cx-100000/state.view.scale,y:ty},to:{x:state.view.cx+100000/state.view.scale,y:ty},type:'track'};}
  }
  if(ref&&state.ortho){
    const dx=raw.x-ref.x,dy=raw.y-ref.y;raw=Math.abs(dx)>=Math.abs(dy)?{x:raw.x,y:ref.y}:{x:ref.x,y:raw.y};state.draftingGuide={from:ref,to:raw,type:'ortho'};
  }else if(ref&&state.polar){
    const dx=raw.x-ref.x,dy=raw.y-ref.y,d=Math.hypot(dx,dy);if(d>1e-12){const inc=state.polarIncrement*Math.PI/180,a=Math.atan2(dy,dx),snapA=Math.round(a/inc)*inc,diff=Math.abs(normalizeAngle(a-snapA));const aperture=5*Math.PI/180;if(diff<=aperture){raw={x:ref.x+d*Math.cos(snapA),y:ref.y+d*Math.sin(snapA)};state.draftingGuide={from:ref,to:raw,type:'polar',angle:snapA};}}
  }
  return raw;
}
function normalizeAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}

function nearestSnap(clientX,clientY,reference=null){
  const q=screenToWorld(clientX,clientY),tol=13/state.view.scale,modes=state.snapOverride?new Set([state.snapOverride]):state.osnapModes;
  const nearby=[],candidates=[];
  for(const e of state.entities){
    if(!layerVisible(e.layer))continue;
    const d=distanceToEntity(q,e);if(d<=tol*3)nearby.push(e);
    for(const s of entitySnapCandidates(e,reference,modes,q)){
      const dd=dist(q,s.point);if(dd<=tol)candidates.push({...s,entity:e,distance:dd});
    }
  }
  if(modes.has('intersection')&&nearby.length>1){
    const max=Math.min(nearby.length,14);for(let i=0;i<max;i++)for(let j=i+1;j<max;j++)for(const point of entityIntersections(nearby[i],nearby[j])){const dd=dist(q,point);if(dd<=tol)candidates.push({point,type:'intersection',entity:nearby[i],distance:dd});}
  }
  const priority={intersection:0,end:1,mid:2,center:3,gcenter:4,quad:5,perp:6,tangent:7,node:8,insert:9,nearest:20};
  candidates.sort((a,b)=>(priority[a.type]??10)-(priority[b.type]??10)||a.distance-b.distance);
  const unique=[];const seen=new Set();for(const c of candidates){const k=`${c.type}:${c.point.x.toFixed(7)},${c.point.y.toFixed(7)}`;if(seen.has(k))continue;seen.add(k);unique.push(c);}
  if(!unique.length){state.snapCandidateKey='';state.snapCycle=0;return null;}
  const fingerprint=unique.map(c=>`${c.type}:${c.point.x.toFixed(4)},${c.point.y.toFixed(4)}`).join('|');
  if(fingerprint!==state.snapCandidateKey){state.snapCandidateKey=fingerprint;state.snapCycle=0;}
  const best=unique[(state.snapCycle||0)%unique.length];
  const key=`${best.type}:${best.point.x.toFixed(7)},${best.point.y.toFixed(7)}`,now=performance.now();
  if(state.snapHoverKey===key){if(now-(state.snapHoverSince||now)>350)state.trackingPoint=copyPoint(best.point);}else{state.snapHoverKey=key;state.snapHoverSince=now;}
  return best;
}

function entitySnapCandidates(e,reference,modes,q){
  const out=[],add=(point,type)=>{if(modes.has(type)&&point&&Number.isFinite(point.x)&&Number.isFinite(point.y))out.push({point:copyPoint(point),type});};
  if(e.type==='LINE'){
    add(e.p1,'end');add(e.p2,'end');add({x:(e.p1.x+e.p2.x)/2,y:(e.p1.y+e.p2.y)/2},'mid');
    if(reference&&modes.has('perp'))add(projectPointToLine(reference,e.p1,e.p2,true),'perp');
  }else if(e.type==='POLYLINE'){
    const pts=e.points||[];for(const p of pts)add(p,'end');
    for(let i=0;i<pts.length-1+(e.closed?1:0);i++){
      const a=pts[i%pts.length],b=pts[(i+1)%pts.length],bulge=a.bulge||0;
      if(Math.abs(bulge)<1e-10){
        add({x:(a.x+b.x)/2,y:(a.y+b.y)/2},'mid');
        if(reference&&modes.has('perp'))add(projectPointToLine(reference,a,b,true),'perp');
      }else{
        const arc=bulgeArc(a,b,bulge);if(!arc)continue;const ma=arc.start+arc.span/2;
        add({x:arc.center.x+arc.r*Math.cos(ma),y:arc.center.y+arc.r*Math.sin(ma)},'mid');
        if(reference&&modes.has('perp')){
          const pa=Math.atan2(reference.y-arc.center.y,reference.x-arc.center.x);
          const pp={x:arc.center.x+arc.r*Math.cos(pa),y:arc.center.y+arc.r*Math.sin(pa)};
          const rel=normalizeAngle(pa-arc.start),span=arc.span;
          if((span>=0&&rel>=-1e-9&&rel<=span+1e-9)||(span<0&&rel<=1e-9&&rel>=span-1e-9))add(pp,'perp');
        }
      }
    }
    if(e.closed&&modes.has('gcenter'))add(polygonCentroid(polylineSamples(e)),'gcenter');
  }else if(e.type==='CIRCLE'||e.type==='ARC'){
    add(e.center,'center');
    const angles=e.type==='CIRCLE'?[0,Math.PI/2,Math.PI,Math.PI*1.5]:[0,Math.PI/2,Math.PI,Math.PI*1.5].filter(a=>angleWithin(a,e.start,e.end));
    for(const a of angles)add({x:e.center.x+e.radius*Math.cos(a),y:e.center.y+e.radius*Math.sin(a)},'quad');
    if(e.type==='ARC'){
      const a={x:e.center.x+e.radius*Math.cos(e.start),y:e.center.y+e.radius*Math.sin(e.start)},b={x:e.center.x+e.radius*Math.cos(e.end),y:e.center.y+e.radius*Math.sin(e.end)};add(a,'end');add(b,'end');const span=positiveSpan(e.start,e.end),mid=e.start+span/2;add({x:e.center.x+e.radius*Math.cos(mid),y:e.center.y+e.radius*Math.sin(mid)},'mid');
    }
    if(reference&&modes.has('perp')){
      const a=Math.atan2(reference.y-e.center.y,reference.x-e.center.x),pt={x:e.center.x+e.radius*Math.cos(a),y:e.center.y+e.radius*Math.sin(a)};if(e.type==='CIRCLE'||angleWithin(a,e.start,e.end))add(pt,'perp');
    }
    if(reference&&modes.has('tangent'))for(const pt of tangentPointsToCircle(reference,e.center,e.radius)){const a=Math.atan2(pt.y-e.center.y,pt.x-e.center.x);if(e.type==='CIRCLE'||angleWithin(a,e.start,e.end))add(pt,'tangent');}
  }else if(e.type==='POINT'){add(e.point,'node');}
  else if(e.type==='TEXT'){add(e.point,'node');add(e.point,'insert');}
  if(modes.has('nearest')){const nearest=nearestPointOnEntity(q,e);if(nearest)add(nearest,'nearest');}
  return out;
}
function polygonCentroid(points){
  if(!points?.length)return null;let twice=0,cx=0,cy=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cross=a.x*b.y-b.x*a.y;twice+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;}if(Math.abs(twice)<1e-12){let x=0,y=0;for(const p of points){x+=p.x;y+=p.y;}return{x:x/points.length,y:y/points.length};}return{x:cx/(3*twice),y:cy/(3*twice)};
}
function projectPointToLine(p,a,b,segment){const vx=b.x-a.x,vy=b.y-a.y,l=vx*vx+vy*vy;if(l<1e-20)return null;let t=((p.x-a.x)*vx+(p.y-a.y)*vy)/l;if(segment)t=clamp(t,0,1);return{x:a.x+t*vx,y:a.y+t*vy};}
function tangentPointsToCircle(p,c,r){const dx=p.x-c.x,dy=p.y-c.y,d2=dx*dx+dy*dy;if(d2<=r*r+1e-12)return[];const l=r*r/d2,m=r*Math.sqrt(d2-r*r)/d2;return[{x:c.x+l*dx-m*dy,y:c.y+l*dy+m*dx},{x:c.x+l*dx+m*dy,y:c.y+l*dy-m*dx}];}
function nearestPointOnEntity(q,e){
  if(e.type==='LINE')return projectPointToLine(q,e.p1,e.p2,true);
  if(e.type==='POLYLINE'){const s=polylineSamples(e);let best=null,bd=Infinity;for(let i=0;i<s.length-1;i++){const p=projectPointToLine(q,s[i],s[i+1],true),d=dist(q,p);if(d<bd){bd=d;best=p;}}return best;}
  if(e.type==='CIRCLE'||e.type==='ARC'){let a=Math.atan2(q.y-e.center.y,q.x-e.center.x);if(e.type==='ARC'&&!angleWithin(a,e.start,e.end)){const p1={x:e.center.x+e.radius*Math.cos(e.start),y:e.center.y+e.radius*Math.sin(e.start)},p2={x:e.center.x+e.radius*Math.cos(e.end),y:e.center.y+e.radius*Math.sin(e.end)};return dist(q,p1)<dist(q,p2)?p1:p2;}return{x:e.center.x+e.radius*Math.cos(a),y:e.center.y+e.radius*Math.sin(a)};}
  if(e.type==='POINT'||e.type==='TEXT')return copyPoint(e.point);return null;
}
function entityIntersections(a,b){
  const segs=e=>selectionSegments(e,selectionSamples(e));
  if((a.type==='LINE'||a.type==='POLYLINE')&&(b.type==='LINE'||b.type==='POLYLINE')){
    const out=[];for(const [p1,p2] of segs(a))for(const [q1,q2] of segs(b)){const p=lineLineIntersectionPoint(p1,p2,q1,q2);if(p)out.push(p);}return out;
  }
  if((a.type==='CIRCLE'||a.type==='ARC')&&(b.type==='CIRCLE'||b.type==='ARC'))return circleCircleIntersections(a,b).filter(p=>pointOnArcIfNeeded(p,a)&&pointOnArcIfNeeded(p,b));
  const curve=(a.type==='CIRCLE'||a.type==='ARC')?a:(b.type==='CIRCLE'||b.type==='ARC')?b:null,linear=curve===a?b:a;
  if(curve&&(linear.type==='LINE'||linear.type==='POLYLINE')){
    const out=[];for(const [p1,p2] of segs(linear))for(const p of lineCircleIntersections(p1,p2,curve.center,curve.radius))if(pointOnArcIfNeeded(p,curve))out.push(p);return out;
  }
  return[];
}
function lineLineIntersectionPoint(a,b,c,d){const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;if(Math.abs(den)<1e-12)return null;const qx=c.x-a.x,qy=c.y-a.y,t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;if(t<-1e-9||t>1+1e-9||u<-1e-9||u>1+1e-9)return null;return{x:a.x+t*rx,y:a.y+t*ry};}
function lineCircleIntersections(a,b,c,r){const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-c.x,fy=a.y-c.y,A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r,disc=B*B-4*A*C;if(A<1e-20||disc<-1e-12)return[];const d=Math.sqrt(Math.max(0,disc)),out=[];for(const t of[(-B-d)/(2*A),(-B+d)/(2*A)])if(t>=-1e-9&&t<=1+1e-9)out.push({x:a.x+t*dx,y:a.y+t*dy});return out;}
function circleCircleIntersections(a,b){const c0=a.center,c1=b.center,r0=a.radius,r1=b.radius,dx=c1.x-c0.x,dy=c1.y-c0.y,d=Math.hypot(dx,dy);if(d<1e-12||d>r0+r1+1e-9||d<Math.abs(r0-r1)-1e-9)return[];const x=(r0*r0-r1*r1+d*d)/(2*d),h=Math.sqrt(Math.max(0,r0*r0-x*x)),ux=dx/d,uy=dy/d,px=c0.x+x*ux,py=c0.y+x*uy;return h<1e-12?[{x:px,y:py}]:[{x:px-h*uy,y:py+h*ux},{x:px+h*uy,y:py-h*ux}];}
function pointOnArcIfNeeded(p,e){if(e.type!=='ARC')return true;return angleWithin(Math.atan2(p.y-e.center.y,p.x-e.center.x),e.start,e.end);}

function drawSnapMarker(){
  if(!state.file||!state.snap)return;const snap=state.lastSnap;if(!snap)return;const s=worldToScreen(snap.point);ctx.save();ctx.strokeStyle='#ffe45c';ctx.fillStyle='#ffe45c';ctx.lineWidth=1.5;const z=6;
  if(snap.type==='end'){ctx.strokeRect(s.x-z/2,s.y-z/2,z,z);}
  else if(snap.type==='mid'){ctx.beginPath();ctx.moveTo(s.x,s.y-z);ctx.lineTo(s.x+z,s.y+z/2);ctx.lineTo(s.x-z,s.y+z/2);ctx.closePath();ctx.stroke();}
  else if(snap.type==='center'){ctx.beginPath();ctx.arc(s.x,s.y,z/2,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(s.x-z,s.y);ctx.lineTo(s.x+z,s.y);ctx.moveTo(s.x,s.y-z);ctx.lineTo(s.x,s.y+z);ctx.stroke();}
  else if(snap.type==='quad'){ctx.beginPath();ctx.moveTo(s.x,s.y-z);ctx.lineTo(s.x+z,s.y);ctx.lineTo(s.x,s.y+z);ctx.lineTo(s.x-z,s.y);ctx.closePath();ctx.stroke();}
  else if(snap.type==='intersection'){ctx.beginPath();ctx.moveTo(s.x-z,s.y-z);ctx.lineTo(s.x+z,s.y+z);ctx.moveTo(s.x+z,s.y-z);ctx.lineTo(s.x-z,s.y+z);ctx.stroke();}
  else if(snap.type==='perp'){ctx.beginPath();ctx.moveTo(s.x-z,s.y+z);ctx.lineTo(s.x-z,s.y-z);ctx.lineTo(s.x+z,s.y-z);ctx.stroke();}
  else if(snap.type==='tangent'){ctx.beginPath();ctx.arc(s.x,s.y,z/2,0,Math.PI*2);ctx.stroke();ctx.fillRect(s.x+z/2,s.y-z,2,z*2);}
  else{ctx.beginPath();ctx.arc(s.x,s.y,2.5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function drawDraftingGuides(){
  const guide=state.draftingGuide;if(guide){const a=worldToScreen(guide.from),b=worldToScreen(guide.to);ctx.save();ctx.strokeStyle=guide.type==='track'?'rgba(255,220,70,.66)':'rgba(90,160,255,.58)';ctx.lineWidth=1;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();}
  if(!state.dyn||!state.file)return;const p=state.cursorPoint||resolveDraftPoint(state.pointer.x,state.pointer.y),ref=commandReferencePoint(),r=E.canvas.getBoundingClientRect(),x=state.pointer.x-r.left+16,y=state.pointer.y-r.top+18;let text='';
  if(ref){const dx=p.x-ref.x,dy=p.y-ref.y;text=`${fmt(Math.hypot(dx,dy))} < ${fmt(radToDeg(Math.atan2(dy,dx)))}°`;}
  else text=`X ${fmt(p.x)}  Y ${fmt(p.y)}`;
  if(state.lastSnap)text+=`  ${snapLabel(state.lastSnap.type)}`;
  ctx.save();ctx.font='800 9px ui-monospace,SFMono-Regular,Menlo,monospace';const w=ctx.measureText(text).width+12;ctx.fillStyle='rgba(5,10,14,.94)';ctx.strokeStyle='rgba(0,109,255,.55)';ctx.lineWidth=1;ctx.fillRect(x,y,w,20);ctx.strokeRect(x+.5,y+.5,w-1,19);ctx.fillStyle='#d7e6ee';ctx.fillText(text,x+6,y+13);ctx.restore();
}
function snapLabel(type){return({end:'END',mid:'MID',center:'CEN',quad:'QUA',intersection:'INT',perp:'PER',tangent:'TAN',nearest:'NEA',node:'NOD',gcenter:'GCEN',insert:'INS'})[type]||type.toUpperCase();}

function drawCommandPreview(){
  const c=state.command;if(!c||c.selecting||!state.file)return;const p=state.cursorPoint||resolveDraftPoint(state.pointer.x,state.pointer.y);ctx.save();ctx.strokeStyle='#7bc4ff';ctx.fillStyle='#7bc4ff';ctx.lineWidth=1.2;ctx.setLineDash([6,4]);
  const line=(a,b)=>{const x=worldToScreen(a),y=worldToScreen(b);ctx.beginPath();ctx.moveTo(x.x,x.y);ctx.lineTo(y.x,y.y);ctx.stroke();};
  if((c.name==='LINE'||c.name==='PLINE')&&c.points.length)line(c.points[c.points.length-1],p);
  else if(c.name==='CIRCLE'&&c.step==='radius'&&c.points[0]){const cc=worldToScreen(c.points[0]);ctx.beginPath();ctx.arc(cc.x,cc.y,dist(c.points[0],p)*state.view.scale,0,Math.PI*2);ctx.stroke();}
  else if(c.name==='RECTANG'&&c.points[0]){const a=c.points[0],pts=[a,{x:p.x,y:a.y},p,{x:a.x,y:p.y},a];for(let i=0;i<4;i++)line(pts[i],pts[i+1]);}
  else if(c.name==='ARC'&&c.points.length===1)line(c.points[0],p);
  else if(c.name==='ARC'&&c.points.length===2){const arc=arcFrom3Points(c.points[0],c.points[1],p);if(arc)drawPreviewArc(arc);else line(c.points[1],p);}
  else if(['MOVE','COPY'].includes(c.name)&&c.step==='target'&&c.data.base){const dx=p.x-c.data.base.x,dy=p.y-c.data.base.y;drawSelectedPreview(e=>{const n=cloneEntity(e,false);translateEntity(n,dx,dy);return n;});}
  else if(c.name==='ROTATE'&&c.step==='angle'&&c.data.base){const a=Math.atan2(p.y-c.data.base.y,p.x-c.data.base.x);drawSelectedPreview(e=>{const n=cloneEntity(e,false);transformEntityPoints(n,q=>rotatePoint(q,c.data.base,a));return n;});}
  else if(c.name==='MIRROR'&&c.step==='mirror2'&&c.data.p1){line(c.data.p1,p);drawSelectedPreview(e=>{const n=cloneEntity(e,false);mirrorEntity(n,c.data.p1,p);return n;});}
  ctx.restore();
}
function drawPreviewArc(e){const c=worldToScreen(e.center);ctx.save();ctx.translate(c.x,c.y);ctx.scale(1,-1);ctx.beginPath();ctx.arc(0,0,e.radius*state.view.scale,e.start,e.start+positiveSpan(e.start,e.end));ctx.stroke();ctx.restore();}
function drawSelectedPreview(transform){ctx.save();ctx.globalAlpha=.68;ctx.setLineDash([6,4]);for(const e of selectedEntities())drawEntity(transform(e),'#7bc4ff',1.2);ctx.restore();}

function openOsnapQuickMenu(clientX,clientY){
  closeContextMenu();const menu=document.createElement('div');menu.className='n2-context-menu';
  for(const [key,label] of Object.entries({end:'Endpoint',mid:'Midpoint',center:'Center',quad:'Quadrant',intersection:'Intersection',perp:'Perpendicular',tangent:'Tangent',nearest:'Nearest',node:'Node',gcenter:'Geometric Center',insert:'Insertion'})){
    const b=document.createElement('button');b.type='button';b.innerHTML=`<span>${label}</span><span>${snapLabel(key)}</span>`;b.addEventListener('click',()=>{state.snapOverride=key;closeContextMenu();commandLog(`${snapLabel(key)} (${FR?'prochain point':'next point'})`);});menu.append(b);
  }
  document.body.append(menu);contextMenuEl=menu;const r=menu.getBoundingClientRect();menu.style.left=`${Math.min(clientX,innerWidth-r.width-8)}px`;menu.style.top=`${Math.min(clientY,innerHeight-r.height-8)}px`;
}
