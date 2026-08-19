import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FR = document.documentElement.lang.toLowerCase().startsWith('fr');
const T = FR ? {
  noModel:'Aucun modèle', loading:'Chargement…', stepEngine:'Initialisation du noyau CAD local…',
  stepOpen:'Ouverture STEP et extraction B-Rep…', meshOpen:'Chargement du maillage…',
  unsupported:'Format non pris en charge. Utilisez STEP, STP, STL, OBJ, GLB ou GLTF.',
  tooLarge:'Un fichier dépasse 250 Mo.', totalTooLarge:'La sélection dépasse 500 Mo.',
  failed:'Impossible de charger ce modèle.', workerFailed:'Le noyau CAD exact ne s’est pas chargé.',
  selectFirst:'Sélectionnez la première entité.', selectSecond:'Sélectionnez la deuxième entité.',
  single:'Entité sélectionnée', exact:'EXACT STEP', mesh:'MESH', distance:'Distance',
  center:'Centre ↔ centre', angle:'Angle', radius:'Rayon', diameter:'Diamètre',
  length:'Longueur', area:'Surface', dx:'ΔX', dy:'ΔY', dz:'ΔZ', family:'Type',
  face:'Face', edge:'Arête', vertex:'Sommet', point:'Point', parts:'pièce(s)',
  section:'Coupe', badCenter:'Ces deux entités n’exposent pas de centre exact.',
  exactFail:'Mesure exacte non disponible pour cette sélection.', browser:'Votre navigateur',
  compatible:'Compatible STEP', limited:'Compatible, mais limité pour les gros STEP',
  incompatible:'Compatibilité STEP limitée', threads:'threads', ram:'RAM', source:'Source',
  through:'traversant', depth:'Profondeur', hole:'Trou', reset:'Mesure effacée', fullscreen:'Plein écran', exitFullscreen:'Quitter le plein écran'
} : {
  noModel:'No model', loading:'Loading…', stepEngine:'Initializing local CAD kernel…',
  stepOpen:'Opening STEP and extracting B-Rep…', meshOpen:'Loading mesh…',
  unsupported:'Unsupported format. Use STEP, STP, STL, OBJ, GLB or GLTF.',
  tooLarge:'A file exceeds 250 MB.', totalTooLarge:'The selection exceeds 500 MB.',
  failed:'Unable to load this model.', workerFailed:'The exact CAD kernel could not load.',
  selectFirst:'Select the first entity.', selectSecond:'Select the second entity.',
  single:'Selected entity', exact:'EXACT STEP', mesh:'MESH', distance:'Distance',
  center:'Center ↔ center', angle:'Angle', radius:'Radius', diameter:'Diameter',
  length:'Length', area:'Area', dx:'ΔX', dy:'ΔY', dz:'ΔZ', family:'Type',
  face:'Face', edge:'Edge', vertex:'Vertex', point:'Point', parts:'part(s)',
  section:'Section', badCenter:'These entities do not both expose an exact center.',
  exactFail:'Exact measurement is unavailable for this selection.', browser:'Your browser',
  compatible:'STEP compatible', limited:'Compatible, but limited for large STEP files',
  incompatible:'Limited STEP compatibility', threads:'threads', ram:'RAM', source:'Source',
  through:'through', depth:'Depth', hole:'Hole', reset:'Measurement cleared', fullscreen:'Fullscreen', exitFullscreen:'Exit fullscreen'
};

const $ = id => document.getElementById(id);
const E = {
  workspace:$('cad-workspace'), canvas:$('viewer-canvas'), input:$('file-input'),
  empty:$('empty-drop'), loading:$('loading-overlay'), loadingLabel:$('loading-label'), loadingSub:$('loading-sub'),
  clear:$('clear-model'), fit:$('fit-view'), edges:$('edges-toggle'),
  measure:$('measure-toggle'), measureType:$('measure-type'), measureClear:$('measure-clear'),
  measureCard:$('measure-card'), measureMain:$('measure-main'), measureDetails:$('measure-details'),
  measureBadge:$('measure-badge'), selectionSummary:$('selection-summary'),
  section:$('section-toggle'), sectionPanel:$('section-panel'), clipAxis:$('clip-axis'),
  clipSlider:$('clip-slider'), clipInvert:$('clip-invert'),
  viewButton:$('view-menu-button'), viewMenu:$('view-menu'),
  props:$('properties-toggle'), propsDrawer:$('properties-drawer'), propsClose:$('properties-close'), fullscreen:$('fullscreen-toggle'),
  propFile:$('prop-file'), propFormat:$('prop-format'), propUnits:$('prop-units'),
  propParts:$('prop-parts'), propGeometries:$('prop-geometries'), propTriangles:$('prop-triangles'),
  stepMeta:$('step-meta-section'), stepName:$('step-name'), stepSchema:$('step-schema'),
  stepDate:$('step-date'), stepAuthor:$('step-author'), stepOrg:$('step-org'),
  stepOrigin:$('step-origin'), stepTree:$('step-tree'), pc:$('pc-check'),
  statusFile:$('status-file'), statusFormat:$('status-format'), statusUnits:$('status-units')
};

const MAX_FILE = 250*1024*1024;
const MAX_TOTAL = 500*1024*1024;
const WORKER_URL = '/js/step-worker.js';

