import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadUserPreferences, createPreferenceSaver } from './user-preferences.js?v=8.14';

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
  through:'traversant', depth:'Profondeur', hole:'Trou', reset:'Mesure effacée', fullscreen:'Plein écran', exitFullscreen:'Quitter le plein écran', metadataNone:'Aucune propriété personnalisée STEP détectée.', metadataFound:'propriété(s) STEP détectée(s)', metadataScan:'Lecture locale du fichier STEP.'
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
  through:'through', depth:'Depth', hole:'Hole', reset:'Measurement cleared', fullscreen:'Fullscreen', exitFullscreen:'Exit fullscreen', metadataNone:'No custom STEP properties detected.', metadataFound:'STEP property/properties detected', metadataScan:'Local STEP file scan.'
};

const $ = id => document.getElementById(id);
const E = {
  workspace:$('cad-workspace'), canvas:$('viewer-canvas'), input:$('file-input'),
  empty:$('empty-drop'), loading:$('loading-overlay'), loadingLabel:$('loading-label'), loadingSub:$('loading-sub'),
  clear:$('clear-model'), fit:$('fit-view'), edges:$('edges-toggle'), gridToggle:$('grid-toggle'), unitSelect:$('unit-select'),
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
  stepOrigin:$('step-origin'), stepTree:$('step-tree'), stepCustomSection:$('step-custom-section'), stepCustomProperties:$('step-custom-properties'), stepCustomNote:$('step-custom-note'), pc:$('pc-check'),
  sheetMetal:$('sheetmetal-toggle'), sheetMetalSection:$('sheetmetal-section'),
  smMaterial:$('sm-material-class'), smThickness:$('sm-thickness'), smThicknessUnit:$('sm-thickness-unit'),
  smRadius:$('sm-radius'), smRadiusUnit:$('sm-radius-unit'), smAngle:$('sm-angle'),
  smUseMeasure:$('sm-use-measure'), smUseRadius:$('sm-use-radius'),
  smManualToggle:$('sm-manual-k-toggle'), smManualRow:$('sm-manual-k-row'), smManualK:$('sm-manual-k'),
  smRatio:$('sm-ratio'), smBand:$('sm-band'), smK:$('sm-k'), smNeutralRadius:$('sm-neutral-radius'),
  smBendAllowance:$('sm-bend-allowance'), smBendDeduction:$('sm-bend-deduction'), smStatus:$('sm-status'),
  statusFile:$('status-file'), statusFormat:$('status-format'), statusUnits:$('status-units')
};

const MAX_FILE = 250*1024*1024;
const MAX_TOTAL = 500*1024*1024;
const WORKER_URL = '/js/step-worker.js';

const AIR_BENDING_K_TABLE = Object.freeze({
  soft:Object.freeze({toThickness:0.33,to3Thickness:0.40,over3Thickness:0.50}),
  medium:Object.freeze({toThickness:0.38,to3Thickness:0.43,over3Thickness:0.50}),
  hard:Object.freeze({toThickness:0.40,to3Thickness:0.45,over3Thickness:0.50})
});

const SMT = FR ? {
  needStep:'Chargez un STEP pour utiliser les paramètres de tôlerie.',
  needValues:"Entrez l'épaisseur T et le rayon intérieur R.",
  invalidValues:"L'épaisseur doit être > 0 et le rayon doit être ≥ 0.",
  capturedThickness:'Épaisseur récupérée depuis la mesure.',
  thicknessUnavailable:'Sélectionnez deux faces et mesurez leur distance pour récupérer T.',
  capturedRadius:'Rayon intérieur récupéré depuis la sélection.',
  radiusUnavailable:'Sélectionnez une arête circulaire ou une face cylindrique STEP pour récupérer R.',
  exactRadiusUnavailable:'Cette entité ne fournit pas de rayon exact.',
  autoK:'K automatique · Air Bending CD-401',
  manualK:'K manuel',
  band1:'0 ≤ R/T ≤ 1',
  band2:'1 < R/T ≤ 3',
  band3:'R/T > 3',
  calculationReady:'Paramètres de pliage calculés. Utilisables par le futur moteur STEP → DXF.',
  measurementBusy:'Lecture de la géométrie exacte…'
} : {
  needStep:'Load a STEP file to use sheet-metal parameters.',
  needValues:'Enter thickness T and inside radius R.',
  invalidValues:'Thickness must be > 0 and radius must be ≥ 0.',
  capturedThickness:'Thickness captured from the current measurement.',
  thicknessUnavailable:'Select two faces and measure their distance to capture T.',
  capturedRadius:'Inside radius captured from the selection.',
  radiusUnavailable:'Select a circular edge or cylindrical STEP face to capture R.',
  exactRadiusUnavailable:'This entity does not expose an exact radius.',
  autoK:'Automatic K · CD-401 Air Bending',
  manualK:'Manual K',
  band1:'0 ≤ R/T ≤ 1',
  band2:'1 < R/T ≤ 3',
  band3:'R/T > 3',
  calculationReady:'Bend parameters calculated. Ready for the future STEP → DXF engine.',
  measurementBusy:'Reading exact geometry…'
};

const sheetMetalState = {
  materialClass:'hard',
  thickness:null,
  radius:null,
  bendAngleDeg:90,
  manualKEnabled:false,
  manualK:0.40
};

let renderer, scene, camera, controls, modelRoot, selectionRoot, preselectionRoot, measureOverlayRoot, grid;
let currentModel = null, currentFile = null, currentFormat = '', currentUnit = 'u', displayUnit = 'u';
let currentStats = null, currentStepHeader = null, currentStepResult = null, currentStepProperties = [];
let surfaceMeshes = [], edgeObjects = [], vertexObjects = [], visualEdges = [];
let selectionMode = 'auto', measureEnabled = false, selected = [], currentMeasureResult = null, selectionHighlightMap = new Map();
let edgesVisible = true, clipEnabled = false;
let modelBounds = null, modelSize = 1;
let hoverRAF = 0, preselected = null, selectOtherMenu = null;
let selectionEpoch = 0;
const cadNav = {
  active:false,
  pointerId:null,
  button:-1,
  mode:null,
  startX:0,
  startY:0,
  lastX:0,
  lastY:0,
  moved:false,
  pivot:new THREE.Vector3(),
  wheelFocus:new THREE.Vector3()
};
let dimensionLabel = null, dimensionLabelPoint = null;
let worker = null, workerSeq = 0, workerPending = new Map();
let meshObjectUrls = [];
let baseMaterials = new Set();

