import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FR=document.documentElement.lang.toLowerCase().startsWith('fr');
const T=FR?{
no:'Aucun modèle chargé',loading:'Chargement...',analysing:'Analyse de la géométrie...',
stepInit:'Initialisation du moteur STEP local…',stepParse:'Conversion STEP sur votre PC…',
loaded:'chargé',unsupported:'Utilisez un fichier STEP, STP, STL, OBJ, GLB ou GLTF.',
large:'Un fichier dépasse la limite de 250 Mo.',total:'La sélection dépasse 500 Mo.',
error:'Impossible de charger ce modèle.',stepError:'Impossible de convertir ce fichier STEP.',
webgl:"WebGL n'est pas disponible.",complex:'Trop complexe',shot:'navoflo-3d-inspector.png',
pcOk:'Compatible STEP',pcLimited:'Compatible, mais limité pour les gros STEP',pcUnknown:'Compatibilité partielle à vérifier',
wasm:'WebAssembly',webgl2:'WebGL2',threads:'threads',ram:'RAM'
}:{no:'No model loaded',loading:'Loading...',analysing:'Analyzing geometry...',
stepInit:'Initializing local STEP engine…',stepParse:'Converting STEP on your PC…',
loaded:'loaded',unsupported:'Use a STEP, STP, STL, OBJ, GLB or GLTF file.',
large:'A file exceeds the 250 MB limit.',total:'The selected files exceed 500 MB.',
error:'Unable to load this model.',stepError:'Unable to convert this STEP file.',
webgl:'WebGL is not available.',complex:'Too complex',shot:'navoflo-3d-inspector.png',
pcOk:'STEP compatible',pcLimited:'Compatible, but limited for large STEP files',pcUnknown:'Partial compatibility check',
wasm:'WebAssembly',webgl2:'WebGL2',threads:'threads',ram:'RAM'};

const MAX_FILE=250*1024*1024,MAX_TOTAL=500*1024*1024,MAX_TRI=1500000;
const $=id=>document.getElementById(id);
const E={
stage:$('viewer-stage'),canvas:$('viewer-canvas'),drop:$('drop-zone'),input:$('file-input'),
status:$('file-status'),empty:$('stage-empty'),overlay:$('loading-overlay'),loading:$('loading-label'),
clear:$('clear-model'),fit:$('fit-view'),shot:$('screenshot'),wire:$('wireframe-toggle'),
grid:$('grid-toggle'),units:$('unit-select'),clip:$('clip-toggle'),axis:$('clip-axis'),slider:$('clip-slider'),
format:$('stat-format'),size:$('stat-filesize'),meshes:$('stat-meshes'),vertices:$('stat-vertices'),
triangles:$('stat-triangles'),x:$('dim-x'),y:$('dim-y'),z:$('dim-z'),surface:$('stat-surface'),volume:$('stat-volume'),
pc:$('pc-check')
};

let renderer,scene,camera,controls,rootGroup,grid,model=null,bounds=null,stats=null,format='',fileSize=0;
let blobUrls=[],resourceMap=new Map(),original=new WeakMap(),baseUnit='u';
let stepWorker=null,stepRequest=0,stepResolvers=new Map();
const clipPlane=new THREE.Plane(new THREE.Vector3(1,0,0),0);

init();

function init(){
  try{renderer=new THREE.WebGLRenderer({canvas:E.canvas,antialias:true,preserveDrawingBuffer:true});}
  catch(e){fail(T.webgl);updatePCCheck(false);return}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.localClippingEnabled=true;renderer.setClearColor(0x0a1016,1);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.01,100000);camera.position.set(5,4,5);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.screenSpacePanning=true;
  scene.add(new THREE.HemisphereLight(0xdcecff,0x1c2730,2.2));
  const a=new THREE.DirectionalLight(0xffffff,2.2);a.position.set(4,7,6);scene.add(a);
  const b=new THREE.DirectionalLight(0x7adfbd,1.1);b.position.set(-5,2,-4);scene.add(b);
  rootGroup=new THREE.Group();scene.add(rootGroup);makeGrid(10);
  bind();resize();updatePCCheck(true);renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
}