let renderer, scene, camera, controls, modelRoot, selectionRoot, preselectionRoot, measureOverlayRoot, grid;
let currentModel = null, currentFile = null, currentFormat = '', currentUnit = 'u';
let currentStats = null, currentStepHeader = null, currentStepResult = null;
let surfaceMeshes = [], edgeObjects = [], vertexObjects = [], visualEdges = [];
let selectionMode = 'auto', measureEnabled = false, selected = [], currentMeasureResult = null;
let edgesVisible = true, clipEnabled = false;
let modelBounds = null, modelSize = 1;
let pointerDown = null, hoverRAF = 0, preselected = null, middleMouseDown = false;
let worker = null, workerSeq = 0, workerPending = new Map();
let meshObjectUrls = [];
let baseMaterials = new Set();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clipPlane = new THREE.Plane(new THREE.Vector3(1,0,0), 0);
const blackEdgeMaterial = new THREE.LineBasicMaterial({color:0x090b0d, transparent:true, opacity:0.96});
const selectedEdgeMaterial = new THREE.LineBasicMaterial({color:0x35d39a, depthTest:false});
const hoverEdgeMaterial = new THREE.LineBasicMaterial({color:0x84eac8, depthTest:false, transparent:true, opacity:0.95});
const hoverFaceMaterial = new THREE.MeshBasicMaterial({
  color:0x7ce4c1, transparent:true, opacity:0.18, side:THREE.DoubleSide,
  depthTest:true, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2
});
const selectionFaceMaterial = new THREE.MeshBasicMaterial({
  color:0x35d39a, transparent:true, opacity:0.32, side:THREE.DoubleSide,
  depthTest:true, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2
});

init();

function init() {
  try {
    renderer = new THREE.WebGLRenderer({canvas:E.canvas, antialias:true, preserveDrawingBuffer:true});
  } catch (error) {
    showError('WebGL unavailable.');
    return;
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x0a1016, 1);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100000);
  camera.position.set(5,4,6);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons.LEFT = null;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

  scene.add(new THREE.HemisphereLight(0xdde8f0, 0x202a30, 2.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.05); key.position.set(6,9,7); scene.add(key);
  const fill = new THREE.DirectionalLight(0x7edfc0, 0.72); fill.position.set(-5,3,-4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9db8cf, 0.65); rim.position.set(2,-4,6); scene.add(rim);

  modelRoot = new THREE.Group(); scene.add(modelRoot);
  selectionRoot = new THREE.Group(); scene.add(selectionRoot);
  preselectionRoot = new THREE.Group(); scene.add(preselectionRoot);
  measureOverlayRoot = new THREE.Group(); scene.add(measureOverlayRoot);

  createGrid(10);
  bindUI();
  updatePCCheck();
  resize();
  renderer.setAnimationLoop(render);
}

function bindUI() {
  addEventListener('resize', resize);

  E.input.addEventListener('change', event => {
    const files = [...(event.target.files || [])];
    if (files.length) loadFiles(files);
    event.target.value = '';
  });

  ['dragenter','dragover'].forEach(type => E.workspace.addEventListener(type, event => {
    event.preventDefault();
    if (!currentModel) E.empty.classList.add('dragging');
  }));
  ['dragleave','drop'].forEach(type => E.workspace.addEventListener(type, event => {
    event.preventDefault();
    E.empty.classList.remove('dragging');
  }));
  E.workspace.addEventListener('drop', event => {
    const files=[...(event.dataTransfer?.files||[])];
    if (files.length) loadFiles(files);
  });

  E.clear.addEventListener('click', clearModel);
  E.fit.addEventListener('click', () => fitCamera('iso'));
  E.edges.addEventListener('click', toggleEdges);
  E.measure.addEventListener('click', toggleMeasure);
  E.measureClear.addEventListener('click', clearMeasurement);
  E.measureType.addEventListener('change', () => {
    clearSelections();
    if (measureEnabled) setMeasurePrompt(T.selectFirst);
  });

  document.querySelectorAll('[data-select-mode]').forEach(button => {
    button.addEventListener('click', () => {
      selectionMode = button.dataset.selectMode;
      document.querySelectorAll('[data-select-mode]').forEach(b => b.classList.toggle('active', b===button));
      clearSelections();
      clearPreselection();
      updatePickingVisibility();
    });
  });

  E.section.addEventListener('click', () => {
    clipEnabled = !clipEnabled;
    E.section.classList.toggle('active', clipEnabled);
    E.sectionPanel.hidden = !clipEnabled;
    updateClipping();
  });
  [E.clipAxis,E.clipSlider,E.clipInvert].forEach(el => el.addEventListener(el===E.clipSlider?'input':'change', updateClipping));

  E.viewButton.addEventListener('click', () => E.viewMenu.hidden = !E.viewMenu.hidden);
  E.viewMenu.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    fitCamera(button.dataset.view);
    E.viewMenu.hidden = true;
  }));

  E.props.addEventListener('click', () => {
    E.propsDrawer.hidden = !E.propsDrawer.hidden;
    syncPropertiesState();
  });
  E.propsClose.addEventListener('click', () => {
    E.propsDrawer.hidden = true;
    syncPropertiesState();
  });

  E.fullscreen.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);

  E.canvas.addEventListener('contextmenu', e => e.preventDefault());

  // SolidWorks-like navigation: wheel = zoom, MMB drag = rotate, Ctrl+MMB = pan.
  E.canvas.addEventListener('pointerdown', event => {
    if (event.button === 1) {
      middleMouseDown = true;
      clearPreselection();
      controls.mouseButtons.MIDDLE = event.ctrlKey ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    }
  }, true);
  addEventListener('pointerup', event => {
    if (event.button === 1) middleMouseDown = false;
    if (controls) controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
  }, true);

  E.canvas.addEventListener('pointerdown', event => {
    if (event.button === 0) pointerDown = {x:event.clientX,y:event.clientY};
  });
  E.canvas.addEventListener('pointerup', event => {
    if (event.button !== 0 || !pointerDown) return;
    const distance = Math.hypot(event.clientX-pointerDown.x, event.clientY-pointerDown.y);
    pointerDown = null;
    if (distance < 5 && currentModel) selectAt(event);
  });

  E.canvas.addEventListener('pointermove', event => {
    if (!currentModel || middleMouseDown) return;
    if (hoverRAF) cancelAnimationFrame(hoverRAF);
    const x=event.clientX,y=event.clientY;
    hoverRAF=requestAnimationFrame(()=>{
      hoverRAF=0;
      updatePreselection(x,y);
    });
  });
  E.canvas.addEventListener('pointerleave', clearPreselection);

  addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      clearSelections();
      clearPreselection();
    }
  });

  addEventListener('beforeunload', () => {
    revokeObjectUrls();
    try { worker?.terminate(); } catch {}
  });
}



