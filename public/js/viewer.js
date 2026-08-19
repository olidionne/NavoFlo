import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FR=document.documentElement.lang.toLowerCase().startsWith('fr');
const T=FR?{
no:'Aucun modèle chargé',loading:'Chargement...',analysing:'Analyse de la géométrie...',
loaded:'chargé',unsupported:'Utilisez un fichier STL, OBJ, GLB ou GLTF.',
large:'Un fichier dépasse la limite de 250 Mo.',total:'La sélection dépasse 500 Mo.',
error:'Impossible de charger ce modèle.',webgl:"WebGL n'est pas disponible.",complex:'Trop complexe',
shot:'navoflo-3d-inspector.png'
}:{no:'No model loaded',loading:'Loading...',analysing:'Analyzing geometry...',loaded:'loaded',
unsupported:'Use an STL, OBJ, GLB or GLTF file.',large:'A file exceeds the 250 MB limit.',
total:'The selected files exceed 500 MB.',error:'Unable to load this model.',webgl:'WebGL is not available.',
complex:'Too complex',shot:'navoflo-3d-inspector.png'};

const MAX_FILE=250*1024*1024,MAX_TOTAL=500*1024*1024,MAX_TRI=1500000;
const $=id=>document.getElementById(id);
const E={
stage:$('viewer-stage'),canvas:$('viewer-canvas'),drop:$('drop-zone'),input:$('file-input'),
status:$('file-status'),empty:$('stage-empty'),overlay:$('loading-overlay'),loading:$('loading-label'),
clear:$('clear-model'),fit:$('fit-view'),shot:$('screenshot'),wire:$('wireframe-toggle'),
grid:$('grid-toggle'),units:$('unit-select'),clip:$('clip-toggle'),axis:$('clip-axis'),slider:$('clip-slider'),
format:$('stat-format'),size:$('stat-filesize'),meshes:$('stat-meshes'),vertices:$('stat-vertices'),
triangles:$('stat-triangles'),x:$('dim-x'),y:$('dim-y'),z:$('dim-z'),surface:$('stat-surface'),volume:$('stat-volume')
};

let renderer,scene,camera,controls,rootGroup,grid,model=null,bounds=null,stats=null,format='',fileSize=0;
let blobUrls=[],resourceMap=new Map(),original=new WeakMap();
const clipPlane=new THREE.Plane(new THREE.Vector3(1,0,0),0);

init();

function init(){
  try{renderer=new THREE.WebGLRenderer({canvas:E.canvas,antialias:true,preserveDrawingBuffer:true});}
  catch(e){fail(T.webgl);return}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.localClippingEnabled=true;renderer.setClearColor(0x0a1016,1);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.01,100000);camera.position.set(5,4,5);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.screenSpacePanning=true;
  scene.add(new THREE.HemisphereLight(0xdcecff,0x1c2730,2.2));
  const a=new THREE.DirectionalLight(0xffffff,2.2);a.position.set(4,7,6);scene.add(a);
  const b=new THREE.DirectionalLight(0x7adfbd,1.1);b.position.set(-5,2,-4);scene.add(b);
  rootGroup=new THREE.Group();scene.add(rootGroup);makeGrid(10);
  bind();resize();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
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
  addEventListener('beforeunload',revoke);
}

function resize(){
  if(!renderer)return;const r=E.stage.getBoundingClientRect(),w=Math.max(1,r.width|0),h=Math.max(1,r.height|0);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}

async function load(files){
  if(files.some(f=>f.size>MAX_FILE)){fail(T.large);return}
  if(files.reduce((s,f)=>s+f.size,0)>MAX_TOTAL){fail(T.total);return}
  const main=files.find(f=>['stl','obj','glb','gltf'].includes(ext(f.name)));
  if(!main){fail(T.unsupported);return}
  clear(false);busy(true,T.loading);
  try{
    mapResources(files);format=ext(main.name).toUpperCase();fileSize=main.size;
    const object=await parse(main);if(!object)throw Error('Empty model');
    model=object;rootGroup.add(model);centerModel();remember(model);materials();enable(true);
    E.empty.classList.add('hidden');E.status.className='file-status loaded';E.status.textContent=`${main.name} · ${T.loaded}`;
    busy(true,T.analysing);await frame();stats=analyse(model);showStats();fit('iso');
  }catch(err){console.error('[NavoFlo 3D Inspector]',err);clear(false);fail(T.error)}
  finally{busy(false)}
}

function ext(n){return n.split('.').pop().toLowerCase()}

function mapResources(files){
  revoke();resourceMap=new Map();
  for(const f of files){const u=URL.createObjectURL(f);blobUrls.push(u);resourceMap.set(f.name,u);resourceMap.set(f.name.toLowerCase(),u)}
}

async function parse(file){
  const e=ext(file.name);
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
  if(!stats){resetStats();return}const u=E.units.value;
  E.format.textContent=format;E.size.textContent=bytes(fileSize);E.meshes.textContent=numInt(stats.meshCount);E.vertices.textContent=numInt(stats.verts);E.triangles.textContent=numInt(stats.tris);
  E.x.textContent=`${num(stats.size.x)} ${u}`;E.y.textContent=`${num(stats.size.y)} ${u}`;E.z.textContent=`${num(stats.size.z)} ${u}`;
  E.surface.textContent=stats.surface==null?T.complex:`${num(stats.surface)} ${u}²`;E.volume.textContent=stats.volume==null?T.complex:`${num(stats.volume)} ${u}³`;
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
  if(model){rootGroup.remove(model);dispose(model)}model=null;rootGroup?.position.set(0,0,0);bounds=null;stats=null;format='';fileSize=0;original=new WeakMap();revoke();resetStats();enable(false);
  E.wire.checked=false;E.clip.checked=false;E.slider.value=0;E.empty.classList.remove('hidden');if(grid)grid.position.y=0;
  if(message){E.status.className='file-status';E.status.textContent=T.no}
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