const navo3dPreferences={gridVisible:true,edgesVisible:true,selectionMode:'auto',propertiesOpen:false,materialClass:'hard'};
function navo3dPreferenceSnapshot(){return {...navo3dPreferences,edgesVisible:Boolean(edgesVisible),selectionMode,propertiesOpen:Boolean(navo3dPreferences.propertiesOpen),materialClass:sheetMetalState.materialClass};}
const saveNavo3DPrefs=createPreferenceSaver('navo3d',navo3dPreferenceSnapshot,500);
function applyNavo3DPreferences(p={}){
  if(typeof p.gridVisible==='boolean')navo3dPreferences.gridVisible=p.gridVisible;
  if(typeof p.edgesVisible==='boolean')navo3dPreferences.edgesVisible=p.edgesVisible;
  if(['auto','face','edge','vertex'].includes(p.selectionMode))navo3dPreferences.selectionMode=p.selectionMode;
  if(typeof p.propertiesOpen==='boolean')navo3dPreferences.propertiesOpen=p.propertiesOpen;
  if(AIR_BENDING_K_TABLE[p.materialClass])navo3dPreferences.materialClass=p.materialClass;
  edgesVisible=navo3dPreferences.edgesVisible;selectionMode=navo3dPreferences.selectionMode;sheetMetalState.materialClass=navo3dPreferences.materialClass;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clipPlane = new THREE.Plane(new THREE.Vector3(1,0,0), 0);
const blackEdgeMaterial = new THREE.LineBasicMaterial({
  color:0x090b0d,
  transparent:true,
  opacity:0.96,
  depthTest:true,
  depthWrite:false
});
const selectedEdgeMaterial = new THREE.LineBasicMaterial({
  color:0x35d39a,
  depthTest:true,
  depthWrite:false
});
const hoverEdgeMaterial = new THREE.LineBasicMaterial({
  color:0x84eac8,
  depthTest:true,
  depthWrite:false,
  transparent:true,
  opacity:0.95
});
const hoverFaceMaterial = new THREE.MeshBasicMaterial({
  color:0x7ce4c1,
  transparent:true,
  opacity:0.18,
  side:THREE.FrontSide,
  depthTest:true,
  polygonOffset:true,
  polygonOffsetFactor:-2,
  polygonOffsetUnits:-2
});
const SELECTION_BLUE = 0x006dff;
const selectionFaceMaterial = new THREE.MeshBasicMaterial({
  color:SELECTION_BLUE,
  transparent:false,
  opacity:1,
  side:THREE.DoubleSide,
  depthTest:true,
  depthWrite:false,
  depthFunc:THREE.LessEqualDepth,
  polygonOffset:true,
  polygonOffsetFactor:-1,
  polygonOffsetUnits:-1
});

init();

async function init() {
  applyNavo3DPreferences(await loadUserPreferences('navo3d',navo3dPreferences));
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

  // NavoFlo owns all mouse gestures. OrbitControls remains only as a
  // compatibility holder for `target`; its DOM navigation is disabled.
  controls.enabled = false;
  controls.enableDamping = false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.zoomToCursor = false;
  controls.screenSpacePanning = true;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;

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
  E.gridToggle.addEventListener('click', toggleGrid);
  E.unitSelect.addEventListener('change', async () => {
    displayUnit=E.unitSelect.value;
    updateDisplayedUnits();
    await refreshMeasurementUnits();
  });
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
      saveNavo3DPrefs();
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

  E.sheetMetal.addEventListener('click', openSheetMetalPanel);
  E.smMaterial.addEventListener('change', () => {
    sheetMetalState.materialClass=E.smMaterial.value;
    navo3dPreferences.materialClass=sheetMetalState.materialClass;
    saveNavo3DPrefs();
    updateSheetMetalCalculation();
  });
  E.smThickness.addEventListener('input', () => {
    sheetMetalState.thickness=readSheetMetalLengthInput(E.smThickness);
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smRadius.addEventListener('input', () => {
    sheetMetalState.radius=readSheetMetalLengthInput(E.smRadius);
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smAngle.addEventListener('input', () => {
    const value=Number(E.smAngle.value);
    sheetMetalState.bendAngleDeg=Number.isFinite(value)?value:null;
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smManualToggle.addEventListener('change', () => {
    sheetMetalState.manualKEnabled=E.smManualToggle.checked;
    E.smManualRow.hidden=!sheetMetalState.manualKEnabled;
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smManualK.addEventListener('input', () => {
    const value=Number(E.smManualK.value);
    sheetMetalState.manualK=Number.isFinite(value)?value:null;
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smUseMeasure.addEventListener('click', captureSheetMetalThickness);
  E.smUseRadius.addEventListener('click', captureSheetMetalRadius);

  initSheetMetalUI();
  E.edges.classList.toggle('active',edgesVisible);
  E.gridToggle.classList.toggle('active',navo3dPreferences.gridVisible);
  document.querySelectorAll('[data-select-mode]').forEach(button=>button.classList.toggle('active',button.dataset.selectMode===selectionMode));
  E.propsDrawer.hidden=!navo3dPreferences.propertiesOpen;
  syncPropertiesState(false);

  E.fullscreen.addEventListener('click', toggleFullscreen);

  // CAD mouse navigation. One state machine = no fighting mouse handlers.
  // LMB select | MMB rotate | Ctrl+MMB pan | Shift+MMB zoom
  // wheel zoom-to-pointer | RMB drag pan | RMB click Select Other.
  E.canvas.addEventListener('contextmenu', event => event.preventDefault());

  E.canvas.addEventListener('pointerdown', event => {
    if (!currentModel) return;

    if (event.button===0) {
      cadNav.active=true;
      cadNav.pointerId=event.pointerId;
      cadNav.button=0;
      cadNav.mode='select';
      cadNav.startX=cadNav.lastX=event.clientX;
      cadNav.startY=cadNav.lastY=event.clientY;
      cadNav.moved=false;
      closeSelectOther();
      try { E.canvas.setPointerCapture(event.pointerId); } catch {}
      return;
    }

    if (event.button!==1 && event.button!==2) return;

    event.preventDefault();
    closeSelectOther();
    clearPreselection();

    cadNav.active=true;
    cadNav.pointerId=event.pointerId;
    cadNav.button=event.button;
    cadNav.startX=cadNav.lastX=event.clientX;
    cadNav.startY=cadNav.lastY=event.clientY;
    cadNav.moved=false;

    if (event.button===2) {
      cadNav.mode='pan';
      cadNav.pivot.copy(getCadPivotUnderPointer(event.clientX,event.clientY));
    } else if (event.ctrlKey || event.metaKey) {
      cadNav.mode='pan';
      cadNav.pivot.copy(getCadPivotUnderPointer(event.clientX,event.clientY));
    } else if (event.shiftKey) {
      cadNav.mode='zoom';
      cadNav.pivot.copy(getCadPivotUnderPointer(event.clientX,event.clientY));
    } else {
      cadNav.mode='rotate';
      cadNav.pivot.copy(getCadPivotUnderPointer(event.clientX,event.clientY));
    }

    try { E.canvas.setPointerCapture(event.pointerId); } catch {}
    updateCadCursor();
  }, true);

  E.canvas.addEventListener('pointermove', event => {
    if (cadNav.active && event.pointerId===cadNav.pointerId) {
      const dx=event.clientX-cadNav.lastX;
      const dy=event.clientY-cadNav.lastY;
      const total=Math.hypot(event.clientX-cadNav.startX,event.clientY-cadNav.startY);
      if (total>3) cadNav.moved=true;

      if (cadNav.mode==='rotate' && (event.buttons&4)) {
        event.preventDefault();
        clearPreselection();
        cadRotate(dx,dy,cadNav.pivot);
      } else if (cadNav.mode==='pan' && ((cadNav.button===1 && (event.buttons&4)) || (cadNav.button===2 && (event.buttons&2)))) {
        event.preventDefault();
        clearPreselection();
        cadPan(dx,dy);
      } else if (cadNav.mode==='zoom' && (event.buttons&4)) {
        event.preventDefault();
        clearPreselection();
        cadDragZoom(dy,event.clientX,event.clientY);
      }

      cadNav.lastX=event.clientX;
      cadNav.lastY=event.clientY;
      return;
    }

    if (!currentModel) return;
    if (hoverRAF) cancelAnimationFrame(hoverRAF);
    const x=event.clientX,y=event.clientY;
    hoverRAF=requestAnimationFrame(()=>{
      hoverRAF=0;
      updatePreselection(x,y);
    });
  });

  const finishPointerInteraction = event => {
    if (!cadNav.active || event.pointerId!==cadNav.pointerId) return;

    const mode=cadNav.mode;
    const button=cadNav.button;
    const moved=cadNav.moved;

    try {
      if (E.canvas.hasPointerCapture?.(event.pointerId)) {
        E.canvas.releasePointerCapture(event.pointerId);
      }
    } catch {}

    cadNav.active=false;
    cadNav.pointerId=null;
    cadNav.button=-1;
    cadNav.mode=null;
    updateCadCursor();

    if (event.type==='pointercancel') return;

    if (button===0 && mode==='select' && !moved) {
      selectAt(event);
      return;
    }

    if (button===2 && !moved) {
      openSelectOther(event.clientX,event.clientY);
    }
  };

  E.canvas.addEventListener('pointerup', finishPointerInteraction, true);
  E.canvas.addEventListener('pointercancel', finishPointerInteraction, true);
  E.canvas.addEventListener('wheel', handleCadWheelZoom, {passive:false});

  E.canvas.addEventListener('pointerleave', () => {
    if (!cadNav.active) clearPreselection();
  });

  addEventListener('keydown', event => {
    if (event.target && ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;

    if (event.key === 'Escape') {
      closeSelectOther();
      clearSelections();
      clearPreselection();
      return;
    }

    if (!currentModel) return;

    const key=event.key.toLowerCase();

    if (key==='f') {
      event.preventDefault();
      fitCamera('iso');
    } else if (key==='m') {
      event.preventDefault();
      toggleMeasure();
    } else if (key==='e') {
      event.preventDefault();
      toggleEdges();
    } else if (key==='p') {
      event.preventDefault();
      E.propsDrawer.hidden=!E.propsDrawer.hidden;
      syncPropertiesState();
    } else if (event.code==='Space') {
      event.preventDefault();
      E.viewMenu.hidden=!E.viewMenu.hidden;
    }
  });

  addEventListener('beforeunload', () => {
    revokeObjectUrls();
    try { worker?.terminate(); } catch {}
  });
}




function initSheetMetalUI() {
  if(!E.sheetMetalSection)return;

  E.smMaterial.value=sheetMetalState.materialClass;
  E.smAngle.value=String(sheetMetalState.bendAngleDeg);
  E.smManualToggle.checked=sheetMetalState.manualKEnabled;
  E.smManualRow.hidden=!sheetMetalState.manualKEnabled;
  E.smManualK.value=String(sheetMetalState.manualK);
  syncSheetMetalInputs();
}

function resetSheetMetalForModel() {
  sheetMetalState.thickness=null;
  sheetMetalState.radius=null;
  sheetMetalState.bendAngleDeg=90;
  sheetMetalState.manualKEnabled=false;
  sheetMetalState.manualK=AIR_BENDING_K_TABLE[sheetMetalState.materialClass]?.toThickness ?? 0.40;

  if(E.smAngle)E.smAngle.value='90';
  if(E.smManualToggle)E.smManualToggle.checked=false;
  if(E.smManualRow)E.smManualRow.hidden=true;
  if(E.smManualK)E.smManualK.value=String(sheetMetalState.manualK);
  syncSheetMetalInputs();
}

function openSheetMetalPanel() {
  if(!currentStepResult){
    setSheetMetalStatus(SMT.needStep,'warn');
    return;
  }

  E.propsDrawer.hidden=false;
  E.sheetMetalSection.hidden=false;
  syncPropertiesState();

  requestAnimationFrame(()=>{
    E.sheetMetalSection.scrollIntoView({behavior:'smooth',block:'start'});
    E.sheetMetalSection.classList.remove('attention');
    void E.sheetMetalSection.offsetWidth;
    E.sheetMetalSection.classList.add('attention');
  });
}

function setSheetMetalStatus(message,kind='') {
  if(!E.smStatus)return;
  E.smStatus.textContent=message;
  E.smStatus.className=`sheetmetal-status${kind?' '+kind:''}`;
}

function readSheetMetalLengthInput(input) {
  if(!input)return null;
  const raw=String(input.value??'').trim().replace(',','.');
  if(!raw)return null;

  const value=Number(raw);
  if(!Number.isFinite(value))return null;

  return value*unitScale(displayUnit,currentUnit);
}

function formatSheetMetalScalar(value,digits=5) {
  if(!Number.isFinite(value))return '';
  return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{
    useGrouping:false,
    maximumFractionDigits:digits
  }).format(value);
}

function setSheetMetalLengthInput(input,value) {
  if(!input)return;
  if(!Number.isFinite(value)){
    input.value='';
    return;
  }

  const converted=value*unitScale(currentUnit,displayUnit);
  input.value=String(Number(converted.toPrecision(10)));
}

function getAirBendingRule(materialClass,radius,thickness) {
  if(!Number.isFinite(thickness)||thickness<=0||!Number.isFinite(radius)||radius<0)return null;

  const ratio=radius/thickness;
  const table=AIR_BENDING_K_TABLE[materialClass]||AIR_BENDING_K_TABLE.hard;

  if(ratio<=1){
    return {ratio,band:'toThickness',bandLabel:SMT.band1,k:table.toThickness};
  }
  if(ratio<=3){
    return {ratio,band:'to3Thickness',bandLabel:SMT.band2,k:table.to3Thickness};
  }
  return {ratio,band:'over3Thickness',bandLabel:SMT.band3,k:table.over3Thickness};
}

function calculateAirBendParameters({
  materialClass,
  thickness,
  radius,
  bendAngleDeg,
  manualKEnabled=false,
  manualK=null
}) {
  const rule=getAirBendingRule(materialClass,radius,thickness);
  if(!rule)return null;

  const angle=Number(bendAngleDeg);
  if(!Number.isFinite(angle)||angle<=0||angle>=180)return null;

  const resolvedK=manualKEnabled?Number(manualK):rule.k;
  if(!Number.isFinite(resolvedK)||resolvedK<0||resolvedK>1)return null;

  const angleRad=THREE.MathUtils.degToRad(angle);
  const neutralRadius=radius+resolvedK*thickness;
  const bendAllowance=angleRad*neutralRadius;
  const outsideSetback=Math.tan(angleRad/2)*(radius+thickness);
  const bendDeduction=2*outsideSetback-bendAllowance;

  return {
    ...rule,
    materialClass,
    thickness,
    radius,
    bendAngleDeg:angle,
    k:resolvedK,
    automaticK:rule.k,
    manualKEnabled:Boolean(manualKEnabled),
    neutralRadius,
    bendAllowance,
    outsideSetback,
    bendDeduction
  };
}

function syncSheetMetalInputs() {
  if(!E.sheetMetalSection)return;

  const unit=unitLabel(displayUnit);
  E.smThicknessUnit.textContent=unit;
  E.smRadiusUnit.textContent=unit;
  E.smMaterial.value=sheetMetalState.materialClass;

  setSheetMetalLengthInput(E.smThickness,sheetMetalState.thickness);
  setSheetMetalLengthInput(E.smRadius,sheetMetalState.radius);

  if(Number.isFinite(sheetMetalState.bendAngleDeg)){
    E.smAngle.value=String(sheetMetalState.bendAngleDeg);
  }

  E.smManualToggle.checked=sheetMetalState.manualKEnabled;
  E.smManualRow.hidden=!sheetMetalState.manualKEnabled;

  if(Number.isFinite(sheetMetalState.manualK)){
    E.smManualK.value=String(sheetMetalState.manualK);
  }

  updateSheetMetalCalculation({preserveInputs:true});
}

function updateSheetMetalCalculation({preserveInputs=false}={}) {
  if(!E.sheetMetalSection)return;

  if(!preserveInputs){
    syncSheetMetalInputs();
    return;
  }

  E.smRatio.textContent='—';
  E.smBand.textContent='—';
  E.smK.textContent='—';
  E.smNeutralRadius.textContent='—';
  E.smBendAllowance.textContent='—';
  E.smBendDeduction.textContent='—';

  if(!currentStepResult){
    setSheetMetalStatus(SMT.needStep,'warn');
    return;
  }

  if(sheetMetalState.thickness==null||sheetMetalState.radius==null){
    setSheetMetalStatus(SMT.needValues);
    return;
  }

  if(
    !Number.isFinite(sheetMetalState.thickness) ||
    sheetMetalState.thickness<=0 ||
    !Number.isFinite(sheetMetalState.radius) ||
    sheetMetalState.radius<0
  ){
    setSheetMetalStatus(SMT.invalidValues,'warn');
    return;
  }

  const result=calculateAirBendParameters(sheetMetalState);
  if(!result){
    setSheetMetalStatus(SMT.invalidValues,'warn');
    return;
  }

  E.smRatio.textContent=formatNumber(result.ratio);
  E.smBand.textContent=result.bandLabel;
  E.smK.textContent=`${formatSheetMetalScalar(result.k,3)}${result.manualKEnabled?' · MANUAL':' · AUTO'}`;
  E.smNeutralRadius.textContent=formatLength(result.neutralRadius);
  E.smBendAllowance.textContent=formatLength(result.bendAllowance);
  E.smBendDeduction.textContent=formatLength(result.bendDeduction);

  const source=result.manualKEnabled?SMT.manualK:SMT.autoK;
  setSheetMetalStatus(`${SMT.calculationReady} · ${source}`,'ok');
}

function captureSheetMetalThickness() {
  if(!currentStepResult){
    setSheetMetalStatus(SMT.needStep,'warn');
    return;
  }

  const validPair=
    selected.length===2 &&
    selected.every(item=>item.kind==='face') &&
    currentMeasureResult?.ok &&
    currentMeasureResult.kind!=='angle' &&
    currentMeasureResult.kind!=='center-center' &&
    Number.isFinite(currentMeasureResult.value) &&
    currentMeasureResult.value>0;

  if(!validPair){
    setSheetMetalStatus(SMT.thicknessUnavailable,'warn');
    return;
  }

  sheetMetalState.thickness=currentMeasureResult.value;
  syncSheetMetalInputs();
  setSheetMetalStatus(SMT.capturedThickness,'ok');
}

async function captureSheetMetalRadius() {
  if(!currentStepResult){
    setSheetMetalStatus(SMT.needStep,'warn');
    return;
  }

  if(selected.length!==1){
    setSheetMetalStatus(SMT.radiusUnavailable,'warn');
    return;
  }

  setSheetMetalStatus(SMT.measurementBusy);

  try{
    const details=await workerRequest('inspect',{selection:serialSelection(selected[0])});
    let radius=Number(details?.radius);

    if(!Number.isFinite(radius) && Number.isFinite(details?.diameter)){
      radius=Number(details.diameter)/2;
    }

    if(!Number.isFinite(radius)||radius<0){
      setSheetMetalStatus(SMT.exactRadiusUnavailable,'warn');
      return;
    }

    sheetMetalState.radius=radius;
    syncSheetMetalInputs();
    setSheetMetalStatus(SMT.capturedRadius,'ok');
  }catch(error){
    console.warn('[NavoFlo sheet metal radius]',error);
    setSheetMetalStatus(SMT.exactRadiusUnavailable,'warn');
  }
}


function syncPropertiesState(persist=true) {
  const open = !E.propsDrawer.hidden;
  E.workspace.classList.toggle('properties-open', open);
  if(persist){navo3dPreferences.propertiesOpen=open;saveNavo3DPrefs();}
  requestAnimationFrame(resize);
}

function toggleFullscreen() {
  const active=!E.workspace.classList.contains('is-fullscreen');
  E.workspace.classList.toggle('is-fullscreen',active);
  document.body.classList.toggle('navo3d-focus-mode',active);
  E.fullscreen.classList.toggle('active',active);
  E.fullscreen.title=active?T.exitFullscreen:T.fullscreen;
  const label=E.fullscreen.querySelector('span:last-child');
  if(label)label.textContent=active?T.exitFullscreen:T.fullscreen;
  const icon=E.fullscreen.querySelector('.fullscreen-icon');
  if(icon)icon.textContent=active?'🗗':'⛶';
  requestAnimationFrame(()=>{resize();requestAnimationFrame(resize);});
}

function syncFullscreenState() {
  const active=E.workspace.classList.contains('is-fullscreen');
  E.fullscreen.classList.toggle('active',active);
  requestAnimationFrame(resize);
}


function getModelRotationCenter() {
  if (!currentModel) return new THREE.Vector3(0,0,0);
  const box=new THREE.Box3().setFromObject(modelRoot);
  if (box.isEmpty()) return new THREE.Vector3(0,0,0);
  return box.getCenter(new THREE.Vector3());
}

function getCadPivotUnderPointer(clientX,clientY) {
  if (!currentModel) return getModelRotationCenter();

  setRayFromClient(clientX,clientY);
  const hit=raycaster.intersectObjects(surfaceMeshes,false)[0]||null;

  if (hit) {
    cadNav.wheelFocus.copy(hit.point);
    return hit.point.clone();
  }

  // MMB in empty space never snaps the model back to center.
  if (cadNav.wheelFocus.lengthSq()>1e-20) return cadNav.wheelFocus.clone();
  return getModelRotationCenter();
}

function updateCadCursor() {
  if (!E.canvas) return;
  E.canvas.style.cursor=(cadNav.active && ['rotate','pan','zoom'].includes(cadNav.mode))
    ? 'grabbing'
    : '';
}

function rotateCameraRigidlyAroundPivot(axis,angle,pivot) {
  if (!Number.isFinite(angle) || Math.abs(angle)<1e-9) return;

  const q=new THREE.Quaternion().setFromAxisAngle(axis,angle);
  const relative=camera.position.clone().sub(pivot).applyQuaternion(q);
  camera.position.copy(pivot).add(relative);

  // Position and orientation get the same rigid transform. The point under
  // MMB stays under the same screen pixel instead of snapping to screen center.
  camera.quaternion.premultiply(q).normalize();
}

function cadRotate(dx,dy,pivot) {
  if (!camera || (!dx&&!dy)) return;

  const rect=E.canvas.getBoundingClientRect();
  const sensitivity=(Math.PI*1.15)/Math.max(320,Math.min(rect.width,rect.height));

  if (dx) {
    const screenUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).normalize();
    rotateCameraRigidlyAroundPivot(screenUp,-dx*sensitivity,pivot);
  }

  if (dy) {
    const screenRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize();
    rotateCameraRigidlyAroundPivot(screenRight,-dy*sensitivity,pivot);
  }

  controls.target.copy(pivot);
  updateZoomClipping();
  updateDimensionLabelPosition();
}

function getCadPanWorldPerPixel() {
  const rect=E.canvas.getBoundingClientRect();
  const pivot=cadNav.pivot.lengthSq()>1e-20 ? cadNav.pivot : getModelRotationCenter();
  const distance=Math.max(camera.position.distanceTo(pivot),modelSize*0.02,1e-6);
  const worldHeight=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov)*0.5);
  return worldHeight/Math.max(rect.height,1);
}

function cadPan(dx,dy) {
  if (!camera || (!dx&&!dy)) return;

  const units=getCadPanWorldPerPixel();
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize();
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).normalize();
  const translation=right.multiplyScalar(-dx*units).add(up.multiplyScalar(dy*units));

  camera.position.add(translation);
  controls.target.add(translation);
  cadNav.pivot.add(translation);
  if (cadNav.wheelFocus.lengthSq()>1e-20) cadNav.wheelFocus.add(translation);

  updateZoomClipping();
  updateDimensionLabelPosition();
}

function cadDragZoom(dy,clientX,clientY) {
  if (!dy) return;

  setRayFromClient(clientX,clientY);
  const direction=raycaster.ray.direction.clone().normalize();
  const reference=getCadZoomReferenceDistance(clientX,clientY);
  const fraction=1-Math.exp(-Math.abs(dy)*0.012);
  const minimum=getCadZoomMinimumStep();
  const travel=Math.max(reference*fraction,minimum*Math.min(Math.abs(dy),8));

  camera.position.addScaledVector(direction,dy<0?travel:-travel);
  updateZoomClipping();
  updateDimensionLabelPosition();
}

function resize() {
  if (!renderer) return;
  const rect=E.workspace.getBoundingClientRect();
  const w=Math.max(1,Math.floor(rect.width)), h=Math.max(1,Math.floor(rect.height));
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
}

function render() {
  renderer?.render(scene,camera);
  updateDimensionLabelPosition();
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
      displayUnit='mm';
      E.unitSelect.value='mm';
      currentStepProperties=[];
      scanStepProperties(main).then(properties=>{
        if(currentFile!==main)return;
        currentStepProperties=properties;
        renderStepCustomProperties();
      }).catch(error=>console.warn('[NavoFlo STEP metadata]',error));
      buildExactStepScene(result);
    } else {
      currentStepResult=null;
      currentUnit='u';
      displayUnit='u';
      E.unitSelect.value='u';
      currentStepProperties=[];
      await buildMeshScene(main,files);
    }

    finalizeLoadedModel();
    E.propsDrawer.hidden=!navo3dPreferences.propertiesOpen;
    syncPropertiesState(false);
    fillProperties();
    E.empty.classList.add('hidden');
    enableTools(true);
    E.statusFile.textContent=main.name;
    E.statusFormat.textContent=currentFormat;
    E.statusUnits.textContent=unitLabel(displayUnit);
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
    color,
    metalness:0.08,
    roughness:0.56,
    side:THREE.DoubleSide,
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
    line.visible=edgesVisible;
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
    edges.visible=edgesVisible;
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

  cadNav.pivot.copy(box.getCenter(new THREE.Vector3()));
  cadNav.wheelFocus.copy(cadNav.pivot);
  controls.target.copy(cadNav.pivot);
  updateZoomClipping();

  createGrid(niceGrid(modelSize*1.6));
  grid.position.y=box.min.y-modelSize*0.003;
  updatePickingVisibility();
}

function createGrid(size) {
  if (grid) {scene.remove(grid);grid.geometry.dispose();grid.material.dispose();}
  grid=new THREE.GridHelper(size,20,0x263b34,0x17241f);
  grid.material.opacity=.34;grid.material.transparent=true;grid.visible=navo3dPreferences.gridVisible;scene.add(grid);
}
function niceGrid(v){const p=10**Math.floor(Math.log10(v)),s=v/p;return(s<=1?1:s<=2?2:s<=5?5:10)*p}

function toggleGrid() {
  if(!grid)return;
  grid.visible=!grid.visible;
  navo3dPreferences.gridVisible=grid.visible;
  E.gridToggle.classList.toggle('active',grid.visible);
  saveNavo3DPrefs();
}


function normalizeWheelDelta(event) {
  let delta=event.deltaY;
  if(event.deltaMode===1) delta*=16;
  else if(event.deltaMode===2) delta*=Math.max(E.workspace.clientHeight,600);
  return delta;
}

function getCadZoomMinimumStep() {
  if(!modelBounds)return Math.max(modelSize*0.00005,1e-7);

  const size=modelBounds.getSize(new THREE.Vector3());
  const dimensions=[size.x,size.y,size.z]
    .filter(value=>Number.isFinite(value)&&value>modelSize*1e-8)
    .sort((a,b)=>a-b);
  const smallest=dimensions[0]||modelSize;

  return Math.max(smallest*0.004,modelSize*0.00005,1e-7);
}

function getCadZoomReferenceDistance(clientX,clientY) {
  setRayFromClient(clientX,clientY);
  const hit=raycaster.intersectObjects(surfaceMeshes,false)[0]||null;

  if(hit){
    cadNav.wheelFocus.copy(hit.point);
    return Math.max(hit.distance,1e-7);
  }

  const focus=cadNav.wheelFocus.lengthSq()>1e-20
    ? cadNav.wheelFocus
    : getModelRotationCenter();

  return Math.max(camera.position.distanceTo(focus),modelSize*0.05,1e-7);
}

function handleCadWheelZoom(event) {
  if(!currentModel||!camera)return;

  event.preventDefault();
  event.stopPropagation();
  closeSelectOther();
  clearPreselection();

  const delta=normalizeWheelDelta(event);
  if(!Number.isFinite(delta)||Math.abs(delta)<0.001)return;

  setRayFromClient(event.clientX,event.clientY);
  const direction=raycaster.ray.direction.clone().normalize();
  const reference=getCadZoomReferenceDistance(event.clientX,event.clientY);

  // One wheel notch feels decisive; precision-trackpad deltas stay smooth.
  // No accumulated zoom state means reversing direction reacts immediately.
  const wheelUnits=THREE.MathUtils.clamp(Math.abs(delta)/100,0.01,5);
  const fraction=1-Math.exp(-0.18*wheelUnits);
  const minimum=getCadZoomMinimumStep()*Math.max(0.35,wheelUnits);
  const travel=Math.max(reference*fraction,minimum);

  camera.position.addScaledVector(direction,delta<0?travel:-travel);
  updateZoomClipping();
  updateDimensionLabelPosition();
}

function updateZoomClipping() {
  if(!camera||!currentModel)return;

  const box=modelBounds||new THREE.Box3().setFromObject(modelRoot);

  if(box.isEmpty()){
    camera.near=0.01;
    camera.far=1000;
    camera.updateProjectionMatrix();
    return;
  }

  const sphere=box.getBoundingSphere(new THREE.Sphere());
  const radius=Math.max(sphere.radius,modelSize*0.001,1e-5);
  const centerDistance=Math.max(camera.position.distanceTo(sphere.center),1e-7);

  // Distance from camera to the model's bounding box is a better close-up
  // signal than OrbitControls.target now that CAD zoom translates both.
  const boxDistance=Math.max(box.distanceToPoint(camera.position),radius*0.00001);

  // Keep enough depth-buffer precision to avoid the visual artifacts seen
  // with an ultra-small near plane + enormous far plane.
  camera.near=Math.max(
    Math.min(boxDistance*0.08,radius*0.025),
    radius*0.00001,
    1e-7
  );

  const modelBack=centerDistance+radius*2.75;
  camera.far=Math.max(modelBack,camera.near*10000,10);

  camera.updateProjectionMatrix();
}



function selectAt(event) {
  const selection = pickSelectionCandidate(event.clientX,event.clientY);

  if (!selection) {
    // CAD-style behavior:
    // clicking empty space clears the active selection.
    // In Measure mode this immediately prepares the next measurement.
    if (!event.ctrlKey && !event.metaKey) {
      clearSelections();
      clearPreselection();
    }
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

function getFrontSurfaceDistance() {
  const hit=raycaster.intersectObjects(surfaceMeshes,false)[0];
  return hit ? hit.distance : Infinity;
}

function isPickVisible(hitDistance,frontSurfaceDistance,kind='edge') {
  if (!Number.isFinite(frontSurfaceDistance)) return true;

  // Topology edges/vertices live on the surface itself, but their ray hit
  // can be a fraction behind the triangle because the Line/Points picker
  // uses a tolerance radius. Give only a small model-relative allowance.
  const baseTolerance=Math.max(modelSize*0.00065,1e-7);
  const tolerance=kind==='vertex' ? baseTolerance*1.15 : baseTolerance;

  return hitDistance <= frontSurfaceDistance + tolerance;
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

  // This is the opaque surface physically closest to the camera on the
  // current mouse ray. Edges/vertices farther behind it are not clickable.
  const frontSurfaceHit=raycaster.intersectObjects(surfaceMeshes,false)[0]||null;
  const frontSurfaceDistance=frontSurfaceHit?.distance ?? Infinity;

  if (wantVertex) {
    const hits=raycaster.intersectObjects(vertexObjects,false).slice(0,8);
    for (const hit of hits) {
      if (!isPickVisible(hit.distance,frontSurfaceDistance,'vertex')) continue;
      const selection=selectionFromVertex(hit);
      const px=screenDistance(selection.point,clientX,clientY,rect);
      if (!vertexCandidate || px<vertexCandidate.px) {
        vertexCandidate={selection,px,depth:hit.distance};
      }
    }
  }

  if (wantEdge) {
    const hits=raycaster.intersectObjects(edgeObjects,false).slice(0,12);
    for (const hit of hits) {
      if (!isPickVisible(hit.distance,frontSurfaceDistance,'edge')) continue;
      const selection=selectionFromEdge(hit);
      const px=screenDistance(selection.point,clientX,clientY,rect);
      if (!edgeCandidate || px<edgeCandidate.px || (Math.abs(px-edgeCandidate.px)<0.5&&hit.distance<edgeCandidate.depth)) {
        edgeCandidate={selection,px,depth:hit.distance};
      }
    }
  }

  if (wantFace && frontSurfaceHit) {
    const selection=selectionFromFace(frontSurfaceHit);
    if (selection) faceCandidate={selection,px:0,depth:frontSurfaceHit.distance};
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

  // A committed selection must remain visually locked in blue.
  // Do not place the hover/preselection color over it.
  if(candidate && selected.some(item=>selectionKey(item)===key)){
    clearPreselection();
    return;
  }

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
    const radius=Math.max(modelSize*0.0018,0.0001);
    const sphere=new THREE.Mesh(
      new THREE.SphereGeometry(radius,14,10),
      new THREE.MeshBasicMaterial({
        color:0x84eac8,
        depthTest:true,
        depthWrite:false,
        transparent:true,
        opacity:0.9
      })
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

function collectSelectionCandidates(clientX,clientY) {
  const rect=setRayFromClient(clientX,clientY);
  const candidates=[];
  const seen=new Set();

  const frontSurfaceHit=raycaster.intersectObjects(surfaceMeshes,false)[0]||null;
  const frontSurfaceDistance=frontSurfaceHit?.distance ?? Infinity;

  const push=(selection,score,depth)=>{
    if(!selection)return;
    const key=selectionKey(selection);
    if(seen.has(key))return;
    seen.add(key);
    candidates.push({selection,score,depth});
  };

  if (!currentStepResult) {
    for(const hit of raycaster.intersectObjects(surfaceMeshes,true).slice(0,5)) {
      push({kind:'point',point:hit.point.clone(),object:hit.object,meshOnly:true},0,hit.distance);
    }
    return candidates.sort((a,b)=>a.depth-b.depth).map(x=>x.selection);
  }

  for(const hit of raycaster.intersectObjects(vertexObjects,false).slice(0,8)) {
    if(!isPickVisible(hit.distance,frontSurfaceDistance,'vertex'))continue;
    const selection=selectionFromVertex(hit);
    push(selection,screenDistance(selection.point,clientX,clientY,rect)-4,hit.distance);
  }

  for(const hit of raycaster.intersectObjects(edgeObjects,false).slice(0,16)) {
    if(!isPickVisible(hit.distance,frontSurfaceDistance,'edge'))continue;
    const selection=selectionFromEdge(hit);
    push(selection,screenDistance(selection.point,clientX,clientY,rect)-2,hit.distance);
  }

  // Keep only the physically front-most face in Select Other by default.
  // Hidden/back faces should not leak through an opaque solid.
  if(frontSurfaceHit) {
    const selection=selectionFromFace(frontSurfaceHit);
    push(selection,6,frontSurfaceHit.distance);
  }

  return candidates
    .sort((a,b)=>(a.score-b.score)||(a.depth-b.depth))
    .slice(0,10)
    .map(x=>x.selection);
}

function ensureSelectOtherMenu() {
  if(selectOtherMenu)return selectOtherMenu;

  const menu=document.createElement('div');
  menu.className='cad-select-other';
  menu.hidden=true;
  E.workspace.appendChild(menu);
  selectOtherMenu=menu;
  return menu;
}

function openSelectOther(clientX,clientY) {
  const candidates=collectSelectionCandidates(clientX,clientY);
  if(!candidates.length) {
    closeSelectOther();
    return;
  }

  const menu=ensureSelectOtherMenu();
  menu.replaceChildren();

  const title=document.createElement('div');
  title.className='cad-select-other-title';
  title.textContent=FR?'SÉLECTIONNER AUTRE':'SELECT OTHER';
  menu.appendChild(title);

  candidates.forEach((selection,index)=>{
    const button=document.createElement('button');
    button.type='button';

    const kind=document.createElement('span');
    kind.className='entity-kind';
    kind.textContent=labelKind(selection.kind).toUpperCase();

    const name=document.createElement('span');
    name.className='entity-name';
    const objName=selection.object?.parent?.name||selection.object?.name||'';
    name.textContent=objName || (FR?'Entité':'Entity');

    const id=document.createElement('span');
    id.className='entity-id';
    id.textContent=selection.elementId!=null?`#${selection.elementId}`:`${index+1}`;

    button.append(kind,name,id);
    button.addEventListener('mouseenter',()=>{
      clearPreselection();
      preselected=selection;
      E.workspace.classList.add('has-preselection');
      highlightPreselection(selection);
    });
    button.addEventListener('click',event=>{
      event.stopPropagation();
      closeSelectOther();
      acceptSelection(selection,event);
    });

    menu.appendChild(button);
  });

  const rect=E.workspace.getBoundingClientRect();
  const x=Math.max(8,Math.min(clientX-rect.left,rect.width-325));
  const y=Math.max(62,Math.min(clientY-rect.top,rect.height-390));
  menu.style.left=`${x}px`;
  menu.style.top=`${y}px`;
  menu.hidden=false;
}

function closeSelectOther() {
  if(selectOtherMenu)selectOtherMenu.hidden=true;
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
    kind:'face',
    geometryId:o.userData.geometryId,
    elementId:Number(id),
    point:hit.point.clone(),
    object:o,
    def,
    transform:o.matrixWorld.toArray()
  };
}


function closestPointOnSegment(point,a,b) {
  const ab=b.clone().sub(a);
  const denom=ab.lengthSq();

  if(denom<=1e-20)return a.clone();

  const t=THREE.MathUtils.clamp(
    point.clone().sub(a).dot(ab)/denom,
    0,
    1
  );

  return a.clone().add(ab.multiplyScalar(t));
}

function getSelectedEdgeDirection(selection) {
  if(selection?.kind!=='edge'||!selection.object?.geometry)return null;

  const attr=selection.object.geometry.getAttribute('position');
  if(!attr||attr.count<2)return null;

  let bestDirection=null;
  let bestDistance=Infinity;
  const worldMatrix=selection.object.matrixWorld;

  for(let i=0;i<attr.count-1;i++){
    const a=new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(worldMatrix);
    const b=new THREE.Vector3().fromBufferAttribute(attr,i+1).applyMatrix4(worldMatrix);

    const direction=b.clone().sub(a);
    if(direction.lengthSq()<=1e-20)continue;

    const closest=closestPointOnSegment(selection.point,a,b);
    const distance=closest.distanceToSquared(selection.point);

    if(distance<bestDistance){
      bestDistance=distance;
      bestDirection=direction.normalize();
    }
  }

  return bestDirection;
}

function getSelectedFaceNormal(selection) {
  if(selection?.kind!=='face'||!selection.def?.facesById)return null;

  const face=selection.def.facesById.get(Number(selection.elementId));
  const geometry=selection.def.geometry;
  if(!face||!geometry?.index)return null;

  const positions=geometry.getAttribute('position');
  const indices=geometry.index.array;
  const matrix=selection.object.matrixWorld;

  let bestNormal=null;
  let bestDistance=Infinity;

  for(let offset=face.firstIndex;offset<face.firstIndex+face.indexCount;offset+=3){
    const ia=indices[offset];
    const ib=indices[offset+1];
    const ic=indices[offset+2];

    if(ia==null||ib==null||ic==null)continue;

    const a=new THREE.Vector3().fromBufferAttribute(positions,ia).applyMatrix4(matrix);
    const b=new THREE.Vector3().fromBufferAttribute(positions,ib).applyMatrix4(matrix);
    const c=new THREE.Vector3().fromBufferAttribute(positions,ic).applyMatrix4(matrix);

    const normal=b.clone().sub(a).cross(c.clone().sub(a));
    if(normal.lengthSq()<=1e-20)continue;
    normal.normalize();

    const centroid=a.clone().add(b).add(c).multiplyScalar(1/3);
    const distance=centroid.distanceToSquared(selection.point);

    if(distance<bestDistance){
      bestDistance=distance;
      bestNormal=normal;
    }
  }

  return bestNormal;
}

function getAngleSelectionVector(selection) {
  if(selection?.kind==='edge'){
    const direction=getSelectedEdgeDirection(selection);
    return direction ? {type:'line',vector:direction} : null;
  }

  if(selection?.kind==='face'){
    const normal=getSelectedFaceNormal(selection);
    return normal ? {type:'plane',vector:normal} : null;
  }

  return null;
}

function getFaceTriangleNormals(selection) {
  if(selection?.kind!=='face'||!selection.def?.facesById)return [];

  const face=selection.def.facesById.get(Number(selection.elementId));
  const geometry=selection.def.geometry;
  if(!face||!geometry?.index)return [];

  const positions=geometry.getAttribute('position');
  const indices=geometry.index.array;
  const matrix=selection.object.matrixWorld;
  const normals=[];

  for(let offset=face.firstIndex;offset<face.firstIndex+face.indexCount;offset+=3){
    const ia=indices[offset];
    const ib=indices[offset+1];
    const ic=indices[offset+2];
    if(ia==null||ib==null||ic==null)continue;

    const a=new THREE.Vector3().fromBufferAttribute(positions,ia).applyMatrix4(matrix);
    const b=new THREE.Vector3().fromBufferAttribute(positions,ib).applyMatrix4(matrix);
    const c=new THREE.Vector3().fromBufferAttribute(positions,ic).applyMatrix4(matrix);

    const normal=b.clone().sub(a).cross(c.clone().sub(a));
    if(normal.lengthSq()<=1e-20)continue;
    normals.push(normal.normalize());
  }

  return normals;
}

function isSelectedFacePlanar(selection) {
  const normals=getFaceTriangleNormals(selection);
  if(!normals.length)return false;

  const reference=normals[0];
  return normals.every(normal=>Math.abs(reference.dot(normal))>=0.9985);
}

function isSelectedEdgeLinear(selection) {
  if(selection?.kind!=='edge'||!selection.object?.geometry)return false;

  const attr=selection.object.geometry.getAttribute('position');
  if(!attr||attr.count<2)return false;

  let reference=null;

  for(let i=0;i<attr.count-1;i++){
    const a=new THREE.Vector3().fromBufferAttribute(attr,i);
    const b=new THREE.Vector3().fromBufferAttribute(attr,i+1);
    const direction=b.sub(a);

    if(direction.lengthSq()<=1e-20)continue;
    direction.normalize();

    if(!reference){
      reference=direction;
      continue;
    }

    if(Math.abs(reference.dot(direction))<0.9985)return false;
  }

  return Boolean(reference);
}

function isSmartAngleEntity(selection) {
  if(selection?.kind==='face')return isSelectedFacePlanar(selection);
  if(selection?.kind==='edge')return isSelectedEdgeLinear(selection);
  return false;
}

function getSmartAngleResult(a,b) {
  if(!isSmartAngleEntity(a)||!isSmartAngleEntity(b))return null;

  const result=measureAngleFallback(a,b);
  if(!result?.ok||!Number.isFinite(result.value))return null;

  const minAngle=THREE.MathUtils.degToRad(0.25);

  // Parallel / same-axis entities stay in the normal Smart distance/center
  // workflow. Anything genuinely nonparallel becomes an angular dimension.
  if(result.value<=minAngle)return null;

  return result;
}

function measureAngleFallback(a,b) {
  const va=getAngleSelectionVector(a);
  const vb=getAngleSelectionVector(b);

  if(!va||!vb)return null;

  const dot=THREE.MathUtils.clamp(
    Math.abs(va.vector.dot(vb.vector)),
    0,
    1
  );

  let radians;

  if(va.type==='plane'&&vb.type==='plane'){
    // Smallest angle between two planes = angle between their normals.
    radians=Math.acos(dot);
  }else if(va.type==='line'&&vb.type==='line'){
    // Smallest angle between line directions.
    radians=Math.acos(dot);
  }else{
    // Line ↔ plane:
    // angle(line, plane) = 90° - angle(line, plane normal).
    radians=Math.asin(dot);
  }

  if(!Number.isFinite(radians))return null;

  return {
    ok:true,
    kind:'angle',
    value:radians,
    pointA:a.point?.toArray?.()||null,
    pointB:b.point?.toArray?.()||null,
    fallback:true
  };
}

async function acceptSelection(selection, event={}) {
  // Once clicked, the hover overlay must get out of the way immediately.
  // The committed blue overlay is the only visual state until deselection.
  clearPreselection();

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

  const epoch=++selectionEpoch;
  const selectedKeysAtRequest=selected.map(selectionKey).join('|');

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
      if(epoch!==selectionEpoch || selected.map(selectionKey).join('|')!==selectedKeysAtRequest)return;
      showSingleExact(details);
      E.selectionSummary.textContent=T.selectSecond;
    } else if (selected.length===2) {
      const mode=E.measureType.value;
      let result;

      if(mode==='smart'){
        const smartAngle=getSmartAngleResult(selected[0],selected[1]);

        if(smartAngle){
          const exactAngle=await workerRequest('measure',{
            a:serialSelection(selected[0]),
            b:serialSelection(selected[1]),
            mode:'angle'
          });
          if(epoch!==selectionEpoch || selected.map(selectionKey).join('|')!==selectedKeysAtRequest)return;

          result=exactAngle?.ok ? exactAngle : smartAngle;
        }else{
          result=await workerRequest('measure',{
            a:serialSelection(selected[0]),
            b:serialSelection(selected[1]),
            mode:'smart'
          });
          if(epoch!==selectionEpoch || selected.map(selectionKey).join('|')!==selectedKeysAtRequest)return;
        }

      }else{
        result=await workerRequest('measure',{
          a:serialSelection(selected[0]),
          b:serialSelection(selected[1]),
          mode
        });
        if(epoch!==selectionEpoch || selected.map(selectionKey).join('|')!==selectedKeysAtRequest)return;

        if(mode==='angle'&&!result?.ok){
          result=measureAngleFallback(selected[0],selected[1])||result;
        }
      }

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

function removeSelectionHighlight(key) {
  const group=selectionHighlightMap.get(key);
  if(!group)return;

  const sourceObject=group.userData?.sourceObject;
  if(sourceObject?.userData?.cadEdge) sourceObject.visible=edgesVisible;

  selectionHighlightMap.delete(key);
  selectionRoot.remove(group);
  clearGroup(group);
}

function rebuildSelectionHighlights() {
  const activeKeys=new Set(selected.map(selectionKey));

  for(const key of [...selectionHighlightMap.keys()]){
    if(!activeKeys.has(key))removeSelectionHighlight(key);
  }

  // Keep already-committed highlights untouched. Selecting entity #2 no
  // longer destroys/recreates entity #1, so its blue state is persistent.
  selected.forEach((selection,index)=>{
    const key=selectionKey(selection);
    if(selectionHighlightMap.has(key))return;

    const group=new THREE.Group();
    group.userData.selectionKey=key;
    group.userData.selectionKind=selection.kind;

    highlightSelection(selection,index,group);

    selectionHighlightMap.set(key,group);
    selectionRoot.add(group);
  });
}

function highlightSelection(s,index,parent=selectionRoot) {
  const color=SELECTION_BLUE;
  const faceColor=SELECTION_BLUE;

  if (s.kind==='edge') {
    if(s.object?.userData?.cadEdge){
      s.object.visible=false;
      parent.userData.sourceObject=s.object;
    }

    const line=new THREE.Line(
      s.object.geometry.clone(),
      new THREE.LineBasicMaterial({
        color,
        depthTest:true,
        depthWrite:false,
        depthFunc:THREE.LessEqualDepth
      })
    );
    line.matrix.copy(s.object.matrixWorld);
    line.matrixAutoUpdate=false;
    line.renderOrder=40;
    parent.add(line);

  } else if (s.kind==='vertex'||s.kind==='point') {
    const radius=Math.max(modelSize*0.0024,0.0001);
    const sphere=new THREE.Mesh(
      new THREE.SphereGeometry(radius,16,12),
      new THREE.MeshBasicMaterial({color,depthTest:true,depthWrite:false})
    );
    sphere.position.copy(s.point);
    sphere.renderOrder=31;
    parent.add(sphere);

  } else if (s.kind==='face') {
    const face=s.def.facesById.get(Number(s.elementId));
    if (!face) return;

    const source=s.def.geometry;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',source.getAttribute('position'));

    if (source.getAttribute('normal')){
      g.setAttribute('normal',source.getAttribute('normal'));
    }

    const srcIndex=source.index.array;
    const slice=srcIndex.slice(face.firstIndex,face.firstIndex+face.indexCount);
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(slice),1));

    const mesh=new THREE.Mesh(g,selectionFaceMaterial.clone());
    mesh.material.color.setHex(faceColor);
    mesh.material.side=THREE.DoubleSide;
    mesh.material.depthWrite=false;
    mesh.material.depthFunc=THREE.LessEqualDepth;
    mesh.material.needsUpdate=true;
    mesh.matrix.copy(s.object.matrixWorld);
    mesh.matrixAutoUpdate=false;
    mesh.renderOrder=29;
    parent.add(mesh);
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
  selectionEpoch++;

  for(const group of selectionHighlightMap.values()){
    const sourceObject=group.userData?.sourceObject;
    if(sourceObject?.userData?.cadEdge) sourceObject.visible=edgesVisible;
  }

  selected=[];
  currentMeasureResult=null;
  selectionHighlightMap.clear();
  clearGroup(selectionRoot);
  clearGroup(measureOverlayRoot);
  clearDimensionLabel();
  clearMeasureDetails();
  if (measureEnabled) setMeasurePrompt(T.selectFirst);
}

function clearMeasurement() {
  clearSelections();
}

function showSingleExact(d) {
  const details=[];
  clearGroup(measureOverlayRoot);
  clearDimensionLabel();

  E.measureMain.textContent=`${labelKind(d.kind)} #${d.elementId}`;
  const familyLabel=localizeGeometryFamily(d.family);
  details.push([T.family,familyLabel]);

  if (isFinite(d.length)) details.push([T.length,formatLength(d.length)]);
  if (isFinite(d.diameter)) details.push([T.diameter,formatLength(d.diameter)]);
  if (isFinite(d.radius)) details.push([T.radius,formatLength(d.radius)]);
  if (isFinite(d.area)) details.push([T.area,formatArea(d.area)]);

  if (d.center && d.center.length===3) {
    const c=new THREE.Vector3(...d.center);
    addExactCenterMarker(c);
    details.push([
      FR?'Centre':'Center',
      `${formatNumber(convertLength(d.center[0]))}, ${formatNumber(convertLength(d.center[1]))}, ${formatNumber(convertLength(d.center[2]))} ${unitLabel(displayUnit)}`
    ]);
  }

  if (d.hole?.diameter) {
    details.push([T.hole,`Ø ${formatLength(d.hole.diameter)}`]);
    if (isFinite(d.hole.depth)) details.push([T.depth,formatLength(d.hole.depth)]);
  }

  renderDetails(details);
}
function getMeasureAnnotationPoints(result) {
  const validPoint=p=>Array.isArray(p) && p.length===3 && p.every(Number.isFinite);

  if(validPoint(result?.pointA) && validPoint(result?.pointB)){
    return [result.pointA,result.pointB];
  }

  // Fallback to the actual click locations. This is especially useful for
  // angle and certain face/edge combinations where OCCT returns the exact
  // scalar result but no explicit witness points for drawing.
  const a=selected[0]?.point;
  const b=selected[1]?.point;

  if(a?.isVector3 && b?.isVector3){
    return [a.toArray(),b.toArray()];
  }

  return [null,null];
}

function showPairExact(r) {
  if (
    r?.kind==='angle' &&
    (!r?.ok || !Number.isFinite(r?.value)) &&
    selected.length===2
  ){
    r=measureAngleFallback(selected[0],selected[1])||r;
  }

  if (!r?.ok) return showMeasureError(r?.message||T.exactFail);

  currentMeasureResult=r;
  clearGroup(measureOverlayRoot);

  const [annotationA,annotationB]=getMeasureAnnotationPoints(r);

  if (r.kind==='angle') {
    const label=formatAngle(r.value);

    E.measureMain.textContent=label;
    renderDetails([[T.angle,label]]);

    // Always show the angular value in the viewport, even when OCCT did not
    // provide witness points for the exact angle calculation.
    drawMeasureLine(annotationA,annotationB,label);

  } else if (r.kind==='center-center') {
    const label=formatLength(r.value);

    E.measureMain.textContent=label;
    renderDetails([
      [T.center,label],
      [T.dx,formatLength(r.dx)],
      [T.dy,formatLength(r.dy)],
      [T.dz,formatLength(r.dz)]
    ]);

    drawMeasureLine(annotationA,annotationB,label);

  } else {
    const label=formatLength(r.value);

    E.measureMain.textContent=label;

    const a=annotationA;
    const b=annotationB;
    const dx=a&&b?Math.abs(b[0]-a[0]):null;
    const dy=a&&b?Math.abs(b[1]-a[1]):null;
    const dz=a&&b?Math.abs(b[2]-a[2]):null;

    const rows=[[T.distance,label]];
    if (dx!=null){
      rows.push(
        [T.dx,formatLength(dx)],
        [T.dy,formatLength(dy)],
        [T.dz,formatLength(dz)]
      );
    }

    renderDetails(rows);
    drawMeasureLine(a,b,label);
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
  drawMeasureLine(
    a.point.toArray(),
    b.point.toArray(),
    formatLength(distance,'u')
  );
}
function showMeasureError(message) {
  clearDimensionLabel();
  E.measureMain.textContent='—';
  renderDetails([]);
  E.selectionSummary.textContent=message;
}


function addExactCenterMarker(point) {
  const radius=Math.max(modelSize*0.003,0.0001);
  const ringGeometry=new THREE.RingGeometry(radius*0.55,radius,28);
  const ringMaterial=new THREE.MeshBasicMaterial({
    color:0x35d39a,
    side:THREE.DoubleSide,
    depthTest:false,
    transparent:true,
    opacity:0.95
  });

  const ring=new THREE.Mesh(ringGeometry,ringMaterial);
  ring.position.copy(point);
  ring.quaternion.copy(camera.quaternion);
  ring.renderOrder=45;
  ring.userData.exactCenter=true;
  measureOverlayRoot.add(ring);

  const crossSize=radius*1.35;
  const geometry=new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(point.x-crossSize,point.y,point.z),
    new THREE.Vector3(point.x+crossSize,point.y,point.z),
    new THREE.Vector3(point.x,point.y-crossSize,point.z),
    new THREE.Vector3(point.x,point.y+crossSize,point.z)
  ]);
  const cross=new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({color:0x35d39a,depthTest:false})
  );
  cross.renderOrder=46;
  measureOverlayRoot.add(cross);
}

function ensureDimensionLabel() {
  if (dimensionLabel) return dimensionLabel;

  const label=document.createElement('div');
  label.className='cad-dimension-label';
  label.hidden=true;
  E.workspace.appendChild(label);
  dimensionLabel=label;
  return label;
}

function clearDimensionLabel() {
  dimensionLabelPoint=null;
  if(dimensionLabel){
    dimensionLabel.hidden=true;
    dimensionLabel.textContent='';
  }
}

function setDimensionLabel(text,point) {
  if(!text||!point)return clearDimensionLabel();

  const label=ensureDimensionLabel();
  dimensionLabelPoint=point.clone();
  label.textContent=text;
  label.hidden=false;
  updateDimensionLabelPosition();
}

function updateDimensionLabelPosition() {
  if(!dimensionLabel||dimensionLabel.hidden||!dimensionLabelPoint||!camera)return;

  const projected=dimensionLabelPoint.clone().project(camera);

  // Hide if the annotation is behind the camera or outside the depth range.
  if(projected.z < -1 || projected.z > 1){
    dimensionLabel.style.visibility='hidden';
    return;
  }

  const rect=E.workspace.getBoundingClientRect();
  const x=(projected.x*0.5+0.5)*rect.width;
  const y=(-projected.y*0.5+0.5)*rect.height;

  dimensionLabel.style.visibility='visible';
  dimensionLabel.style.left=`${x}px`;
  dimensionLabel.style.top=`${y}px`;
}

function drawMeasureLine(a,b,labelText='') {
  if (!a||!b) {
    clearDimensionLabel();
    return;
  }

  const pa=new THREE.Vector3(...a),pb=new THREE.Vector3(...b);
  const line=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([pa,pb]),
    new THREE.LineBasicMaterial({color:0x35d39a,depthTest:false})
  );

  line.renderOrder=40;
  measureOverlayRoot.add(line);
  addMeasureMarker(pa);
  addMeasureMarker(pb);

  const midpoint=pa.clone().add(pb).multiplyScalar(0.5);
  setDimensionLabel(labelText,midpoint);
}

function drawMeasurePoints(a,b,labelText=''){drawMeasureLine(a,b,labelText)}
function addMeasureMarker(p) {
  const r=Math.max(modelSize*0.0018,0.0001);
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
function localizeGeometryFamily(value) {
  const raw=String(value||'other');
  if(!FR)return raw;

  const map={
    cylinder:'cylindre',
    cylindrical:'cylindre',
    plane:'plan',
    planar:'plan',
    circle:'cercle',
    circular:'cercle',
    line:'ligne',
    linear:'ligne',
    cone:'cône',
    conical:'cône',
    sphere:'sphère',
    spherical:'sphère',
    torus:'tore',
    toroidal:'tore',
    bspline:'B-spline',
    bezier:'Bézier',
    other:'autre'
  };

  return map[raw.toLowerCase()]||raw;
}

function labelKind(k){return k==='face'?T.face:k==='edge'?T.edge:k==='vertex'?T.vertex:T.point}
function labelSelection(s){return s.meshOnly?T.point:`${labelKind(s.kind)} #${s.elementId}`}

function applyEdgesVisibility() {
  blackEdgeMaterial.visible=edgesVisible;

  const selectedSourceEdges=new Set(
    [...selectionHighlightMap.values()]
      .map(group=>group.userData?.sourceObject)
      .filter(Boolean)
  );

  visualEdges.forEach(object=>{
    object.visible=edgesVisible && !selectedSourceEdges.has(object);
    if(object.material===blackEdgeMaterial) object.material.visible=edgesVisible;
  });
}

function toggleEdges() {
  edgesVisible=!edgesVisible;
  navo3dPreferences.edgesVisible=edgesVisible;
  E.edges.classList.toggle('active',edgesVisible);
  applyEdgesVisibility();
  saveNavo3DPrefs();
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

  selectionRoot?.traverse?.(object=>{
    if(!object.material)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    materials.forEach(material=>{
      material.clippingPlanes=clipEnabled?[clipPlane]:null;
      material.needsUpdate=true;
    });
  });
}

function fitCamera(view='iso') {
  if (!modelBounds) return;

  const sphere=modelBounds.getBoundingSphere(new THREE.Sphere());
  const center=sphere.center.clone();
  const radius=Math.max(sphere.radius,0.001);
  const fov=THREE.MathUtils.degToRad(camera.fov);
  const distance=radius/Math.sin(fov/2)*1.12;
  const dirs={iso:[1,.75,1],front:[0,0,1],right:[1,0,0],top:[0,1,0]};
  const dir=new THREE.Vector3(...(dirs[view]||dirs.iso)).normalize();

  camera.position.copy(center).addScaledVector(dir,distance);
  camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
  camera.lookAt(center);

  controls.target.copy(center);
  cadNav.pivot.copy(center);
  cadNav.wheelFocus.copy(center);

  updateZoomClipping();
  updateDimensionLabelPosition();
}

function fillProperties() {
  E.propFile.textContent=currentFile?.name||'—';
  E.propFormat.textContent=currentFormat||'—';
  E.propUnits.textContent=unitLabel(displayUnit);
  E.propParts.textContent=String(currentStats?.partCount??1);
  E.propGeometries.textContent=String(currentStats?.geometryCount??surfaceMeshes.length);
  E.propTriangles.textContent=formatInteger(currentStats?.triangleCount??0);

  if (currentStepResult) {
    E.stepMeta.hidden=false;
    E.sheetMetalSection.hidden=false;
    const h=currentStepHeader||{};
    E.stepName.textContent=h.name||currentFile.name||'—';
    E.stepSchema.textContent=h.schema||'—';
    E.stepDate.textContent=h.date||'—';
    E.stepAuthor.textContent=h.author||'—';
    E.stepOrg.textContent=h.organization||'—';
    E.stepOrigin.textContent=h.origin||'—';
    renderTree(currentStepResult.rootNodes||[]);
    renderStepCustomProperties();
  } else {
    E.stepMeta.hidden=true;
    E.sheetMetalSection.hidden=true;
  }

  updateSheetMetalCalculation({preserveInputs:true});
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


async function scanStepProperties(file) {
  // Stream the STEP text instead of loading a potentially huge file into
  // a second full in-memory string. Everything remains on the user's PC.
  const reader=file.stream().getReader();
  const decoder=new TextDecoder('utf-8');
  let carry='';

  const propertyDefinitions=new Map();
  const descriptiveItems=new Map();
  const representations=new Map();
  const links=[];

  const clean=s=>String(s||'').replace(/''/g,"'").trim();

  function processStatement(statement) {
    const s=statement.trim();
    if(!s.startsWith('#'))return;

    let m=s.match(/^#(\d+)\s*=\s*PROPERTY_DEFINITION\s*\(\s*'((?:''|[^'])*)'\s*,\s*(?:'((?:''|[^'])*)'|\$)\s*,\s*(#[0-9]+)/i);
    if(m){
      propertyDefinitions.set('#'+m[1],{name:clean(m[2]),description:clean(m[3]),target:m[4]});
      return;
    }

    m=s.match(/^#(\d+)\s*=\s*DESCRIPTIVE_REPRESENTATION_ITEM\s*\(\s*'((?:''|[^'])*)'\s*,\s*'((?:''|[^'])*)'\s*\)/i);
    if(m){
      descriptiveItems.set('#'+m[1],{name:clean(m[2]),value:clean(m[3])});
      return;
    }

    m=s.match(/^#(\d+)\s*=\s*REPRESENTATION\s*\(\s*'((?:''|[^'])*)'\s*,\s*\(([\s\S]*?)\)\s*,/i);
    if(m){
      const refs=[...m[3].matchAll(/#[0-9]+/g)].map(x=>x[0]);
      representations.set('#'+m[1],{name:clean(m[2]),items:refs});
      return;
    }

    m=s.match(/^#(\d+)\s*=\s*PROPERTY_DEFINITION_REPRESENTATION\s*\(\s*(#[0-9]+)\s*,\s*(#[0-9]+)\s*\)/i);
    if(m){
      links.push({property:m[2],representation:m[3]});
      return;
    }
  }

  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    carry+=decoder.decode(value,{stream:true});

    let cut;
    while((cut=carry.indexOf(';'))>=0){
      const statement=carry.slice(0,cut);
      carry=carry.slice(cut+1);

      // Fast reject to keep large STEP scans inexpensive.
      if(
        statement.includes('PROPERTY_DEFINITION') ||
        statement.includes('DESCRIPTIVE_REPRESENTATION_ITEM') ||
        statement.includes('REPRESENTATION')
      ){
        processStatement(statement);
      }
    }

    // Yield to the UI on large STEP files.
    await new Promise(resolve=>setTimeout(resolve,0));
  }

  carry+=decoder.decode();
  if(carry.trim())processStatement(carry);

  const result=[];
  const seen=new Set();

  for(const link of links){
    const pd=propertyDefinitions.get(link.property);
    const rep=representations.get(link.representation);
    if(!pd||!rep)continue;

    for(const itemRef of rep.items){
      const item=descriptiveItems.get(itemRef);
      if(!item)continue;

      const name=item.name||pd.name;
      const value=item.value;
      if(!name||!value)continue;

      const key=`${name}\u0000${value}`;
      if(seen.has(key))continue;
      seen.add(key);

      result.push({
        name,
        value,
        description:pd.description||'',
        target:pd.target||''
      });
    }
  }

  return result.slice(0,250);
}

function renderStepCustomProperties() {
  if(!E.stepCustomSection||!E.stepCustomProperties)return;

  E.stepCustomProperties.replaceChildren();

  if(!currentStepResult){
    E.stepCustomSection.hidden=true;
    return;
  }

  E.stepCustomSection.hidden=false;

  if(!currentStepProperties.length){
    E.stepCustomNote.textContent=T.metadataNone;
    return;
  }

  for(const property of currentStepProperties){
    const row=document.createElement('div');
    const dt=document.createElement('dt');
    const dd=document.createElement('dd');

    dt.textContent=property.name;
    if(property.description)dt.title=property.description;
    dd.textContent=property.value;

    row.append(dt,dd);
    E.stepCustomProperties.append(row);
  }

  E.stepCustomNote.textContent=`${currentStepProperties.length} ${T.metadataFound} · ${T.metadataScan}`;
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
  closeSelectOther();
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
  currentModel=null;currentFile=null;currentFormat='';currentUnit='u';displayUnit='u';currentStats=null;currentStepHeader=null;currentStepResult=null;currentStepProperties=[];
  resetSheetMetalForModel();
  modelBounds=null;modelSize=1;clipEnabled=false;edgesVisible=navo3dPreferences.edgesVisible;blackEdgeMaterial.visible=edgesVisible;measureEnabled=false;
  cadNav.active=false;cadNav.pointerId=null;cadNav.button=-1;cadNav.mode=null;
  cadNav.pivot.set(0,0,0);cadNav.wheelFocus.set(0,0,0);updateCadCursor();
  E.section.classList.remove('active');E.sectionPanel.hidden=true;E.edges.classList.toggle('active',edgesVisible);E.gridToggle.classList.toggle('active',navo3dPreferences.gridVisible);E.measure.classList.remove('active');
  E.measureCard.hidden=true;E.propsDrawer.hidden=true;E.workspace.classList.remove('properties-open');E.stepMeta.hidden=true;E.sheetMetalSection.hidden=true;E.empty.classList.remove('hidden');
  E.statusFile.textContent=showMessage?T.noModel:'—';E.statusFormat.textContent='—';E.statusUnits.textContent='—';E.unitSelect.value='u';
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
  [E.clear,E.fit,E.edges,E.gridToggle,E.unitSelect,E.measure,E.section,E.viewButton,E.props].forEach(el=>el.disabled=!on);
  document.querySelectorAll('[data-select-mode]').forEach(el=>el.disabled=!on);
  E.measureType.disabled=!on||!measureEnabled;
  E.sheetMetal.disabled=!on||!currentStepResult;
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


function unitLabel(unit=displayUnit) {
  if (unit==='in') return FR ? 'po' : 'in';
  if (unit==='u') return FR ? 'unité' : 'unit';
  return unit;
}

function unitScale(from,to) {
  if(from==='u'||to==='u'||from===to)return 1;
  const mm={mm:1,cm:10,m:1000,in:25.4};
  if(!(from in mm)||!(to in mm))return 1;
  return mm[from]/mm[to];
}

function convertLength(value,from=currentUnit,to=displayUnit) {
  return value*unitScale(from,to);
}

function updateDisplayedUnits() {
  const label=unitLabel(displayUnit);
  E.statusUnits.textContent=label;
  E.propUnits.textContent=label;
  if(currentStepResult)syncSheetMetalInputs();
}

async function refreshMeasurementUnits() {
  if(!measureEnabled)return;

  if(!currentStepResult){
    if(selected.length===2)showMeshPointDistance(selected[0],selected[1]);
    return;
  }

  try{
    if(selected.length===1){
      const details=await workerRequest('inspect',{selection:serialSelection(selected[0])});
      showSingleExact(details);
    }else if(selected.length===2&&currentMeasureResult){
      showPairExact(currentMeasureResult);
    }
  }catch(error){
    console.warn('[NavoFlo units refresh]',error);
  }
}

function formatLength(v,unit=displayUnit){
  const sourceUnit=unit==='u'?'u':currentUnit;
  const targetUnit=unit==='u'?'u':displayUnit;
  return `${formatNumber(convertLength(v,sourceUnit,targetUnit))} ${unitLabel(targetUnit)}`;
}
function formatArea(v,unit=displayUnit){
  const sourceUnit=unit==='u'?'u':currentUnit;
  const targetUnit=unit==='u'?'u':displayUnit;
  const f=unitScale(sourceUnit,targetUnit);
  return `${formatNumber(v*f*f)} ${unitLabel(targetUnit)}²`;
}
function formatAngle(v) {
  // OCCT geometric angles are expressed in radians.
  return `${formatNumber(THREE.MathUtils.radToDeg(v))}°`;
}
function formatPoint(p){
  const f=unitScale(currentUnit,displayUnit);
  return `${formatNumber(p.x*f)}, ${formatNumber(p.y*f)}, ${formatNumber(p.z*f)} ${unitLabel(displayUnit)}`;
}
function formatNumber(v) {
  if (!Number.isFinite(v)) return '—';
  const a=Math.abs(v),digits=a>=1000?2:a>=10?3:a>=1?4:5;
  return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{maximumFractionDigits:digits}).format(v);
}
function formatInteger(v){return new Intl.NumberFormat(FR?'fr-CA':'en-CA',{maximumFractionDigits:0}).format(v||0)}