function syncPropertiesState() {
  const open = !E.propsDrawer.hidden;
  E.workspace.classList.toggle('properties-open', open);
  requestAnimationFrame(resize);
}

async function toggleFullscreen() {
  try {
    const active = document.fullscreenElement || document.webkitFullscreenElement;

    if (!active) {
      if (E.workspace.requestFullscreen) {
        await E.workspace.requestFullscreen();
      } else if (E.workspace.webkitRequestFullscreen) {
        E.workspace.webkitRequestFullscreen();
      } else {
        throw new Error('Fullscreen API unavailable.');
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  } catch (error) {
    console.warn('[NavoFlo CAD Viewer fullscreen]', error);
  }
}

function syncFullscreenState() {
  const active = (document.fullscreenElement || document.webkitFullscreenElement) === E.workspace;

  E.workspace.classList.toggle('is-fullscreen', active);
  E.fullscreen.classList.toggle('active', active);
  E.fullscreen.title = active ? T.exitFullscreen : T.fullscreen;

  const label = E.fullscreen.querySelector('span:last-child');
  if (label) label.textContent = active ? T.exitFullscreen : T.fullscreen;

  const icon = E.fullscreen.querySelector('.fullscreen-icon');
  if (icon) icon.textContent = active ? '🗗' : '⛶';

  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(resize);
  });
}

function resize() {
  if (!renderer) return;
  const rect=E.workspace.getBoundingClientRect();
  const w=Math.max(1,Math.floor(rect.width)), h=Math.max(1,Math.floor(rect.height));
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
}

function render() {
  controls?.update();
  renderer?.render(scene,camera);
}

async function loadFiles(files) {
  if (files.some(f=>f.size>MAX_FILE)) return showError(T.tooLarge);
  if (files.reduce((s,f)=>s+f.size,0)>MAX_TOTAL) return showError(T.totalTooLarge);

  const main = chooseMainFile(files);
  if (!main) return showError(T.unsupported);

  await clearModel(false);
  busy(true,T.loading,ext(main.name)==='step'||ext(main.name)==='stp'?T.stepEngine:T.meshOpen);

  try {
    currentFile=main;
    currentFormat=ext(main.name).toUpperCase();
    currentStepHeader = null;

    if (['step','stp'].includes(ext(main.name))) {
      currentStepHeader = await parseStepHeader(main);
      busy(true,T.loading,T.stepOpen);
      const buffer=await main.arrayBuffer();
      const result=await workerRequest('load-step',{buffer},[buffer]);
      currentStepResult=result;
      currentUnit='mm';
      buildExactStepScene(result);
    } else {
      currentStepResult=null;
      currentUnit='u';
      await buildMeshScene(main,files);
    }

    finalizeLoadedModel();
    fillProperties();
    E.empty.classList.add('hidden');
    enableTools(true);
    E.statusFile.textContent=main.name;
    E.statusFormat.textContent=currentFormat;
    E.statusUnits.textContent=currentUnit;
    fitCamera('iso');
  } catch (error) {
    console.error('[NavoFlo CAD Viewer]',error);
    await clearModel(false);
    showError(`${T.failed} — ${error?.message || error}`);
  } finally {
    busy(false);
  }
}

function chooseMainFile(files) {
  for (const type of ['step','stp','glb','gltf','stl','obj']) {
    const found=files.find(f=>ext(f.name)===type);
    if (found) return found;
  }
  return null;
}
function ext(name){return String(name).split('.').pop().toLowerCase()}

function workerRequest(action,payload={},transfer=[]) {
  const w=getWorker();
  const id=++workerSeq;
  return new Promise((resolve,reject)=>{
    workerPending.set(id,{resolve,reject});
    w.postMessage({id,action,payload},transfer);
  });
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(WORKER_URL,{type:'module'});
  worker.onmessage = event => {
    const {id,ok,result,error}=event.data||{};
    const pending=workerPending.get(id);
    if (!pending) return;
    workerPending.delete(id);
    ok ? pending.resolve(result) : pending.reject(new Error(error||T.workerFailed));
  };
  worker.onerror = event => {
    const error=new Error(event.message||T.workerFailed);
    for (const pending of workerPending.values()) pending.reject(error);
    workerPending.clear();
    worker?.terminate();
    worker=null;
  };
  return worker;
}

function buildExactStepScene(result) {
  const defs=(result.geometries||[]).map(makeCadDefinition);
  const roots=result.rootNodes||[];

  if (roots.length) {
    for (const node of roots) modelRoot.add(buildNode(node,defs));
  } else {
    defs.forEach((def,index)=>modelRoot.add(makeOccurrence(def,index)));
  }

  currentStats = result.stats || {
    partCount:roots.length,
    geometryCount:defs.length,
    triangleCount:defs.reduce((s,d)=>s+d.triangleCount,0)
  };

  function buildNode(node,defs) {
    const group=new THREE.Group();
    group.name=node.name||'';
    if (Array.isArray(node.transform) && node.transform.length===16) {
      group.matrix.fromArray(node.transform);
      group.matrixAutoUpdate=false;
    }
    for (const meshIndex of node.meshes||[]) {
      const def=defs[meshIndex];
      if (def) group.add(makeOccurrence(def,meshIndex));
    }
    for (const child of node.children||[]) group.add(buildNode(child,defs));
    return group;
  }
}

function makeCadDefinition(source) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(source.positions,3));
  if (source.normals?.length) geometry.setAttribute('normal',new THREE.BufferAttribute(source.normals,3));
  else geometry.computeVertexNormals();
  if (source.indices?.length) geometry.setIndex(new THREE.BufferAttribute(source.indices,1));
  geometry.computeBoundingBox();

  const color=source.color ? new THREE.Color(source.color.r,source.color.g,source.color.b) : new THREE.Color(0xc5c9ca);
  const material=new THREE.MeshStandardMaterial({
    color, metalness:0.08, roughness:0.56, side:THREE.DoubleSide,
    clippingPlanes:clipEnabled?[clipPlane]:null
  });
  baseMaterials.add(material);

  const facesById=new Map((source.faces||[]).map(f=>[Number(f.id),f]));
  const triangleToFaceMap=source.triangleToFaceMap||new Int32Array();
  const triangleCount=Math.floor((source.indices?.length||source.positions?.length/3)/3);

  return {source,geometry,material,facesById,triangleToFaceMap,triangleCount};
}