function bind(){
  addEventListener('resize',resize);
  E.input.addEventListener('change',e=>{if(e.target.files?.length)load([...e.target.files]);e.target.value=''});
  ['dragenter','dragover'].forEach(n=>E.drop.addEventListener(n,e=>{e.preventDefault();E.drop.classList.add('dragging')}));
  ['dragleave','drop'].forEach(n=>E.drop.addEventListener(n,e=>{e.preventDefault();E.drop.classList.remove('dragging')}));
  E.drop.addEventListener('drop',e=>{const f=[...(e.dataTransfer?.files||[])];if(f.length)load(f)});
  E.drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();E.input.click()}});
  E.clear.addEventListener('click',()=>clear());
  E.fit.addEventListener('click',()=>fit('iso'));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>fit(b.dataset.view)));
  E.grid.addEventListener('change',()=>grid.visible=E.grid.checked);
  E.wire.addEventListener('change',materials);
  [E.clip,E.axis,E.slider].forEach(el=>el.addEventListener(el===E.slider?'input':'change',clipping));
  E.units.addEventListener('change',showStats);
  E.shot.addEventListener('click',screenshot);
  addEventListener('beforeunload',()=>{revoke();stepWorker?.terminate()});
}

function resize(){
  if(!renderer)return;const r=E.stage.getBoundingClientRect(),w=Math.max(1,r.width|0),h=Math.max(1,r.height|0);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}

async function load(files){
  if(files.some(f=>f.size>MAX_FILE)){fail(T.large);return}
  if(files.reduce((s,f)=>s+f.size,0)>MAX_TOTAL){fail(T.total);return}
  const main=files.find(f=>['step','stp','stl','obj','glb','gltf'].includes(ext(f.name)));
  if(!main){fail(T.unsupported);return}
  clear(false);busy(true,T.loading);
  try{
    mapResources(files);format=ext(main.name).toUpperCase();fileSize=main.size;
    baseUnit=(format==='STEP'||format==='STP')?'mm':'u';
    E.units.value=baseUnit==='mm'?'mm':'u';

    const object=await parse(main);if(!object)throw Error('Empty model');
    model=object;rootGroup.add(model);centerModel();remember(model);materials();enable(true);
    E.empty.classList.add('hidden');E.status.className='file-status loaded';E.status.textContent=`${main.name} · ${T.loaded}`;
    busy(true,T.analysing);await frame();stats=analyse(model);showStats();fit('iso');
  }catch(err){
    console.error('[NavoFlo 3D Inspector]',err);
    const wasStep=format==='STEP'||format==='STP';
    const details=err?.message?` — ${err.message}`:'';
    clear(false);
    fail(wasStep?`${T.stepError}${details}`:`${T.error}${details}`)
  }finally{busy(false)}
}

function ext(n){return n.split('.').pop().toLowerCase()}

function mapResources(files){
  revoke();resourceMap=new Map();
  for(const f of files){const u=URL.createObjectURL(f);blobUrls.push(u);resourceMap.set(f.name,u);resourceMap.set(f.name.toLowerCase(),u)}
}

async function parse(file){
  const e=ext(file.name);
  if(e==='step'||e==='stp'){
    busy(true,T.stepInit);await frame();
    const result=await readStepLocally(file);
    busy(true,T.stepParse);await frame();
    return buildOcctObject(result);
  }
  if(e==='stl'){
    const g=new STLLoader().parse(await file.arrayBuffer());g.computeVertexNormals();
    return new THREE.Mesh(g,defaultMaterial());
  }
  if(e==='obj'){
    const o=new OBJLoader().parse(await file.text());
    o.traverse(c=>{if(c.isMesh){disposeMat(c.material);c.material=defaultMaterial();if(!c.geometry.attributes.normal)c.geometry.computeVertexNormals()}});
    return o;
  }
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{
    const clean=decodeURIComponent(url.split('?')[0].split('#')[0]),base=clean.split('/').pop();
    return resourceMap.get(clean)||resourceMap.get(clean.toLowerCase())||resourceMap.get(base)||resourceMap.get(base?.toLowerCase())||url;
  });
  const loader=new GLTFLoader(manager),data=e==='gltf'?await file.text():await file.arrayBuffer();
  return await new Promise((ok,no)=>loader.parse(data,'',g=>ok(g.scene||g.scenes?.[0]),no));
}

async function readStepLocally(file){
  const worker=getStepWorker();
  const buffer=await file.arrayBuffer();
  const id=++stepRequest;

  return await new Promise((resolve,reject)=>{
    stepResolvers.set(id,{resolve,reject});
    worker.postMessage({id,buffer},[buffer]);
  });
}

function getStepWorker(){
  if(stepWorker)return stepWorker;
  if(typeof Worker==='undefined')throw new Error('Web Workers are not supported.');

  stepWorker=new Worker('/js/step-worker.js');
  stepWorker.onmessage=(event)=>{
    const data=event.data||{};
    if(data.type==='engine-error'){
      console.error('[NavoFlo STEP engine]',data.error);
      for(const {reject} of stepResolvers.values())reject(new Error(data.error||'STEP engine failed.'));
      stepResolvers.clear();
      return;
    }
    const {id,ok,result,error}=data;
    const pending=stepResolvers.get(id);if(!pending)return;
    stepResolvers.delete(id);
    ok?pending.resolve(result):pending.reject(new Error(error||'STEP import failed.'));
  };
  stepWorker.onerror=(event)=>{
    for(const {reject} of stepResolvers.values())reject(new Error(event.message||'STEP worker failed.'));
    stepResolvers.clear();
    stepWorker?.terminate();stepWorker=null;
  };
  return stepWorker;
}

function buildOcctObject(result){
  const group=new THREE.Group();
  for(const source of result.meshes||[]){
    const geometry=new THREE.BufferGeometry();
    const positions=source.attributes?.position?.array;
    if(!positions?.length)continue;

    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    if(source.attributes?.normal?.array?.length){
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(source.attributes.normal.array,3));
    }else{
      geometry.computeVertexNormals();
    }

    const index=Uint32Array.from(source.index?.array||[]);
    if(index.length)geometry.setIndex(new THREE.BufferAttribute(index,1));
    geometry.name=source.name||'STEP mesh';

    const baseColor=source.color?new THREE.Color(source.color[0],source.color[1],source.color[2]):new THREE.Color(0x93b5aa);
    const baseMaterial=cadMaterial(baseColor);
    const materialsList=[baseMaterial];

    const faces=source.brep_faces||[];
    if(index.length&&faces.length){
      for(const face of faces){
        const color=face.color?new THREE.Color(face.color[0],face.color[1],face.color[2]):baseColor;
        materialsList.push(cadMaterial(color));
      }
      const triangleCount=index.length/3;
      let tri=0,faceIndex=0;
      while(tri<triangleCount){
        const start=tri;let end,materialIndex;
        if(faceIndex>=faces.length){end=triangleCount;materialIndex=0}
        else if(tri<faces[faceIndex].first){end=faces[faceIndex].first;materialIndex=0}
        else{end=faces[faceIndex].last+1;materialIndex=faceIndex+1;faceIndex++}
        if(end<=start){tri++;continue}
        geometry.addGroup(start*3,(end-start)*3,materialIndex);tri=end;
      }
    }

    const mesh=new THREE.Mesh(geometry,materialsList.length>1?materialsList:baseMaterial);
    mesh.name=source.name||'STEP mesh';
    group.add(mesh);
  }
  if(group.children.length===0)throw new Error('STEP import returned no meshes.');
  return group;
}

function cadMaterial(color){
  return new THREE.MeshStandardMaterial({color,metalness:.08,roughness:.58,side:THREE.DoubleSide});
}
function defaultMaterial(){return new THREE.MeshStandardMaterial({color:0x93b5aa,metalness:.18,roughness:.5,side:THREE.DoubleSide})}

function centerModel(){
  rootGroup.position.set(0,0,0);rootGroup.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(model);if(box.isEmpty())throw Error('No geometry');
  const c=box.getCenter(new THREE.Vector3());rootGroup.position.copy(c).multiplyScalar(-1);rootGroup.updateMatrixWorld(true);
  bounds=new THREE.Box3().setFromObject(model);const s=bounds.getSize(new THREE.Vector3());makeGrid(nice(Math.max(s.x,s.y,s.z,1)*1.6));
  grid.position.y=bounds.min.y-Math.max(s.x,s.y,s.z,1)*.005;
}