function makeOccurrence(def,index) {
  const group=new THREE.Group();

  const mesh=new THREE.Mesh(def.geometry,def.material);
  mesh.userData={cadSurface:true,geometryId:def.source.id,def};
  surfaceMeshes.push(mesh);
  group.add(mesh);

  for (const edge of def.source.edges||[]) {
    if (!edge.points?.length) continue;
    const eg=new THREE.BufferGeometry();
    eg.setAttribute('position',new THREE.BufferAttribute(edge.points,3));
    const line=new THREE.Line(eg,blackEdgeMaterial);
    line.userData={cadEdge:true,geometryId:def.source.id,elementId:Number(edge.id),def,edge};
    edgeObjects.push(line); visualEdges.push(line); group.add(line);
  }

  if ((def.source.vertices||[]).length) {
    const positions=new Float32Array(def.source.vertices.length*3);
    const ids=[];
    def.source.vertices.forEach((v,i)=>{
      positions.set(v.position,i*3); ids.push(Number(v.id));
    });
    const vg=new THREE.BufferGeometry();
    vg.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const vm=new THREE.PointsMaterial({color:0x35d39a,size:1,sizeAttenuation:true,transparent:true,opacity:0,depthWrite:false});
    const points=new THREE.Points(vg,vm);
    points.userData={cadVertices:true,geometryId:def.source.id,vertexIds:ids,def};
    vertexObjects.push(points); group.add(points);
  }
  return group;
}

async function buildMeshScene(main,files) {
  revokeObjectUrls();
  const map=new Map();
  for (const f of files) {
    const url=URL.createObjectURL(f);meshObjectUrls.push(url);
    map.set(f.name,url);map.set(f.name.toLowerCase(),url);
  }

  const type=ext(main.name);
  let object;
  if (type==='stl') {
    const geometry=new STLLoader().parse(await main.arrayBuffer());
    geometry.computeVertexNormals();
    object=new THREE.Mesh(geometry,meshMaterial());
  } else if (type==='obj') {
    object=new OBJLoader().parse(await main.text());
    object.traverse(child=>{
      if (!child.isMesh) return;
      child.material=meshMaterial();
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    });
  } else {
    const manager=new THREE.LoadingManager();
    manager.setURLModifier(url=>{
      const clean=decodeURIComponent(url.split('?')[0].split('#')[0]),base=clean.split('/').pop();
      return map.get(clean)||map.get(clean.toLowerCase())||map.get(base)||map.get(base?.toLowerCase())||url;
    });
    const loader=new GLTFLoader(manager);
    const data=type==='gltf'?await main.text():await main.arrayBuffer();
    object=await new Promise((resolve,reject)=>loader.parse(data,'',g=>resolve(g.scene||g.scenes?.[0]),reject));
  }

  currentModel=object;
  modelRoot.add(object);

  let meshes=0,triangles=0;
  object.traverse(child=>{
    if (!child.isMesh||!child.geometry) return;
    meshes++;
    child.userData={meshSurface:true};
    surfaceMeshes.push(child);
    const indexCount=child.geometry.index?.count||child.geometry.getAttribute('position')?.count||0;
    triangles+=Math.floor(indexCount/3);

    const edgesGeometry=new THREE.EdgesGeometry(child.geometry,22);
    const edges=new THREE.LineSegments(edgesGeometry,blackEdgeMaterial);
    edges.userData={meshEdges:true};
    visualEdges.push(edges);
    child.add(edges);
  });
  currentStats={partCount:1,geometryCount:meshes,triangleCount:triangles};
}

function meshMaterial() {
  const material=new THREE.MeshStandardMaterial({
    color:0xb9c0c2,metalness:0.1,roughness:0.58,side:THREE.DoubleSide,
    clippingPlanes:clipEnabled?[clipPlane]:null
  });
  baseMaterials.add(material);return material;
}

function finalizeLoadedModel() {
  currentModel=modelRoot;
  modelRoot.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(modelRoot);
  if (box.isEmpty()) throw new Error('No displayable geometry found.');

  const center=box.getCenter(new THREE.Vector3());
  modelRoot.position.sub(center);
  modelRoot.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(modelRoot);
  modelBounds=box;
  const size=box.getSize(new THREE.Vector3());
  modelSize=Math.max(size.x,size.y,size.z,1e-6);

  raycaster.params.Line.threshold=modelSize*0.004;
  raycaster.params.Points.threshold=modelSize*0.006;

  createGrid(niceGrid(modelSize*1.6));
  grid.position.y=box.min.y-modelSize*0.003;
  updatePickingVisibility();
}

function createGrid(size) {
  if (grid) {scene.remove(grid);grid.geometry.dispose();grid.material.dispose();}
  grid=new THREE.GridHelper(size,20,0x263b34,0x17241f);
  grid.material.opacity=.34;grid.material.transparent=true;scene.add(grid);
}
function niceGrid(v){const p=10**Math.floor(Math.log10(v)),s=v/p;return(s<=1?1:s<=2?2:s<=5?5:10)*p}

function selectAt(event) {
  const selection = pickSelectionCandidate(event.clientX,event.clientY);
  if (!selection) {
    if (!measureEnabled && !event.ctrlKey && !event.metaKey) clearSelections();
    return;
  }
  acceptSelection(selection, event);
}

function setRayFromClient(clientX,clientY) {
  const rect=E.canvas.getBoundingClientRect();
  pointer.x=((clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  return rect;
}

function screenDistance(point,clientX,clientY,rect) {
  const projected=point.clone().project(camera);
  const sx=rect.left+(projected.x+1)*0.5*rect.width;
  const sy=rect.top+(1-projected.y)*0.5*rect.height;
  return Math.hypot(sx-clientX,sy-clientY);
}

function pickSelectionCandidate(clientX,clientY) {
  const rect=setRayFromClient(clientX,clientY);

  if (!currentStepResult) {
    const hit=raycaster.intersectObjects(surfaceMeshes,true)[0];
    return hit ? {kind:'point',point:hit.point.clone(),object:hit.object,meshOnly:true} : null;
  }

  const wantVertex=selectionMode==='vertex'||selectionMode==='auto';
  const wantEdge=selectionMode==='edge'||selectionMode==='auto';
  const wantFace=selectionMode==='face'||selectionMode==='auto';

  let vertexCandidate=null,edgeCandidate=null,faceCandidate=null;

  if (wantVertex) {
    const hit=raycaster.intersectObjects(vertexObjects,false)[0];
    if (hit) {
      const selection=selectionFromVertex(hit);
      const px=screenDistance(selection.point,clientX,clientY,rect);
      vertexCandidate={selection,px,depth:hit.distance};
    }
  }

  if (wantEdge) {
    const hits=raycaster.intersectObjects(edgeObjects,false).slice(0,8);
    for (const hit of hits) {
      const selection=selectionFromEdge(hit);
      const px=screenDistance(selection.point,clientX,clientY,rect);
      if (!edgeCandidate || px<edgeCandidate.px || (Math.abs(px-edgeCandidate.px)<0.5&&hit.distance<edgeCandidate.depth)) {
        edgeCandidate={selection,px,depth:hit.distance};
      }
    }
  }

  if (wantFace) {
    const hit=raycaster.intersectObjects(surfaceMeshes,false)[0];
    if (hit) {
      const selection=selectionFromFace(hit);
      if (selection) faceCandidate={selection,px:0,depth:hit.distance};
    }
  }

  if (selectionMode==='vertex') return vertexCandidate?.selection||null;
  if (selectionMode==='edge') return edgeCandidate?.selection||null;
  if (selectionMode==='face') return faceCandidate?.selection||null;

  // SolidWorks-like Auto:
  // vertex wins only when cursor is very close; edge next; otherwise face.
  if (vertexCandidate && vertexCandidate.px<=11) return vertexCandidate.selection;
  if (edgeCandidate && edgeCandidate.px<=7) return edgeCandidate.selection;
  return faceCandidate?.selection || edgeCandidate?.selection || vertexCandidate?.selection || null;
}

function updatePreselection(clientX,clientY) {
  const candidate=pickSelectionCandidate(clientX,clientY);
  const key=candidate?selectionKey(candidate):'';

  if (preselected && selectionKey(preselected)===key) return;

  clearPreselection();
  if (!candidate) return;

  preselected=candidate;
  E.workspace.classList.add('has-preselection');
  highlightPreselection(candidate);
}

function clearPreselection() {
  preselected=null;
  E.workspace?.classList.remove('has-preselection');
  clearGroup(preselectionRoot);
}

function highlightPreselection(s) {
  if (!s) return;

  if (s.kind==='edge') {
    const line=new THREE.Line(s.object.geometry.clone(),hoverEdgeMaterial.clone());
    line.matrix.copy(s.object.matrixWorld);
    line.matrixAutoUpdate=false;
    line.renderOrder=27;
    preselectionRoot.add(line);
    return;
  }

  if (s.kind==='vertex'||s.kind==='point') {
    const radius=Math.max(modelSize*0.0045,0.0001);
    const sphere=new THREE.Mesh(
      new THREE.SphereGeometry(radius,14,10),
      new THREE.MeshBasicMaterial({color:0x84eac8,depthTest:false,transparent:true,opacity:0.9})
    );
    sphere.position.copy(s.point);
    sphere.renderOrder=28;
    preselectionRoot.add(sphere);
    return;
  }

  if (s.kind==='face') {
    const face=s.def.facesById.get(Number(s.elementId));
    if (!face) return;
    const source=s.def.geometry;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',source.getAttribute('position'));
    if (source.getAttribute('normal')) g.setAttribute('normal',source.getAttribute('normal'));
    const srcIndex=source.index.array;
    const slice=srcIndex.slice(face.firstIndex,face.firstIndex+face.indexCount);
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(slice),1));

    const mesh=new THREE.Mesh(g,hoverFaceMaterial.clone());
    mesh.matrix.copy(s.object.matrixWorld);
    mesh.matrixAutoUpdate=false;
    mesh.renderOrder=26;
    preselectionRoot.add(mesh);
  }
}

function selectionFromEdge(hit) {
  const o=hit.object;
  return {
    kind:'edge',geometryId:o.userData.geometryId,elementId:o.userData.elementId,
    point:hit.point.clone(),object:o,def:o.userData.def,
    transform:o.matrixWorld.toArray()
  };
}
function selectionFromVertex(hit) {
  const o=hit.object,id=o.userData.vertexIds[hit.index];
  const point=new THREE.Vector3().fromBufferAttribute(o.geometry.getAttribute('position'),hit.index).applyMatrix4(o.matrixWorld);
  return {
    kind:'vertex',geometryId:o.userData.geometryId,elementId:id,
    point,object:o,def:o.userData.def,transform:o.matrixWorld.toArray()
  };
}
function selectionFromFace(hit) {
  const o=hit.object,def=o.userData.def;
  let id = def.triangleToFaceMap?.[hit.faceIndex];
  if (id == null || id < 0) {
    const offset=hit.faceIndex*3;
    const face=[...def.facesById.values()].find(f=>offset>=f.firstIndex&&offset<f.firstIndex+f.indexCount);
    id=face?.id;
  }
  if (id == null) return null;
  return {
    kind:'face',geometryId:o.userData.geometryId,elementId:Number(id),
    point:hit.point.clone(),object:o,def,transform:o.matrixWorld.toArray()
  };
}