function makeGrid(size){
  if(grid){scene.remove(grid);grid.geometry.dispose();grid.material.dispose()}
  grid=new THREE.GridHelper(size,20,0x294139,0x1a2925);grid.material.opacity=.46;grid.material.transparent=true;grid.visible=E.grid.checked;scene.add(grid);
}
function nice(v){const p=10**Math.floor(Math.log10(v)),s=v/p;return(s<=1?1:s<=2?2:s<=5?5:10)*p}

function remember(o){
  o.traverse(c=>{if(!c.isMesh)return;for(const m of mats(c.material))if(m&&!original.has(m))original.set(m,{wire:!!m.wireframe,clip:m.clippingPlanes||null})});
}
function mats(m){return Array.isArray(m)?m:[m]}
function materials(){
  if(!model)return;model.traverse(c=>{if(!c.isMesh)return;for(const m of mats(c.material)){if(!m)continue;const old=original.get(m)||{};
    if('wireframe'in m)m.wireframe=E.wire.checked||!!old.wire;m.clippingPlanes=E.clip.checked?[clipPlane]:(old.clip||null);m.needsUpdate=true}});
}
function clipping(){
  const on=!!model&&E.clip.checked;E.axis.disabled=!on;E.slider.disabled=!on;
  const a=E.axis.value;clipPlane.normal.set(a==='x'?1:0,a==='y'?1:0,a==='z'?1:0);
  if(bounds){const s=bounds.getSize(new THREE.Vector3()),len=a==='x'?s.x:a==='y'?s.y:s.z;clipPlane.constant=-(+E.slider.value/200)*len}
  materials();
}

function analyse(o){
  o.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(o);
  let meshCount=0,verts=0,tris=0;
  o.traverse(c=>{if(!c.isMesh||!c.geometry)return;const p=c.geometry.getAttribute('position');if(!p)return;meshCount++;verts+=p.count;tris+=Math.floor((c.geometry.index?c.geometry.index.count:p.count)/3)});
  let surface=null,volume=null;if(tris<=MAX_TRI){const g=surfaceVolume(o);surface=g.surface;volume=g.volume}
  return{meshCount,verts,tris,surface,volume,size:bounds.getSize(new THREE.Vector3())};
}

function surfaceVolume(o){
  let surface=0,volume=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),cr=new THREE.Vector3(),bc=new THREE.Vector3();
  o.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry)return;const g=mesh.geometry,p=g.getAttribute('position');if(!p)return;const ix=g.index,n=Math.floor((ix?ix.count:p.count)/3);let mv=0;
    for(let i=0;i<n;i++){
      const ia=ix?ix.getX(i*3):i*3,ib=ix?ix.getX(i*3+1):i*3+1,ic=ix?ix.getX(i*3+2):i*3+2;
      a.fromBufferAttribute(p,ia).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,ib).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,ic).applyMatrix4(mesh.matrixWorld);
      ab.subVectors(b,a);ac.subVectors(c,a);cr.crossVectors(ab,ac);surface+=cr.length()*.5;bc.crossVectors(b,c);mv+=a.dot(bc)/6;
    }volume+=Math.abs(mv)
  });return{surface,volume}
}

function showStats(){
  if(!stats){resetStats();return}
  const target=E.units.value;
  const f=unitFactor(baseUnit,target);
  E.format.textContent=format;E.size.textContent=bytes(fileSize);E.meshes.textContent=numInt(stats.meshCount);E.vertices.textContent=numInt(stats.verts);E.triangles.textContent=numInt(stats.tris);
  E.x.textContent=`${num(stats.size.x*f)} ${target}`;E.y.textContent=`${num(stats.size.y*f)} ${target}`;E.z.textContent=`${num(stats.size.z*f)} ${target}`;
  E.surface.textContent=stats.surface==null?T.complex:`${num(stats.surface*f*f)} ${target}²`;E.volume.textContent=stats.volume==null?T.complex:`${num(stats.volume*f*f*f)} ${target}³`;
}

function unitFactor(from,to){
  if(from==='u'||to==='u')return 1;
  const toMM={mm:1,cm:10,m:1000,in:25.4};
  return toMM[from]/toMM[to];
}