async function acceptSelection(selection, event={}) {
  const key=selectionKey(selection);
  const existing=selected.findIndex(s=>selectionKey(s)===key);

  if (measureEnabled) {
    if (existing>=0) {
      selected.splice(existing,1);
      rebuildSelectionHighlights();
      return;
    }
    if (selected.length>=2) selected=[];
    selected.push(selection);
  } else {
    const multi=Boolean(event.ctrlKey||event.metaKey);
    if (existing>=0) {
      if (multi) selected.splice(existing,1);
      else selected=[selection];
    } else if (multi) {
      selected.push(selection);
    } else {
      selected=[selection];
    }
  }
  rebuildSelectionHighlights();

  if (!measureEnabled) return;

  E.measureCard.hidden=false;
  E.measureBadge.textContent=currentStepResult?T.exact:T.mesh;

  if (!currentStepResult) {
    if (selected.length===1) {
      setMeasurePrompt(T.selectSecond);
      E.measureMain.textContent=formatPoint(selected[0].point);
    } else if (selected.length===2) {
      showMeshPointDistance(selected[0],selected[1]);
    }
    return;
  }

  try {
    if (selected.length===1) {
      const details=await workerRequest('inspect',{selection:serialSelection(selected[0])});
      showSingleExact(details);
      E.selectionSummary.textContent=T.selectSecond;
    } else if (selected.length===2) {
      const result=await workerRequest('measure',{
        a:serialSelection(selected[0]),b:serialSelection(selected[1]),mode:E.measureType.value
      });
      showPairExact(result);
    }
  } catch (error) {
    showMeasureError(error?.message||T.exactFail);
  }
}

function serialSelection(s) {
  return {
    kind:s.kind,geometryId:s.geometryId,elementId:s.elementId,transform:s.object.matrixWorld.toArray()
  };
}
function selectionKey(s){return `${s.kind}:${s.geometryId||''}:${s.elementId??''}:${s.object?.uuid||''}`}

function rebuildSelectionHighlights() {
  clearGroup(selectionRoot);
  selected.forEach((s,index)=>highlightSelection(s,index));
}
function highlightSelection(s,index) {
  const color=index===0?0x35d39a:0x9cefd4;
  if (s.kind==='edge') {
    const line=new THREE.Line(s.object.geometry.clone(),new THREE.LineBasicMaterial({color,depthTest:false}));
    line.matrix.copy(s.object.matrixWorld);line.matrixAutoUpdate=false;line.renderOrder=30;selectionRoot.add(line);
  } else if (s.kind==='vertex'||s.kind==='point') {
    const radius=Math.max(modelSize*0.006,0.0001);
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(radius,16,12),new THREE.MeshBasicMaterial({color,depthTest:false}));
    sphere.position.copy(s.point);sphere.renderOrder=31;selectionRoot.add(sphere);
  } else if (s.kind==='face') {
    const face=s.def.facesById.get(Number(s.elementId));
    if (!face) return;
    const source=s.def.geometry;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',source.getAttribute('position'));
    if (source.getAttribute('normal')) g.setAttribute('normal',source.getAttribute('normal'));
    const srcIndex=source.index.array;
    const slice=srcIndex.slice(face.firstIndex,face.firstIndex+face.indexCount);
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(slice),1));
    const mesh=new THREE.Mesh(g,selectionFaceMaterial.clone());
    mesh.material.color.setHex(color);
    mesh.matrix.copy(s.object.matrixWorld);mesh.matrixAutoUpdate=false;mesh.renderOrder=29;selectionRoot.add(mesh);
  }
}

function toggleMeasure() {
  if (!currentModel) return;
  measureEnabled=!measureEnabled;
  E.measure.classList.toggle('active',measureEnabled);
  E.measureType.disabled=!measureEnabled;
  E.workspace.classList.toggle('selecting',measureEnabled);
  clearSelections();
  if (measureEnabled) {
    E.measureCard.hidden=false;
    E.measureBadge.textContent=currentStepResult?T.exact:T.mesh;
    setMeasurePrompt(T.selectFirst);
  } else {
    E.measureCard.hidden=true;
  }
}

function clearSelections() {
  selected=[];currentMeasureResult=null;clearGroup(selectionRoot);clearGroup(measureOverlayRoot);
  clearMeasureDetails();
  if (measureEnabled) setMeasurePrompt(T.selectFirst);
}

function clearMeasurement() {
  clearSelections();
}

function showSingleExact(d) {
  const details=[];
  E.measureMain.textContent=`${labelKind(d.kind)} #${d.elementId}`;
  details.push([T.family,d.family||'other']);
  if (isFinite(d.length)) details.push([T.length,formatLength(d.length)]);
  if (isFinite(d.diameter)) details.push([T.diameter,formatLength(d.diameter)]);
  if (isFinite(d.radius)) details.push([T.radius,formatLength(d.radius)]);
  if (isFinite(d.area)) details.push([T.area,formatArea(d.area)]);
  if (d.hole?.diameter) {
    details.push([T.hole,`Ø ${formatLength(d.hole.diameter)}`]);
    if (isFinite(d.hole.depth)) details.push([T.depth,formatLength(d.hole.depth)]);
  }
  renderDetails(details);
}
function showPairExact(r) {
  if (!r?.ok) return showMeasureError(r?.message||T.exactFail);
  currentMeasureResult=r;
  clearGroup(measureOverlayRoot);

  if (r.kind==='angle') {
    E.measureMain.textContent=formatAngle(r.value);
    renderDetails([[T.angle,formatAngle(r.value)]]);
    drawMeasurePoints(r.pointA,r.pointB);
  } else if (r.kind==='center-center') {
    E.measureMain.textContent=formatLength(r.value);
    renderDetails([
      [T.center,formatLength(r.value)],[T.dx,formatLength(r.dx)],[T.dy,formatLength(r.dy)],[T.dz,formatLength(r.dz)]
    ]);
    drawMeasureLine(r.pointA,r.pointB);
  } else {
    E.measureMain.textContent=formatLength(r.value);
    const a=r.pointA,b=r.pointB;
    const dx=a&&b?Math.abs(b[0]-a[0]):null,dy=a&&b?Math.abs(b[1]-a[1]):null,dz=a&&b?Math.abs(b[2]-a[2]):null;
    const rows=[[T.distance,formatLength(r.value)]];
    if (dx!=null) rows.push([T.dx,formatLength(dx)],[T.dy,formatLength(dy)],[T.dz,formatLength(dz)]);
    renderDetails(rows);
    drawMeasureLine(a,b);
  }
  E.selectionSummary.textContent=`${labelSelection(selected[0])}  →  ${labelSelection(selected[1])}`;
}

function showMeshPointDistance(a,b) {
  const delta=new THREE.Vector3().subVectors(b.point,a.point);
  const distance=a.point.distanceTo(b.point);
  E.measureMain.textContent=formatLength(distance,'u');
  renderDetails([
    [T.distance,formatLength(distance,'u')],[T.dx,formatLength(Math.abs(delta.x),'u')],
    [T.dy,formatLength(Math.abs(delta.y),'u')],[T.dz,formatLength(Math.abs(delta.z),'u')]
  ]);
  drawMeasureLine(a.point.toArray(),b.point.toArray());
}
function showMeasureError(message) {
  E.measureMain.textContent='—';
  renderDetails([]);
  E.selectionSummary.textContent=message;
}

function drawMeasureLine(a,b) {
  if (!a||!b) return;
  const pa=new THREE.Vector3(...a),pb=new THREE.Vector3(...b);
  const line=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([pa,pb]),
    new THREE.LineBasicMaterial({color:0x35d39a,depthTest:false})
  );
  line.renderOrder=40;measureOverlayRoot.add(line);
  addMeasureMarker(pa);addMeasureMarker(pb);
}
function drawMeasurePoints(a,b){drawMeasureLine(a,b)}
function addMeasureMarker(p) {
  const r=Math.max(modelSize*0.0045,0.0001);
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),new THREE.MeshBasicMaterial({color:0x35d39a,depthTest:false}));
  m.position.copy(p);m.renderOrder=41;measureOverlayRoot.add(m);
}

function setMeasurePrompt(text) {
  E.measureMain.textContent='—';
  E.selectionSummary.textContent=text;
  renderDetails([]);
}
function clearMeasureDetails(){E.measureMain.textContent='—';E.measureDetails.replaceChildren()}
function renderDetails(rows) {
  E.measureDetails.replaceChildren();
  for (const [k,v] of rows) {
    const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=k;dd.textContent=v;div.append(dt,dd);E.measureDetails.append(div);
  }
}
function labelKind(k){return k==='face'?T.face:k==='edge'?T.edge:k==='vertex'?T.vertex:T.point}
function labelSelection(s){return s.meshOnly?T.point:`${labelKind(s.kind)} #${s.elementId}`}

function toggleEdges() {
  edgesVisible=!edgesVisible;E.edges.classList.toggle('active',edgesVisible);
  visualEdges.forEach(o=>o.visible=edgesVisible);
}
function updatePickingVisibility() {
  // Topological edges remain visually visible regardless of pick filter.
  vertexObjects.forEach(o=>o.material.opacity=selectionMode==='vertex'?0.5:0);
}

function updateClipping() {
  const axis=E.clipAxis.value;
  clipPlane.normal.set(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);
  if (E.clipInvert.checked) clipPlane.normal.multiplyScalar(-1);
  if (modelBounds) {
    const size=modelBounds.getSize(new THREE.Vector3());
    const extent=axis==='x'?size.x:axis==='y'?size.y:size.z;
    clipPlane.constant=-(Number(E.clipSlider.value)/200)*extent;
    if (E.clipInvert.checked) clipPlane.constant*=-1;
  }
  baseMaterials.forEach(m=>{m.clippingPlanes=clipEnabled?[clipPlane]:null;m.needsUpdate=true});
  blackEdgeMaterial.clippingPlanes=clipEnabled?[clipPlane]:null;blackEdgeMaterial.needsUpdate=true;
}

function fitCamera(view='iso') {
  if (!modelBounds) return;
  const sphere=modelBounds.getBoundingSphere(new THREE.Sphere());
  const radius=Math.max(sphere.radius,0.001),fov=THREE.MathUtils.degToRad(camera.fov);
  const distance=radius/Math.sin(fov/2)*1.12;
  const dirs={iso:[1,.75,1],front:[0,0,1],right:[1,0,0],top:[0,1,0]};
  const dir=new THREE.Vector3(...(dirs[view]||dirs.iso)).normalize();
  camera.position.copy(dir.multiplyScalar(distance));
  camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
  camera.near=Math.max(distance/1000,.001);camera.far=Math.max(distance*100,1000);camera.updateProjectionMatrix();
  controls.target.set(0,0,0);controls.update();
}

function fillProperties() {
  E.propFile.textContent=currentFile?.name||'—';
  E.propFormat.textContent=currentFormat||'—';
  E.propUnits.textContent=currentUnit;
  E.propParts.textContent=String(currentStats?.partCount??1);
  E.propGeometries.textContent=String(currentStats?.geometryCount??surfaceMeshes.length);
  E.propTriangles.textContent=formatInteger(currentStats?.triangleCount??0);

  if (currentStepResult) {
    E.stepMeta.hidden=false;
    const h=currentStepHeader||{};
    E.stepName.textContent=h.name||currentFile.name||'—';
    E.stepSchema.textContent=h.schema||'—';
    E.stepDate.textContent=h.date||'—';
    E.stepAuthor.textContent=h.author||'—';
    E.stepOrg.textContent=h.organization||'—';
    E.stepOrigin.textContent=h.origin||'—';
    renderTree(currentStepResult.rootNodes||[]);
  } else {
    E.stepMeta.hidden=true;
  }
}
function renderTree(roots) {
  E.stepTree.replaceChildren();
  if (!roots.length) {E.stepTree.textContent='—';return}
  let count=0;
  const walk=(node,depth)=>{
    if (count++>600) return;
    const row=document.createElement('div');
    row.className=`tree-row${node.isAssembly?' assembly':''}`;
    row.style.paddingLeft=`${Math.min(depth,14)*10}px`;
    row.textContent=`${depth?'↳ ':'• '}${node.name||'(unnamed)'}`;
    E.stepTree.append(row);
    (node.children||[]).forEach(c=>walk(c,depth+1));
  };
  roots.forEach(r=>walk(r,0));
}