function fit(view='iso'){
  if(!bounds)return;const sp=bounds.getBoundingSphere(new THREE.Sphere()),r=Math.max(sp.radius,.001),f=THREE.MathUtils.degToRad(camera.fov),d=r/Math.sin(f/2)*1.15;
  const dirs={iso:[1,.8,1],front:[0,0,1],right:[1,0,0],top:[0,1,0]},v=new THREE.Vector3(...(dirs[view]||dirs.iso)).normalize();
  camera.position.copy(v.multiplyScalar(d));camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);camera.near=Math.max(d/1000,.001);camera.far=Math.max(d*100,1000);camera.updateProjectionMatrix();
  controls.target.set(0,0,0);controls.update();
}

function enable(on){
  [E.clear,E.fit,E.shot,E.wire,E.clip].forEach(x=>x.disabled=!on);document.querySelectorAll('[data-view]').forEach(x=>x.disabled=!on);
  if(!on){E.clip.checked=false;E.axis.disabled=true;E.slider.disabled=true}
}

function clear(message=true){
  if(model){rootGroup.remove(model);dispose(model)}model=null;rootGroup?.position.set(0,0,0);bounds=null;stats=null;format='';fileSize=0;baseUnit='u';original=new WeakMap();revoke();resetStats();enable(false);
  E.wire.checked=false;E.clip.checked=false;E.slider.value=0;E.units.value='u';E.empty.classList.remove('hidden');if(grid)grid.position.y=0;
  if(message){E.status.className='file-status';E.status.textContent=T.no}
}

function updatePCCheck(webglAvailable=true){
  if(!E.pc)return;
  const wasm=typeof WebAssembly==='object';
  let webgl2=false;
  try{webgl2=webglAvailable&&!!document.createElement('canvas').getContext('webgl2')}catch{}
  const threads=navigator.hardwareConcurrency||null;
  const ram=navigator.deviceMemory||null;

  const requiredOk=wasm&&webgl2;
  const cpuOk=threads==null||threads>=4;
  const ramOk=ram==null||ram>=8;
  const good=requiredOk&&cpuOk&&ramOk;
  const limited=requiredOk&&!good;

  const parts=[
    `${T.wasm}: ${wasm?'✓':'✕'}`,
    `${T.webgl2}: ${webgl2?'✓':'✕'}`,
    `${T.threads}: ${threads??'?'}`,
    `${T.ram}: ${ram?`${ram} GB+`:'?'}`
  ];
  E.pc.className='pc-check '+(good?'ok':limited?'warn':'bad');
  E.pc.textContent=`${good?T.pcOk:limited?T.pcLimited:T.pcUnknown} · ${parts.join(' · ')}`;
}

function dispose(o){o.traverse(c=>{if(c.isMesh){c.geometry?.dispose();for(const m of mats(c.material))disposeMat(m)}})}
function disposeMat(m){if(!m)return;for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose?.()}
function revoke(){for(const u of blobUrls)try{URL.revokeObjectURL(u)}catch{}blobUrls=[];resourceMap=new Map()}
function resetStats(){[E.format,E.size,E.meshes,E.vertices,E.triangles,E.x,E.y,E.z,E.surface,E.volume].forEach(x=>x.textContent='—')}
function fail(s){E.status.className='file-status error';E.status.textContent=s}
function busy(on,label=T.loading){E.overlay.hidden=!on;E.loading.textContent=label}
function frame(){return new Promise(r=>requestAnimationFrame(r))}
function bytes(v){if(!v)return'0 B';const u=['B','KB','MB','GB'],p=Math.min(Math.floor(Math.log(v)/Math.log(1024)),3),n=v/1024**p;return`${n.toFixed(n>=100?0:n>=10?1:2)} ${u[p]}`}
function numInt(v){return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{maximumFractionDigits:0}).format(v||0)}
function num(v){if(!Number.isFinite(v))return'—';const a=Math.abs(v),d=a>=1000?1:a>=100?2:a>=1?3:5;return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{maximumFractionDigits:d}).format(v)}
function screenshot(){if(!model)return;renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=T.shot;a.click()}