async function parseStepHeader(file) {
  try {
    const text=await file.slice(0,2*1024*1024).text();
    const header=text.match(/HEADER\s*;([\s\S]*?)ENDSEC\s*;/i)?.[1]||'';
    const stmt=name=>header.match(new RegExp(name+'\\s*\\(([\\s\\S]*?)\\)\\s*;','i'))?.[0]||'';
    const values=s=>[...s.matchAll(/'((?:''|[^'])*)'/g)].map(m=>m[1].replace(/''/g,"'").trim());
    const desc=values(stmt('FILE_DESCRIPTION')),schema=values(stmt('FILE_SCHEMA')),fn=stmt('FILE_NAME'),all=values(fn);
    const structured=fn.match(/FILE_NAME\s*\(\s*'((?:''|[^'])*)'\s*,\s*'((?:''|[^'])*)'\s*,\s*\(([\s\S]*?)\)\s*,\s*\(([\s\S]*?)\)\s*,\s*'((?:''|[^'])*)'\s*,\s*'((?:''|[^'])*)'/i);
    let data={name:all[0],date:all[1],author:'',organization:'',origin:all.at(-2)||'',schema:schema.join(', '),description:desc[0]||''};
    if (structured) {
      const q=s=>values(s).join(', ');
      data={...data,name:structured[1].replace(/''/g,"'"),date:structured[2].replace(/''/g,"'"),
        author:q(structured[3]),organization:q(structured[4]),origin:structured[6].replace(/''/g,"'")};
    }
    return data;
  } catch { return {}; }
}

async function clearModel(showMessage=true) {
  clearSelections();
  clearPreselection();
  if (currentStepResult && worker) {
    try {await workerRequest('release');} catch {}
  }

  for (const child of [...modelRoot.children]) {
    modelRoot.remove(child);disposeObject(child);
  }
  modelRoot.position.set(0,0,0);
  surfaceMeshes=[];edgeObjects=[];vertexObjects=[];visualEdges=[];baseMaterials=new Set();
  currentModel=null;currentFile=null;currentFormat='';currentUnit='u';currentStats=null;currentStepHeader=null;currentStepResult=null;
  modelBounds=null;modelSize=1;clipEnabled=false;edgesVisible=true;measureEnabled=false;
  E.section.classList.remove('active');E.sectionPanel.hidden=true;E.edges.classList.add('active');E.measure.classList.remove('active');
  E.measureCard.hidden=true;E.propsDrawer.hidden=true;E.workspace.classList.remove('properties-open');E.stepMeta.hidden=true;E.empty.classList.remove('hidden');
  E.statusFile.textContent=showMessage?T.noModel:'—';E.statusFormat.textContent='—';E.statusUnits.textContent='—';
  enableTools(false);revokeObjectUrls();
}

function disposeObject(root) {
  root.traverse(o=>{
    if (o.geometry && !o.userData?.cadSurface) o.geometry.dispose?.();
    if (o.material && o.material!==blackEdgeMaterial) {
      const materials=Array.isArray(o.material)?o.material:[o.material];
      materials.forEach(m=>{for(const v of Object.values(m||{}))if(v?.isTexture)v.dispose();m?.dispose?.()});
    }
  });
}
function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.geometry?.dispose?.();
    if (child.material && child.material!==selectionFaceMaterial && child.material!==selectedEdgeMaterial) child.material.dispose?.();
  }
}
function revokeObjectUrls(){meshObjectUrls.forEach(u=>{try{URL.revokeObjectURL(u)}catch{}});meshObjectUrls=[]}

function enableTools(on) {
  [E.clear,E.fit,E.edges,E.measure,E.section,E.viewButton,E.props].forEach(el=>el.disabled=!on);
  document.querySelectorAll('[data-select-mode]').forEach(el=>el.disabled=!on);
  E.measureType.disabled=!on||!measureEnabled;
}
function busy(on,label=T.loading,sub='') {
  E.loading.hidden=!on;E.loadingLabel.textContent=label;E.loadingSub.textContent=sub||'';
}
function showError(message) {
  E.statusFile.textContent=message;
  E.empty.classList.remove('hidden');
}

function updatePCCheck() {
  if (!E.pc) return;
  const wasm=typeof WebAssembly==='object';
  let webgl2=false;try{webgl2=!!document.createElement('canvas').getContext('webgl2')}catch{}
  const threads=navigator.hardwareConcurrency||null,ram=navigator.deviceMemory||null;
  const required=wasm&&webgl2,cpuOk=threads==null||threads>=4,ramOk=ram==null||ram>=8;
  const good=required&&cpuOk&&ramOk,limited=required&&!good;
  E.pc.className='pc-check '+(good?'ok':limited?'warn':'bad');
  E.pc.textContent=`${T.browser}: ${good?T.compatible:limited?T.limited:T.incompatible} · WebAssembly ${wasm?'✓':'✕'} · WebGL2 ${webgl2?'✓':'✕'} · ${threads??'?'} ${T.threads} · ${ram?ram+' GB+':'?'} ${T.ram}`;
}

function formatLength(v,unit=currentUnit){return `${formatNumber(v)} ${unit}`}
function formatArea(v,unit=currentUnit){return `${formatNumber(v)} ${unit}²`}
function formatAngle(v) {
  // OCCT geometric angles are expressed in radians.
  return `${formatNumber(THREE.MathUtils.radToDeg(v))}°`;
}
function formatPoint(p){return `${formatNumber(p.x)}, ${formatNumber(p.y)}, ${formatNumber(p.z)} ${currentUnit}`}
function formatNumber(v) {
  if (!Number.isFinite(v)) return '—';
  const a=Math.abs(v),digits=a>=1000?2:a>=10?3:a>=1?4:5;
  return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{maximumFractionDigits:digits}).format(v);
}
function formatInteger(v){return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{maximumFractionDigits:0}).format(v||0)}
