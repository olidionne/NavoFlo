import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadUserPreferences, createPreferenceSaver } from './user-preferences.js?v=8.14';
import { saveCadWorkspace, loadCadWorkspace, bindSuitePersistence } from './cad-session-store.js?v=8.15.4';
import { analyzeAndUnfold, flatPatternToDxf } from './sheetmetal-engine.js?v=8.20.4';
import { buildManufacturingKnowledge, applyManufacturingMlPrediction } from './manufacturing-recognition-engine.js?v=8.20.4';
import { requestManufacturingMlReview } from './manufacturing-ml-client.js?v=8.20.0';
import { matchAiscProfile } from './profile-standard-matcher.js?v=8.20.1';

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
  through:'traversant', depth:'Profondeur', hole:'Trou', reset:'Mesure effacée', fullscreen:'Plein écran', exitFullscreen:'Quitter le plein écran', metadataNone:'Aucune propriété personnalisée STEP détectée.', metadataFound:'propriété(s) STEP détectée(s)', metadataScan:'Lecture locale du fichier STEP.', multiMeasure:'Multi-cotation', multiAdded:'Cote conservée · poursuivez la sélection.'
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
  through:'through', depth:'Depth', hole:'Hole', reset:'Measurement cleared', fullscreen:'Fullscreen', exitFullscreen:'Exit fullscreen', metadataNone:'No custom STEP properties detected.', metadataFound:'STEP property/properties detected', metadataScan:'Local STEP file scan.', multiMeasure:'Multi-measure', multiAdded:'Dimension kept · continue selecting.'
};

const $ = id => document.getElementById(id);
const E = {
  workspace:$('cad-workspace'), canvas:$('viewer-canvas'), input:$('file-input'),
  empty:$('empty-drop'), loading:$('loading-overlay'), loadingLabel:$('loading-label'), loadingSub:$('loading-sub'),
  clear:$('clear-model'), save:$('save-model'), saveAs:$('save-model-as'), openButton:$('open-model-button'), fit:$('fit-view'), edges:$('edges-toggle'), gridToggle:$('grid-toggle'), unitSelect:$('unit-select'),
  measure:$('measure-toggle'), multiMeasure:$('multi-measure-toggle'), measureType:$('measure-type'), measureClear:$('measure-clear'),
  measureCard:$('measure-card'), measureMain:$('measure-main'), measureDetails:$('measure-details'),
  measureBadge:$('measure-badge'), selectionSummary:$('selection-summary'),
  section:$('section-toggle'), sectionPanel:$('section-panel'), clipAxis:$('clip-axis'),
  clipSlider:$('clip-slider'), clipInvert:$('clip-invert'),
  viewButton:$('view-menu-button'), viewMenu:$('view-menu'), perspectiveToggle:$('perspective-toggle'),
  props:$('properties-toggle'), propsDrawer:$('properties-drawer'), propsClose:$('properties-close'), fullscreen:$('fullscreen-toggle'),
  propFile:$('prop-file'), propFormat:$('prop-format'), propType:$('prop-type'), propUnits:$('prop-units'),
  propSheetDimensionsRow:$('prop-sheet-dimensions-row'), propSheetDimensionsLabel:$('prop-sheet-dimensions-label'), propSheetDimensions:$('prop-sheet-dimensions'),
  propParts:$('prop-parts'), propGeometries:$('prop-geometries'), propTriangles:$('prop-triangles'),
  profileStandardSection:$('profile-standard-section'), profileAiscLabel:$('profile-aisc-label'), profileMetricLabel:$('profile-metric-label'),
  profileFamily:$('profile-family'), profileDimensions:$('profile-dimensions'), profileThickness:$('profile-thickness'), profileArea:$('profile-area'),
  profileWeight:$('profile-weight'), profileLength:$('profile-length'), profileTotalWeight:$('profile-total-weight'), profileConfidence:$('profile-confidence'), profileSource:$('profile-source'),
  stepMeta:$('step-meta-section'), stepName:$('step-name'), stepSchema:$('step-schema'),
  stepDate:$('step-date'), stepAuthor:$('step-author'), stepOrg:$('step-org'),
  stepOrigin:$('step-origin'), stepTree:$('step-tree'), stepCustomSection:$('step-custom-section'), stepCustomProperties:$('step-custom-properties'), stepCustomNote:$('step-custom-note'),
  floatingActions:$('cad-floating-actions'), sheetMetal:$('sheetmetal-toggle'), dxfExportFloat:$('dxf-export-float'), sheetMetalSection:$('sheetmetal-section'),
  smMaterial:$('sm-material-class'), smThickness:$('sm-thickness'), smThicknessUnit:$('sm-thickness-unit'),
  smRadius:$('sm-radius'), smRadiusUnit:$('sm-radius-unit'), smAngle:$('sm-angle'),
  smUseMeasure:$('sm-use-measure'), smUseRadius:$('sm-use-radius'),
  smManualToggle:$('sm-manual-k-toggle'), smManualRow:$('sm-manual-k-row'), smManualK:$('sm-manual-k'),
  smRatio:$('sm-ratio'), smBand:$('sm-band'), smK:$('sm-k'), smNeutralRadius:$('sm-neutral-radius'),
  smBendAllowance:$('sm-bend-allowance'), smBendDeduction:$('sm-bend-deduction'), smStatus:$('sm-status'),
  smSetFixedFace:$('sm-set-fixed-face'), smFixedFace:$('sm-fixed-face'), smUnfold:$('sm-unfold'), smExportDxf:$('sm-export-dxf'),
  smSectionTitle:$('sm-section-title'), smEngineNote:$('sm-engine-note'), smAdvanced:$('sm-advanced'), smKRow:$('sm-k-row'), smBendsRow:$('sm-bends-row'),
  smDetectedThickness:$('sm-detected-thickness'), smDetectedBends:$('sm-detected-bends'), smFlatSize:$('sm-flat-size'),
  statusFile:$('status-file'), statusFormat:$('status-format'), statusUnits:$('status-units'),
  docTabs:$('n3-doc-tabs'), docTabList:$('n3-doc-tab-list'), docTabAdd:$('n3-doc-tab-add'),
  assemblyTreePanel:$('assembly-tree-panel'), assemblyTreeList:$('assembly-tree-list'), assemblyTreeStatus:$('assembly-tree-status'),
  assemblyTreeShowAll:$('assembly-tree-show-all'), assemblyTreeSpread:$('assembly-tree-spread'), assemblyTreeBatchDxf:$('assembly-tree-batch-dxf'),
  assemblyContextMenu:$('assembly-context-menu')
};

const MAX_FILE = 250*1024*1024;
const MAX_TOTAL = 500*1024*1024;
const WORKER_URL = '/js/step-worker.js?v=8.20.4';

const AIR_BENDING_K_TABLE = Object.freeze({
  soft:Object.freeze({toThickness:0.33,to3Thickness:0.40,over3Thickness:0.50}),
  medium:Object.freeze({toThickness:0.38,to3Thickness:0.43,over3Thickness:0.50}),
  hard:Object.freeze({toThickness:0.40,to3Thickness:0.45,over3Thickness:0.50})
});

const ASMT = FR ? {
  assembly:'Assemblage STEP', subassembly:'Sous-assemblage STEP', part:'Pièce STEP',
  openPart:'Ouvrir la pièce', openSubassembly:'Ouvrir le sous-assemblage',
  batchWorking:'Analyse DXF en lot…', batchDone:'Export DXF terminé', batchNone:'Aucun DXF admissible dans cette branche.',
  batchCancelled:'Export DXF annulé.', spreadConfirm:n=>`Ouvrir ${n} pièces dans des onglets Navo3D ?`,
  spreadLimit:n=>`La branche contient ${n} pièces. Navo3D ouvrira au maximum 60 onglets à la fois.`,
  dxfExported:n=>`${n} DXF exporté(s)`, dxfSkipped:n=>`${n} ignoré(s)`,
  directoryPrompt:'Choisissez le dossier de destination des DXF.'
} : {
  assembly:'STEP assembly', subassembly:'STEP sub-assembly', part:'STEP part',
  openPart:'Open part', openSubassembly:'Open sub-assembly',
  batchWorking:'Batch DXF analysis…', batchDone:'DXF batch export complete', batchNone:'No eligible DXF in this branch.',
  batchCancelled:'DXF batch export cancelled.', spreadConfirm:n=>`Open ${n} parts in Navo3D tabs?`,
  spreadLimit:n=>`This branch contains ${n} parts. Navo3D will open at most 60 tabs at a time.`,
  dxfExported:n=>`${n} DXF exported`, dxfSkipped:n=>`${n} skipped`,
  directoryPrompt:'Choose the DXF destination folder.'
};

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
  calculationReady:'Paramètres de pliage calculés.',
  measurementBusy:'Lecture de la géométrie exacte…',
  fixedFaceReady:'Face fixe sélectionnée.',
  fixedFaceNeed:'Sélectionnez une face plane STEP, puis cliquez « Face fixe ».',
  fixedFacePlanar:'La face fixe doit être plane.',
  unfoldBusy:'Analyse de la tôlerie et calcul du développé…',
  unfoldReady:'Déplié calculé localement. Validez les dimensions avant production.',
  unfoldFailed:'Impossible de déplier cette géométrie.',
  flatView:'Vue dépliée',
  foldedView:'Vue pliée',
  flatPlateReady:'Plaque plane détectée · DXF 1:1 prêt.',
  exportReady:'DXF généré.',
  noFlat:'Calculez d’abord le développé.',
  unsupportedTopology:'Cette pièce sort du MVP: épaisseur constante + faces planes + plis cylindriques standards requis.'
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
  calculationReady:'Bend parameters calculated.',
  measurementBusy:'Reading exact geometry…',
  fixedFaceReady:'Fixed face selected.',
  fixedFaceNeed:'Select a planar STEP face, then click “Fixed face”.',
  fixedFacePlanar:'The fixed face must be planar.',
  unfoldBusy:'Analyzing sheet metal and calculating flat pattern…',
  unfoldReady:'Flat pattern calculated locally. Validate dimensions before production.',
  unfoldFailed:'This geometry could not be unfolded.',
  flatView:'Flat view',
  foldedView:'Folded view',
  flatPlateReady:'Flat plate detected · 1:1 DXF ready.',
  exportReady:'DXF generated.',
  noFlat:'Calculate the flat pattern first.',
  unsupportedTopology:'This part is outside the MVP: constant thickness + planar faces + standard cylindrical bends are required.'
};

const sheetMetalState = {
  materialClass:'hard',
  thickness:null,
  radius:null,
  bendAngleDeg:90,
  manualKEnabled:false,
  manualK:0.40,
  fixedFace:null
};

let flatPatternRoot=null,flatPatternResult=null,flatPatternActive=false,flatPatternCameraState=null,sheetMetalUnfoldPromise=null;
let sheetMetalCapability={recognized:false,bendCount:0,flatPlate:false,cuttablePlate:false,rolledPlate:false,rolledPlateData:null,profile:false,profileType:null,profileData:null};
let manufacturingCapability=null;
let currentProfileMatch=null,profileMatchEpoch=0;
let renderer, scene, camera, controls, modelRoot, selectionRoot, preselectionRoot, measureOverlayRoot, multiMeasureRoot, grid;
let sectionCapRoot=null,sectionCapPlaneMesh=null;
let cameraProjectionMode='orthographic';
let currentModel = null, currentFile = null, currentFormat = '', currentUnit = 'u', displayUnit = 'u';
let currentStats = null, currentStepHeader = null, currentStepResult = null, currentStepProperties = [];
let surfaceMeshes = [], edgeObjects = [], vertexObjects = [], visualEdges = [];
let flatSurfaceMeshes = [], flatEdgeObjects = [], flatVertexObjects = [];
let selectionMode = 'auto', measureEnabled = false, multiMeasureEnabled=false, selected = [], currentMeasureResult = null, selectionHighlightMap = new Map();
let edgesVisible = true, clipEnabled = false;
let modelBounds = null, modelSize = 1;
let hoverRAF = 0, preselected = null, selectOtherMenu = null;
let selectionEpoch = 0;
let logicalFaceGroupCache = new Map();
let logicalEdgeGroupCache = new Map();
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
let dimensionLabel = null, dimensionLabelPoint = null, dimensionTether = null;
let dimensionLabelOffset={x:0,y:0},dimensionLabelDrag=null;
let multiMeasureRecords=[],multiMeasureSeq=0;
let worker = null, workerSeq = 0, workerPending = new Map();
let meshObjectUrls = [];
let baseMaterials = new Set();

// V8.15 — multi-document model tabs. Only the active 3D scene is resident in
// WebGL/OCCT at once to keep large STEP assemblies from multiplying RAM usage.
// File objects and per-document camera/unit state stay local in the browser.
const modelDocuments=new Map();
let activeModelDocumentId=null,modelDocumentSeq=0,modelDocumentBusy=false,pendingModelDocumentId=null;

// V8.20.4 — assembly hierarchy is a first-class viewport tool. The STEP file
// remains the single source object; part/sub-assembly tabs are lightweight
// virtual views that reload the same local STEP and restrict scene + analysis
// to one hierarchy branch instead of manufacturing fake temporary STEP files.
let currentAssemblyFocus=null,currentAssemblyMode=false,currentAssemblyHierarchyAvailable=false;
let currentHierarchyRootSpecs=[];
let currentActiveGeometryIds=new Set();
let assemblyTreeRecords=new Map(),assemblyOccurrenceRecords=[];
let assemblySelectedKey=null,assemblyContextKey=null,assemblyBatchBusy=false;
const assemblyExpandedKeys=new Set();

const MODEL_ANALYSIS_CACHE_VERSION=9;
let modelAnalysisReady=false;
const FSA3_OPEN_SUPPORTED=typeof window.showOpenFilePicker==='function';
const FSA3_SAVE_SUPPORTED=typeof window.showSaveFilePicker==='function';
const logicalHiddenEdgeKeys=new Set();
function nextModelDocumentId(){return`n3doc-${++modelDocumentSeq}`;}
function modelMainCandidates(files){return [...files].filter(file=>['step','stp','glb','gltf','stl','obj'].includes(ext(file.name)));}
function modelFileSignature(file){
  if(!file)return '';
  return `${String(file.name||'')}|${Number(file.size)||0}|${Number(file.lastModified)||0}`;
}
function cloneModelAnalysisValue(value){
  if(value==null)return value;
  try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));}
  catch{return null;}
}
function currentModelAnalysisSnapshot(){
  if(!currentStepResult||!currentFile||!modelAnalysisReady)return null;
  return {
    version:MODEL_ANALYSIS_CACHE_VERSION,
    sourceSignature:modelFileSignature(currentFile),
    sheetMetalCapability:cloneModelAnalysisValue(sheetMetalCapability),
    manufacturingCapability:cloneModelAnalysisValue(manufacturingCapability),
    currentProfileMatch:cloneModelAnalysisValue(currentProfileMatch),
    flatPatternResult:cloneModelAnalysisValue(flatPatternResult)
  };
}
function restoreModelDocumentAnalysis(snapshot,main){
  if(!currentStepResult||!snapshot||Number(snapshot.version)!==MODEL_ANALYSIS_CACHE_VERSION)return false;
  if(snapshot.sourceSignature!==modelFileSignature(main))return false;
  const restoredCapability=cloneModelAnalysisValue(snapshot.sheetMetalCapability);
  if(!restoredCapability)return false;
  sheetMetalCapability=restoredCapability;
  manufacturingCapability=cloneModelAnalysisValue(snapshot.manufacturingCapability);
  currentProfileMatch=cloneModelAnalysisValue(snapshot.currentProfileMatch);
  flatPatternResult=cloneModelAnalysisValue(snapshot.flatPatternResult);
  modelAnalysisReady=true;
  if(flatPatternResult?.ok){
    sheetMetalState.fixedFace={
      geometryId:String(flatPatternResult.geometryId),
      elementId:Number(flatPatternResult.fixedFaceId)
    };
    if((!Number.isFinite(sheetMetalState.thickness)||sheetMetalState.thickness<=0)&&Number.isFinite(flatPatternResult.thickness))sheetMetalState.thickness=flatPatternResult.thickness;
    const firstR=flatPatternResult.bendLines?.find(b=>Number.isFinite(b.insideRadius))?.insideRadius;
    if((!Number.isFinite(sheetMetalState.radius)||sheetMetalState.radius<0)&&Number.isFinite(firstR))sheetMetalState.radius=firstR;
    buildFlatPatternScene(flatPatternResult);
  }
  syncSheetMetalInputs();
  syncSheetMetalUnfoldUI();
  updateGeometryTypeIndicator();
  updateSheetMetalDimensionsUI();
  updateProfileStandardUI();
  updateManufacturingUI();
  return true;
}
function currentAssemblyTreeState(){
  if(!currentAssemblyHierarchyAvailable||!assemblyTreeRecords.size)return null;
  return {
    hiddenKeys:[...new Set(assemblyOccurrenceRecords.filter(occ=>occ.group.visible===false).map(occ=>occ.treeKey))],
    expandedKeys:[...assemblyExpandedKeys],
    selectedKey:assemblySelectedKey||null
  };
}
function restoreAssemblyTreeState(state){
  if(!state||!assemblyTreeRecords.size)return;
  if(Array.isArray(state.expandedKeys)){assemblyExpandedKeys.clear();for(const key of state.expandedKeys)if(assemblyTreeRecords.has(key))assemblyExpandedKeys.add(key);}
  const hidden=new Set(Array.isArray(state.hiddenKeys)?state.hiddenKeys:[]);for(const occ of assemblyOccurrenceRecords)occ.group.visible=!hidden.has(occ.treeKey);
  if(state.selectedKey&&assemblyTreeRecords.has(state.selectedKey))selectAssemblyTreeNode(state.selectedKey);
}
function captureActiveModelDocumentState(){
  if(!activeModelDocumentId)return;
  const doc=modelDocuments.get(activeModelDocumentId);if(!doc)return;
  if(camera&&controls&&currentModel){
    doc.view={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),target:controls.target.toArray(),displayUnit,projectionMode:cameraProjectionMode,zoom:camera.isOrthographicCamera?camera.zoom:1};
  }
  doc.lastFormat=currentFormat||doc.lastFormat||'';
  doc.assembly=currentAssemblyTreeState();
  doc.sheetMetal={thickness:sheetMetalState.thickness,radius:sheetMetalState.radius,bendAngleDeg:sheetMetalState.bendAngleDeg,manualKEnabled:sheetMetalState.manualKEnabled,manualK:sheetMetalState.manualK,fixedFace:sheetMetalState.fixedFace?{...sheetMetalState.fixedFace}:null};
  const analysis=currentModelAnalysisSnapshot();
  if(analysis)doc.analysis=analysis;
}
function renderModelDocumentTabs(){
  if(!E.docTabs||!E.docTabList)return;
  E.docTabs.classList.toggle('is-empty',modelDocuments.size===0);
  E.docTabList.replaceChildren();
  for(const [id,doc] of modelDocuments){
    const active=id===activeModelDocumentId;
    const tab=document.createElement('div');tab.className='cad-doc-tab'+(active?' active':'');tab.dataset.documentId=id;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',active?'true':'false');tab.title=doc.name;
    const name=document.createElement('span');name.className='cad-doc-tab-name';name.textContent=doc.name;tab.append(name);
    const close=document.createElement('button');close.type='button';close.className='cad-doc-tab-close';close.textContent='×';close.disabled=modelDocumentBusy&&active;close.title=FR?'Fermer le modèle':'Close model';close.addEventListener('click',event=>{event.stopPropagation();closeModelDocument(id);});tab.append(close);
    tab.addEventListener('click',()=>activateModelDocument(id));E.docTabList.append(tab);
  }
  requestAnimationFrame(()=>E.docTabList.querySelector('.cad-doc-tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'}));
}
function buildModelDocumentSets(files,handleByName=null){
  const all=[...files];const mains=modelMainCandidates(all);if(!mains.length)return[];
  const withHandle=main=>({main,mainHandle:handleByName?.get?.(main.name)||null});
  if(mains.length===1)return[{...withHandle(mains[0]),files:all}];
  const mainSet=new Set(mains),aux=all.filter(file=>!mainSet.has(file));
  return mains.map(main=>({...withHandle(main),files:[main,...aux]}));
}
async function openModelDocuments(files,handleByName=null){
  const sets=buildModelDocumentSets(files,handleByName);
  if(!sets.length)return showError(T.unsupported);
  const newIds=[];
  for(const set of sets){
    if(set.files.some(file=>file.size>MAX_FILE)){showError(T.tooLarge);continue;}
    if(set.files.reduce((sum,file)=>sum+file.size,0)>MAX_TOTAL){showError(T.totalTooLarge);continue;}
    const id=nextModelDocumentId();modelDocuments.set(id,{id,name:set.main.name,main:set.main,mainHandle:set.mainHandle||null,files:set.files,view:null,lastFormat:ext(set.main.name).toUpperCase(),analysis:null,focus:null,assembly:null});newIds.push(id);
  }
  renderModelDocumentTabs();
  if(newIds.length)await activateModelDocument(newIds[0]);
}
async function pickModelFiles(){
  if(!FSA3_OPEN_SUPPORTED){E.input.click();return;}
  try{
    const handles=await window.showOpenFilePicker({multiple:true,types:[{description:'CAD',accept:{'application/octet-stream':['.step','.stp','.stl','.obj','.glb','.gltf','.bin'],'image/*':['.png','.jpg','.jpeg','.webp']}}]});
    const files=[],map=new Map();for(const handle of handles){const file=await handle.getFile();files.push(file);map.set(file.name,handle);}
    if(files.length)await openModelDocuments(files,map);
  }catch(error){if(error?.name!=='AbortError'){console.warn('Navo3D file picker',error);E.input.click();}}
}
async function saveCurrentModel(forceSaveAs=false){
  const doc=activeModelDocumentId?modelDocuments.get(activeModelDocumentId):null;if(!doc?.main)return;
  if(doc.focus){showError(FR?'Cet onglet est une vue virtuelle de l’assemblage. Le STEP source reste l’assemblage complet; utilisez Exporter DXF pour la pièce.':'This tab is a virtual assembly view. The source STEP remains the full assembly; use Export DXF for the part.');return;}
  try{
    let handle=!forceSaveAs?doc.mainHandle:null;
    if(!handle&&FSA3_SAVE_SUPPORTED){const extension='.'+ext(doc.main.name);handle=await window.showSaveFilePicker({suggestedName:doc.main.name,types:[{description:`${extension.toUpperCase()} CAD`,accept:{'application/octet-stream':[extension]}}]});}
    if(handle){const oldMain=doc.main;const writable=await handle.createWritable();await writable.write(await oldMain.arrayBuffer());await writable.close();const saved=await handle.getFile();doc.main=saved;doc.mainHandle=handle;doc.name=saved.name;doc.files=[saved,...doc.files.filter(f=>f!==oldMain&&f.name!==saved.name)];currentFile=saved;if(doc.analysis)doc.analysis.sourceSignature=modelFileSignature(saved);E.statusFile.textContent=saved.name;renderModelDocumentTabs();}
    else{const url=URL.createObjectURL(doc.main);const a=document.createElement('a');a.href=url;a.download=doc.main.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }catch(error){if(error?.name!=='AbortError'){console.error('Navo3D save',error);showError(FR?'Impossible de sauvegarder ce modèle.':'Unable to save this model.');}}
}

function modelSessionSnapshot(){
  captureActiveModelDocumentState();
  return {
    version:1,
    activeModelDocumentId,
    modelDocumentSeq,
    documents:[...modelDocuments.values()].map(doc=>({
      id:doc.id,name:doc.name,main:doc.main,mainHandle:doc.mainHandle||null,files:doc.files,
      view:doc.view||null,lastFormat:doc.lastFormat||'',sheetMetal:doc.sheetMetal||null,analysis:doc.analysis||null,focus:doc.focus||null,assembly:doc.assembly||null
    }))
  };
}
async function persistModelSession(){
  if(!modelDocuments.size)return saveCadWorkspace('navo3d',{version:1,activeModelDocumentId:null,modelDocumentSeq,documents:[]});
  let snapshot=modelSessionSnapshot();
  if(await saveCadWorkspace('navo3d',snapshot))return true;
  // Some browsers may refuse to clone FileSystemFileHandle. Preserve the files/tabs anyway.
  snapshot={...snapshot,documents:snapshot.documents.map(doc=>({...doc,mainHandle:null}))};
  return saveCadWorkspace('navo3d',snapshot);
}
async function restoreModelSession(){
  const saved=await loadCadWorkspace('navo3d');
  if(!saved?.documents?.length)return false;
  modelDocuments.clear();
  for(const raw of saved.documents){
    if(!raw?.id||!raw?.main||!Array.isArray(raw.files))continue;
    modelDocuments.set(raw.id,{...raw});
  }
  if(!modelDocuments.size)return false;
  modelDocumentSeq=Math.max(Number(saved.modelDocumentSeq)||0,...[...modelDocuments.keys()].map(id=>Number(String(id).split('-').pop())||0));
  renderModelDocumentTabs();
  const target=modelDocuments.has(saved.activeModelDocumentId)?saved.activeModelDocumentId:modelDocuments.keys().next().value;
  await activateModelDocument(target);
  return true;
}

function restoreModelDocumentView(doc){
  const view=doc?.view;if(!view||!camera||!controls)return false;
  // V8.15.3 session snapshots pre-date projectionMode/orthographic zoom.
  // Treat those legacy views as incomplete instead of restoring them at zoom=1,
  // which could make a recovered model appear tiny or unexpectedly cropped.
  if(!view.projectionMode)return false;
  if(view.projectionMode==='orthographic'&&!Number.isFinite(view.zoom))return false;
  if(!Array.isArray(view.position)||!Array.isArray(view.quaternion)||!Array.isArray(view.target))return false;
  try{
    setProjectionMode(view.projectionMode,{preserveScale:false,persist:false});
    camera.position.fromArray(view.position);camera.quaternion.fromArray(view.quaternion);if(Array.isArray(view.up))camera.up.fromArray(view.up);controls.target.fromArray(view.target);
    if(camera.isOrthographicCamera)camera.zoom=Math.max(1e-12,view.zoom);
    camera.updateProjectionMatrix();
    if(['u','mm','cm','m','in'].includes(view.displayUnit)){displayUnit=view.displayUnit;E.unitSelect.value=displayUnit;updateDisplayedUnits();}
    cadNav.pivot.copy(controls.target);cadNav.wheelFocus.copy(controls.target);updateZoomClipping();updateDimensionLabelPosition();syncProjectionUI();return true;
  }catch{return false;}
}
async function activateModelDocument(id){
  if(!id||!modelDocuments.has(id))return;
  if(modelDocumentBusy){pendingModelDocumentId=id;return;}
  if(id===activeModelDocumentId&&currentModel)return;
  captureActiveModelDocumentState();activeModelDocumentId=id;renderModelDocumentTabs();
  const doc=modelDocuments.get(id);modelDocumentBusy=true;renderModelDocumentTabs();
  try{await loadFileSet(doc.files,{restoreView:doc.view,restoreSheetMetal:doc.sheetMetal,restoreAnalysis:doc.analysis,restoreFocus:doc.focus||null,restoreAssembly:doc.assembly||null});}
  finally{
    modelDocumentBusy=false;renderModelDocumentTabs();
    const pending=pendingModelDocumentId;pendingModelDocumentId=null;
    if(pending&&pending!==activeModelDocumentId&&modelDocuments.has(pending))await activateModelDocument(pending);
  }
}
function cycleModelDocument(direction=1){
  const ids=[...modelDocuments.keys()];if(ids.length<2)return;const index=Math.max(0,ids.indexOf(activeModelDocumentId));activateModelDocument(ids[(index+direction+ids.length)%ids.length]);
}
async function closeModelDocument(id=activeModelDocumentId){
  if(!id||!modelDocuments.has(id)||modelDocumentBusy)return;
  if(id!==activeModelDocumentId){modelDocuments.delete(id);renderModelDocumentTabs();return;}
  captureActiveModelDocumentState();
  const ids=[...modelDocuments.keys()],index=ids.indexOf(id),next=ids[index+1]||ids[index-1]||null;
  modelDocuments.delete(id);activeModelDocumentId=null;await clearModel(true);renderModelDocumentTabs();
  if(next&&modelDocuments.has(next))await activateModelDocument(next);
}


// ---------------------------------------------------------------------------
// V8.20.4 — functional assembly hierarchy
// ---------------------------------------------------------------------------
function assemblyNodeAtKey(roots,key){
  if(!Array.isArray(roots)||key==null)return null;
  const path=String(key).split('/').map(Number);
  let nodes=roots,node=null;
  for(const index of path){
    if(!Number.isInteger(index)||index<0||index>=nodes.length)return null;
    node=nodes[index];nodes=Array.isArray(node?.children)?node.children:[];
  }
  return node;
}
function assemblyNodeIsAssembly(node){return Boolean(node?.isAssembly||(Array.isArray(node?.children)&&node.children.length));}
function assemblyRecordIsAssembly(record){return Boolean(record?.isAssembly||record?.childrenKeys?.length);}
function assemblyCurrentScopeKey(){return currentHierarchyRootSpecs.length===1?currentHierarchyRootSpecs[0].key:null;}
function assemblyDescendantRecord(record,key){return Boolean(record&&(key==null||record.key===key||record.key.startsWith(String(key)+'/')));}
function assemblyRecordsForKey(key=null){return [...assemblyTreeRecords.values()].filter(record=>assemblyDescendantRecord(record,key));}
function assemblyOccurrencesForKey(key=null){return assemblyOccurrenceRecords.filter(occ=>key==null||occ.treeKey===key||occ.treeKey.startsWith(String(key)+'/'));}
function assemblyLeafRecordsForKey(key=null){
  return assemblyRecordsForKey(key).filter(record=>record.occurrences.length&&!record.childrenKeys.length);
}
function assemblyRecordVisibility(record){
  const occs=assemblyOccurrencesForKey(record?.key);if(!occs.length)return 'visible';
  const shown=occs.filter(occ=>occ.group.visible!==false).length;
  return shown===0?'hidden':shown===occs.length?'visible':'mixed';
}
function sanitizeAssemblyFilename(value,fallback='part'){
  const clean=String(value||fallback).replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\s+/g,' ').trim();
  return (clean||fallback).slice(0,120);
}
function setAssemblyTreeStatus(text='',tone='info'){
  if(!E.assemblyTreeStatus)return;
  E.assemblyTreeStatus.hidden=!text;E.assemblyTreeStatus.textContent=text||'';E.assemblyTreeStatus.dataset.tone=tone;
}
function setAssemblyBatchBusy(busy){
  assemblyBatchBusy=Boolean(busy);
  [E.assemblyTreeBatchDxf,E.assemblyTreeSpread].filter(Boolean).forEach(button=>button.disabled=assemblyBatchBusy);
}
function closeAssemblyContextMenu(){if(E.assemblyContextMenu)E.assemblyContextMenu.hidden=true;assemblyContextKey=null;}
function openAssemblyContextMenu(event,key){
  const record=assemblyTreeRecords.get(key);if(!record||!E.assemblyContextMenu)return;
  event.preventDefault();event.stopPropagation();selectAssemblyTreeNode(key);assemblyContextKey=key;
  const menu=E.assemblyContextMenu,isAssembly=assemblyRecordIsAssembly(record);
  const open=menu.querySelector('[data-assembly-action="open"]'),spread=menu.querySelector('[data-assembly-action="spread"]');
  if(open)open.textContent=isAssembly?ASMT.openSubassembly:ASMT.openPart;
  if(spread)spread.hidden=!isAssembly;
  menu.hidden=false;menu.style.left=`${event.clientX}px`;menu.style.top=`${event.clientY}px`;
  requestAnimationFrame(()=>{
    const r=menu.getBoundingClientRect(),pad=8;
    menu.style.left=`${Math.max(pad,Math.min(event.clientX,innerWidth-r.width-pad))}px`;
    menu.style.top=`${Math.max(pad,Math.min(event.clientY,innerHeight-r.height-pad))}px`;
  });
}
function clearAssemblyTreeSelection({rerender=true}={}){
  for(const occ of assemblyOccurrenceRecords){
    for(const mesh of occ.surfaceMeshes||[]){
      const original=mesh.userData?.assemblyTreeOriginalMaterial;if(!original)continue;
      const current=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      current.forEach(material=>{if(material&&material!==original&&!Array.isArray(original))material.dispose?.();});
      if(Array.isArray(original)){
        current.forEach((material,index)=>{if(material&&material!==original[index])material.dispose?.();});
      }
      mesh.material=original;delete mesh.userData.assemblyTreeOriginalMaterial;
    }
  }
  assemblySelectedKey=null;if(rerender)renderAssemblyTree();
}
function assemblyHighlightClone(material){
  if(!material?.clone)return material;
  const clone=material.clone();clone.color?.set?.(0x2d8cff);clone.emissive?.set?.(0x0a355a);if('emissiveIntensity'in clone)clone.emissiveIntensity=.95;clone.needsUpdate=true;return clone;
}
function selectAssemblyTreeNode(key,{fit=false}={}){
  const record=assemblyTreeRecords.get(key);if(!record)return;
  clearAssemblyTreeSelection({rerender:false});assemblySelectedKey=key;
  for(const occ of assemblyOccurrencesForKey(key))for(const mesh of occ.surfaceMeshes||[]){
    mesh.userData.assemblyTreeOriginalMaterial=mesh.material;
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(assemblyHighlightClone):assemblyHighlightClone(mesh.material);
  }
  renderAssemblyTree();if(fit)fitAssemblyTreeNode(key);
}
function setAssemblyNodeVisibility(key,visible){
  for(const occ of assemblyOccurrencesForKey(key))occ.group.visible=Boolean(visible);
  renderAssemblyTree();
}
function isolateAssemblyTreeNode(key){
  const prefix=String(key)+'/';
  for(const occ of assemblyOccurrenceRecords)occ.group.visible=occ.treeKey===key||occ.treeKey.startsWith(prefix);
  renderAssemblyTree();
}
function showAssemblyTreeOthers(key){
  const prefix=String(key)+'/';
  for(const occ of assemblyOccurrenceRecords)if(!(occ.treeKey===key||occ.treeKey.startsWith(prefix)))occ.group.visible=true;
  renderAssemblyTree();
}
function showAllAssemblyTreeNodes(){for(const occ of assemblyOccurrenceRecords)occ.group.visible=true;renderAssemblyTree();}
function fitAssemblyTreeNode(key){
  const objects=assemblyOccurrencesForKey(key).filter(occ=>occ.group.visible!==false).map(occ=>occ.group);if(!objects.length)return;
  const box=new THREE.Box3();for(const object of objects)box.expandByObject(object);if(box.isEmpty())return;
  const previous=modelBounds;modelBounds=box;fitCurrentView();modelBounds=previous;updateZoomClipping();
}
function toggleAssemblyExpanded(key){if(assemblyExpandedKeys.has(key))assemblyExpandedKeys.delete(key);else assemblyExpandedKeys.add(key);renderAssemblyTree();}

function renderAssemblyTree(){
  if(!E.assemblyTreePanel||!E.assemblyTreeList)return;
  const show=Boolean(currentStepResult&&currentAssemblyHierarchyAvailable&&currentAssemblyMode&&assemblyTreeRecords.size);
  E.assemblyTreePanel.hidden=!show;if(!show){E.assemblyTreeList.replaceChildren();closeAssemblyContextMenu();return;}
  E.assemblyTreeList.replaceChildren();
  const appendRecord=(record)=>{
    if(!record)return;
    const row=document.createElement('div');row.className=`assembly-tree-row ${assemblyRecordIsAssembly(record)?'assembly':'part'}`;row.dataset.treeKey=record.key;row.setAttribute('role','treeitem');row.style.paddingLeft=`${Math.min(record.depth,14)*13}px`;row.title=record.name;
    const visibility=assemblyRecordVisibility(record);row.classList.toggle('is-hidden',visibility==='hidden');row.classList.toggle('selected',assemblySelectedKey===record.key);
    const hasChildren=record.childrenKeys.length>0,expanded=assemblyExpandedKeys.has(record.key);if(hasChildren)row.setAttribute('aria-expanded',expanded?'true':'false');
    const caret=document.createElement('button');caret.type='button';caret.className='tree-caret'+(hasChildren?'':' placeholder');caret.textContent=hasChildren?(expanded?'▾':'▸'):'·';caret.tabIndex=-1;if(hasChildren)caret.addEventListener('click',event=>{event.stopPropagation();toggleAssemblyExpanded(record.key);});
    const eye=document.createElement('button');eye.type='button';eye.className='tree-eye';eye.textContent=visibility==='hidden'?'○':visibility==='mixed'?'◐':'●';eye.title=visibility==='hidden'?(FR?'Montrer':'Show'):(FR?'Cacher':'Hide');eye.tabIndex=-1;eye.addEventListener('click',event=>{event.stopPropagation();setAssemblyNodeVisibility(record.key,visibility==='hidden');});
    const icon=document.createElement('span');icon.className='tree-icon';icon.textContent=assemblyRecordIsAssembly(record)?'▦':'◇';
    const name=document.createElement('span');name.className='tree-name';name.textContent=record.name||'(unnamed)';
    row.append(caret,eye,icon,name);
    row.addEventListener('click',event=>{if(event.target.closest('button'))return;selectAssemblyTreeNode(record.key);});
    row.addEventListener('dblclick',event=>{event.preventDefault();selectAssemblyTreeNode(record.key,{fit:true});});
    row.addEventListener('contextmenu',event=>openAssemblyContextMenu(event,record.key));
    E.assemblyTreeList.append(row);
    if(hasChildren&&expanded)for(const childKey of record.childrenKeys)appendRecord(assemblyTreeRecords.get(childKey));
  };
  for(const spec of currentHierarchyRootSpecs)appendRecord(assemblyTreeRecords.get(spec.key));
}

function assemblyGeometryFingerprint(record){return [...new Set(assemblyOccurrencesForKey(record.key).map(occ=>occ.geometryId))].sort().join('|');}
async function openAssemblyNodeInTab(key){
  const record=assemblyTreeRecords.get(key),sourceDoc=activeModelDocumentId?modelDocuments.get(activeModelDocumentId):null;if(!record||!sourceDoc?.main)return;
  const signature=modelFileSignature(sourceDoc.main);
  const existing=[...modelDocuments.values()].find(doc=>doc.focus?.key===key&&modelFileSignature(doc.main)===signature);
  if(existing){await activateModelDocument(existing.id);return;}
  const id=nextModelDocumentId(),name=record.name||sourceDoc.name;
  modelDocuments.set(id,{id,name,main:sourceDoc.main,mainHandle:sourceDoc.mainHandle||null,files:sourceDoc.files,view:null,lastFormat:sourceDoc.lastFormat||'STEP',analysis:null,sheetMetal:null,focus:{key,name,isAssembly:assemblyRecordIsAssembly(record)},assembly:null});
  renderModelDocumentTabs();await activateModelDocument(id);
}
async function spreadAssemblyNodeToTabs(key=null){
  if(assemblyBatchBusy)return;
  const sourceDoc=activeModelDocumentId?modelDocuments.get(activeModelDocumentId):null;if(!sourceDoc?.main)return;
  const candidates=assemblyLeafRecordsForKey(key),unique=[],seen=new Set();
  for(const record of candidates){const fingerprint=assemblyGeometryFingerprint(record)||record.key;if(seen.has(fingerprint))continue;seen.add(fingerprint);unique.push(record);}
  if(!unique.length)return;
  if(unique.length>60)alert(ASMT.spreadLimit(unique.length));
  const selected=unique.slice(0,60);if(selected.length>10&&!confirm(ASMT.spreadConfirm(selected.length)))return;
  const signature=modelFileSignature(sourceDoc.main),newIds=[];
  for(const record of selected){
    const existing=[...modelDocuments.values()].find(doc=>doc.focus?.key===record.key&&modelFileSignature(doc.main)===signature);if(existing)continue;
    const id=nextModelDocumentId(),name=record.name||sourceDoc.name;
    modelDocuments.set(id,{id,name,main:sourceDoc.main,mainHandle:sourceDoc.mainHandle||null,files:sourceDoc.files,view:null,lastFormat:sourceDoc.lastFormat||'STEP',analysis:null,sheetMetal:null,focus:{key:record.key,name,isAssembly:false},assembly:null});newIds.push(id);
  }
  renderModelDocumentTabs();if(newIds.length)await activateModelDocument(newIds[0]);
}

function assemblyBatchTargets(key=null){
  const targets=new Map();
  for(const occ of assemblyOccurrencesForKey(key)){
    if(targets.has(occ.geometryId))continue;
    const record=assemblyTreeRecords.get(occ.treeKey),geometry=currentStepResult?.geometries?.[occ.meshIndex]||occ.geometry;
    if(!geometry)continue;
    targets.set(occ.geometryId,{geometry,geometryId:occ.geometryId,name:record?.name||geometry.name||`part-${occ.meshIndex+1}`,treeKey:occ.treeKey});
  }
  return [...targets.values()];
}
async function analyzeAssemblyGeometryForDxf(target){
  const geometry=target?.geometry;if(!geometry)return{ok:false,reason:'geometry'};
  const analyzeWith=info=>analyzeAndUnfold({geometry,faceInfo:info?.faces||[],edgeInfo:info?.edges||[],logicalGroups:info?.logicalGroups||[],fixedFaceId:null,thickness:null,fallbackInsideRadius:null,kResolver:resolveUnfoldK});
  let exact,result;
  try{exact=await workerRequest('sheetmetal-face-info',{geometryId:String(geometry.id)});result=analyzeWith(exact);}catch(error){return{ok:false,reason:error?.message||'sheet-info'};}
  if(!(result?.ok&&(Number(result.bendCount)||0)>0)){
    try{exact=await workerRequest('manufacturing-face-info',{geometryId:String(geometry.id)});result=analyzeWith(exact);}catch(error){if(!result?.ok)return{ok:false,reason:error?.message||'manufacturing-info'};}
  }
  if(!result?.ok)return{ok:false,reason:result?.code||'not-flat'};
  if(result.flatPlate&&exact){
    try{
      const manufacturing=buildManufacturingKnowledge({geometry,faceInfo:exact.faces||[],edgeInfo:exact.edges||[],sheetResult:result});
      if(manufacturing?.capabilities?.export2dDxf===false&&manufacturingLooksLikeRoundShaft(manufacturing))return{ok:false,reason:'round-stock'};
    }catch{}
  }
  return{ok:true,result};
}
function batchDxfFilename(target,result,used){
  const base=sanitizeAssemblyFilename(target.name,`part-${target.geometryId}`),suffix=(Number(result?.bendCount)||0)>0?'_FLAT':'',stem=`${base}${suffix}`;
  let index=(used.get(stem)||0)+1;used.set(stem,index);return`${stem}${index>1?`_${index}`:''}.dxf`;
}
async function writeAssemblyBatchDxf(handle,name,text){
  if(handle){const fileHandle=await handle.getFileHandle(name,{create:true}),writable=await fileHandle.createWritable();await writable.write(text);await writable.close();return;}
  const blob=new Blob([text],{type:'application/dxf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);
}
async function batchExportAssemblyDxfs(key=null){
  if(assemblyBatchBusy||!currentStepResult)return;
  const stepRef=currentStepResult,docRef=activeModelDocumentId;
  const targets=assemblyBatchTargets(key);if(!targets.length){setAssemblyTreeStatus(ASMT.batchNone,'warn');return;}
  let directory=null;
  if(typeof window.showDirectoryPicker==='function'){
    try{directory=await window.showDirectoryPicker({mode:'readwrite'});}catch(error){if(error?.name==='AbortError'){setAssemblyTreeStatus(ASMT.batchCancelled,'warn');return;}console.warn('[NavoFlo batch DXF directory]',error);}
  }
  setAssemblyBatchBusy(true);setAssemblyTreeStatus(`${ASMT.batchWorking} 0/${targets.length}`);
  const used=new Map();let exported=0,skipped=0;
  try{
    for(let index=0;index<targets.length;index++){
      if(currentStepResult!==stepRef||activeModelDocumentId!==docRef)return;
      const target=targets[index];setAssemblyTreeStatus(`${ASMT.batchWorking} ${index+1}/${targets.length} · ${target.name}`);
      const analyzed=await analyzeAssemblyGeometryForDxf(target);
      if(currentStepResult!==stepRef||activeModelDocumentId!==docRef)return;
      if(!analyzed.ok){skipped++;continue;}
      const result=analyzed.result,name=batchDxfFilename(target,result,used),partName=sanitizeAssemblyFilename(target.name),text=flatPatternToDxf(result,{partName,units:'in'});
      await writeAssemblyBatchDxf(directory,name,text);exported++;
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    }
    if(currentStepResult===stepRef&&activeModelDocumentId===docRef)setAssemblyTreeStatus(exported?`${ASMT.batchDone} · ${ASMT.dxfExported(exported)}${skipped?` · ${ASMT.dxfSkipped(skipped)}`:''}`:ASMT.batchNone,exported?'ok':'warn');
  }catch(error){console.error('[NavoFlo batch DXF]',error);setAssemblyTreeStatus(`${FR?'Erreur DXF':'DXF error'} · ${error?.message||error}`,'warn');}
  finally{setAssemblyBatchBusy(false);}
}


const NAVO3D_DISPLAY_UNITS=new Set(['u','mm','cm','m','in']);
const navo3dPreferences={gridVisible:true,edgesVisible:true,selectionMode:'auto',propertiesOpen:false,materialClass:'hard',perspective:false,displayUnit:'mm'};
function navo3dPreferenceSnapshot(){return {...navo3dPreferences,edgesVisible:Boolean(edgesVisible),selectionMode,propertiesOpen:Boolean(navo3dPreferences.propertiesOpen),materialClass:sheetMetalState.materialClass,perspective:cameraProjectionMode==='perspective',displayUnit:NAVO3D_DISPLAY_UNITS.has(navo3dPreferences.displayUnit)?navo3dPreferences.displayUnit:'mm'};}
const saveNavo3DPrefs=createPreferenceSaver('navo3d',navo3dPreferenceSnapshot,500);
function applyNavo3DPreferences(p={}){
  if(typeof p.gridVisible==='boolean')navo3dPreferences.gridVisible=p.gridVisible;
  if(typeof p.edgesVisible==='boolean')navo3dPreferences.edgesVisible=p.edgesVisible;
  if(['auto','face','edge','vertex'].includes(p.selectionMode))navo3dPreferences.selectionMode=p.selectionMode;
  if(typeof p.propertiesOpen==='boolean')navo3dPreferences.propertiesOpen=p.propertiesOpen;
  if(AIR_BENDING_K_TABLE[p.materialClass])navo3dPreferences.materialClass=p.materialClass;
  if(typeof p.perspective==='boolean')navo3dPreferences.perspective=p.perspective;
  if(NAVO3D_DISPLAY_UNITS.has(p.displayUnit))navo3dPreferences.displayUnit=p.displayUnit;
  cameraProjectionMode=navo3dPreferences.perspective?'perspective':'orthographic';edgesVisible=navo3dPreferences.edgesVisible;selectionMode=navo3dPreferences.selectionMode;sheetMetalState.materialClass=navo3dPreferences.materialClass;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function activePickSurfaces(){return flatPatternActive?flatSurfaceMeshes:surfaceMeshes;}
function activePickEdges(){return flatPatternActive?flatEdgeObjects:edgeObjects;}
function activePickVertices(){return flatPatternActive?flatVertexObjects:vertexObjects;}
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
  // Draw only where the selected surface is actually the visible surface.
  // This prevents an inner cylindrical face from bleeding through an outer wall
  // when the camera zooms far away and depth precision becomes coarse.
  depthFunc:THREE.EqualDepth,
  polygonOffset:false
});

function workspaceAspect(){
  const rect=E.workspace?.getBoundingClientRect?.();
  return Math.max(.1,(rect?.width||1)/Math.max(rect?.height||1,1));
}
function configureOrthographicFrustum(cam=camera){
  if(!cam?.isOrthographicCamera)return;
  const aspect=workspaceAspect();cam.left=-aspect;cam.right=aspect;cam.top=1;cam.bottom=-1;cam.updateProjectionMatrix();
}
function createCadCamera(mode='orthographic'){
  if(mode==='perspective')return new THREE.PerspectiveCamera(38,workspaceAspect(),0.01,100000);
  const aspect=workspaceAspect(),cam=new THREE.OrthographicCamera(-aspect,aspect,1,-1,0.01,100000);cam.zoom=1;cam.updateProjectionMatrix();return cam;
}
function syncProjectionUI(){
  const perspective=cameraProjectionMode==='perspective';
  E.perspectiveToggle?.classList.toggle('active',perspective);E.perspectiveToggle?.setAttribute('aria-pressed',perspective?'true':'false');
}
function currentViewWorldHeight(target=controls?.target||getModelRotationCenter()){
  if(!camera)return 1;
  if(camera.isOrthographicCamera)return Math.max(1e-12,(camera.top-camera.bottom)/Math.max(camera.zoom,1e-12));
  const distance=Math.max(camera.position.distanceTo(target),1e-9);return 2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5);
}
function setProjectionMode(mode,{preserveScale=true,persist=true}={}){
  const next=mode==='perspective'?'perspective':'orthographic';
  if(camera&&((next==='perspective'&&camera.isPerspectiveCamera)||(next==='orthographic'&&camera.isOrthographicCamera))){cameraProjectionMode=next;syncProjectionUI();return;}
  const old=camera,target=controls?.target?.clone?.()||getModelRotationCenter(),worldHeight=old&&preserveScale?currentViewWorldHeight(target):null;
  const fresh=createCadCamera(next);
  if(old){fresh.position.copy(old.position);fresh.quaternion.copy(old.quaternion);fresh.up.copy(old.up);}
  if(next==='orthographic'){
    configureOrthographicFrustum(fresh);
    if(worldHeight&&Number.isFinite(worldHeight))fresh.zoom=Math.max(1e-12,(fresh.top-fresh.bottom)/worldHeight);
  }else if(worldHeight&&Number.isFinite(worldHeight)){
    const distance=worldHeight/(2*Math.tan(THREE.MathUtils.degToRad(fresh.fov)*.5));
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(fresh.quaternion).normalize();fresh.position.copy(target).addScaledVector(forward,-distance);
  }
  camera=fresh;cameraProjectionMode=next;if(controls)controls.object=camera;syncProjectionUI();updateZoomClipping();updateDimensionLabelPosition();
  navo3dPreferences.perspective=next==='perspective';if(persist)saveNavo3DPrefs();
}

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
  camera = createCadCamera(cameraProjectionMode);
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
  multiMeasureRoot = new THREE.Group(); scene.add(multiMeasureRoot);

  createGrid(10);
  bindUI();
  bindSuitePersistence(persistModelSession);
  resize();
  renderModelDocumentTabs();
  await restoreModelSession();
  renderer.setAnimationLoop(render);
}

function bindUI() {
  addEventListener('resize', resize);

  E.input.addEventListener('change', event => {
    const files = [...(event.target.files || [])];
    if (files.length) openModelDocuments(files);
    event.target.value = '';
  });
  [E.openButton,...document.querySelectorAll('[data-n3-open-picker],label[for="file-input"]')].filter(Boolean).forEach(el=>el.addEventListener('click',event=>{if(!FSA3_OPEN_SUPPORTED)return;event.preventDefault();pickModelFiles();}));

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
    if (files.length) openModelDocuments(files);
  });

  E.clear.addEventListener('click', () => closeModelDocument());
  E.save?.addEventListener('click',()=>saveCurrentModel(false));
  E.saveAs?.addEventListener('click',()=>saveCurrentModel(true));
  E.docTabAdd?.addEventListener('click',pickModelFiles);
  E.assemblyTreeShowAll?.addEventListener('click',showAllAssemblyTreeNodes);
  E.assemblyTreeSpread?.addEventListener('click',()=>spreadAssemblyNodeToTabs(assemblyCurrentScopeKey()));
  E.assemblyTreeBatchDxf?.addEventListener('click',()=>batchExportAssemblyDxfs(assemblyCurrentScopeKey()));
  E.assemblyContextMenu?.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-assembly-action]');if(!button||!assemblyContextKey)return;
    const key=assemblyContextKey,action=button.dataset.assemblyAction;closeAssemblyContextMenu();
    if(action==='open')await openAssemblyNodeInTab(key);
    else if(action==='spread')await spreadAssemblyNodeToTabs(key);
    else if(action==='batch-dxf')await batchExportAssemblyDxfs(key);
    else if(action==='hide')setAssemblyNodeVisibility(key,false);
    else if(action==='show')setAssemblyNodeVisibility(key,true);
    else if(action==='isolate')isolateAssemblyTreeNode(key);
    else if(action==='show-others')showAssemblyTreeOthers(key);
    else if(action==='show-all')showAllAssemblyTreeNodes();
  });
  addEventListener('pointerdown',event=>{if(E.assemblyContextMenu&&!E.assemblyContextMenu.hidden&&!E.assemblyContextMenu.contains(event.target))closeAssemblyContextMenu();},true);
  E.fit.addEventListener('click', () => flatPatternActive?fitFlatPatternView():fitCurrentView());
  E.edges.addEventListener('click', toggleEdges);
  E.gridToggle.addEventListener('click', toggleGrid);
  E.unitSelect.addEventListener('change', async () => {
    displayUnit=E.unitSelect.value;
    if(NAVO3D_DISPLAY_UNITS.has(displayUnit)){
      navo3dPreferences.displayUnit=displayUnit;
      saveNavo3DPrefs();
    }
    updateDisplayedUnits();
    await refreshMeasurementUnits();
  });
  E.measure.addEventListener('click', toggleMeasure);
  E.multiMeasure?.addEventListener('click', toggleMultiMeasure);
  E.measureClear.addEventListener('click', clearMeasurement);
  E.measureType.addEventListener('change', () => {
    clearSelections();
    if (measureEnabled) setMeasurePrompt(T.selectFirst);
  });

  document.querySelectorAll('[data-select-mode]').forEach(button => {
    button.addEventListener('click', () => setSelectionMode(button.dataset.selectMode));
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
  E.perspectiveToggle?.addEventListener('click',()=>{
    setProjectionMode(cameraProjectionMode==='perspective'?'orthographic':'perspective');
    E.viewMenu.hidden=true;
  });
  syncProjectionUI();

  E.props.addEventListener('click', () => {
    E.propsDrawer.hidden = !E.propsDrawer.hidden;
    syncPropertiesState();
  });
  E.propsClose.addEventListener('click', () => {
    E.propsDrawer.hidden = true;
    syncPropertiesState();
  });

  E.sheetMetal.addEventListener('click', async () => {
    if(flatPatternActive){setFlatPatternView(false);return;}
    if(flatPatternResult){setFlatPatternView(true);return;}
    await runSheetMetalUnfold({activate:true});
  });
  E.smMaterial.addEventListener('change', () => {
    clearFlatPattern();
    sheetMetalState.materialClass=E.smMaterial.value;
    navo3dPreferences.materialClass=sheetMetalState.materialClass;
    saveNavo3DPrefs();
    updateSheetMetalCalculation();
  });
  E.smThickness.addEventListener('input', () => {
    clearFlatPattern();
    sheetMetalState.thickness=readSheetMetalLengthInput(E.smThickness);
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smRadius.addEventListener('input', () => {
    clearFlatPattern();
    sheetMetalState.radius=readSheetMetalLengthInput(E.smRadius);
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smAngle.addEventListener('input', () => {
    const value=Number(E.smAngle.value);
    sheetMetalState.bendAngleDeg=Number.isFinite(value)?value:null;
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smManualToggle.addEventListener('change', () => {
    clearFlatPattern();
    sheetMetalState.manualKEnabled=E.smManualToggle.checked;
    E.smManualRow.hidden=!sheetMetalState.manualKEnabled;
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smManualK.addEventListener('input', () => {
    clearFlatPattern();
    const value=Number(E.smManualK.value);
    sheetMetalState.manualK=Number.isFinite(value)?value:null;
    updateSheetMetalCalculation({preserveInputs:true});
  });
  E.smUseMeasure.addEventListener('click', captureSheetMetalThickness);
  E.smUseRadius.addEventListener('click', captureSheetMetalRadius);
  E.smSetFixedFace?.addEventListener('click',captureSheetMetalFixedFace);
  E.smUnfold?.addEventListener('click',()=>runSheetMetalUnfold({activate:true,force:true}));
  E.smExportDxf?.addEventListener('click',exportFlatPatternDxf);
  E.dxfExportFloat?.addEventListener('click',exportFlatPatternDxf);

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

    if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='s' && activeModelDocumentId) {
      event.preventDefault();saveCurrentModel(event.shiftKey);return;
    }
    if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='o') {
      event.preventDefault();pickModelFiles();return;
    }
    if ((event.ctrlKey||event.metaKey) && event.key==='Tab' && modelDocuments.size>1) {
      event.preventDefault();cycleModelDocument(event.shiftKey?-1:1);return;
    }
    if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='w' && activeModelDocumentId) {
      event.preventDefault();closeModelDocument();return;
    }

    if (event.key === 'Escape') {
      closeSelectOther();
      closeAssemblyContextMenu();
      clearSelections();
      clearAssemblyTreeSelection();
      clearPreselection();
      return;
    }
    if(event.shiftKey&&/^F[1-4]$/.test(event.key)){
      event.preventDefault();
      setSelectionMode({F1:'auto',F2:'vertex',F3:'edge',F4:'face'}[event.key]);
      return;
    }

    if (!currentModel) return;

    const key=event.key.toLowerCase();

    if (key==='f') {
      event.preventDefault();
      fitCurrentView();
    } else if (key==='z') {
      event.preventDefault();cadKeyboardZoom(event.shiftKey);
    } else if (['arrowleft','arrowright','arrowup','arrowdown'].includes(key)) {
      event.preventDefault();cadKeyboardRotate(key,event.shiftKey?90:10);
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





function setSelectionMode(mode,{persist=true}={}){
  if(!['auto','face','edge','vertex'].includes(mode))return;
  selectionMode=mode;
  document.querySelectorAll('[data-select-mode]').forEach(b=>b.classList.toggle('active',b.dataset.selectMode===selectionMode));
  clearSelections();clearGroup(measureOverlayRoot);clearDimensionLabel();clearPreselection();updatePickingVisibility();
  navo3dPreferences.selectionMode=selectionMode;if(persist)saveNavo3DPrefs();
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
  sheetMetalState.fixedFace=null;
  sheetMetalCapability={recognized:false,bendCount:0,flatPlate:false,cuttablePlate:false,rolledPlate:false,rolledPlateData:null,profile:false,profileType:null,profileData:null};
  manufacturingCapability=null;
  currentProfileMatch=null;profileMatchEpoch++;
  modelAnalysisReady=false;

  if(E.smAngle)E.smAngle.value='90';
  if(E.smManualToggle)E.smManualToggle.checked=false;
  if(E.smManualRow)E.smManualRow.hidden=true;
  if(E.smManualK)E.smManualK.value=String(sheetMetalState.manualK);
  syncSheetMetalInputs();
  syncSheetMetalUnfoldUI();
  updateGeometryTypeIndicator();
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
  syncSheetMetalUnfoldUI();
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

  clearFlatPattern();
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

    clearFlatPattern();
    sheetMetalState.radius=radius;
    syncSheetMetalInputs();
    setSheetMetalStatus(SMT.capturedRadius,'ok');
  }catch(error){
    console.warn('[NavoFlo sheet metal radius]',error);
    setSheetMetalStatus(SMT.exactRadiusUnavailable,'warn');
  }
}


function syncSheetMetalUnfoldUI(){
  const recognized=Boolean(currentStepResult&&sheetMetalCapability.recognized);
  const hasBends=recognized&&sheetMetalCapability.bendCount>0;
  const flatPlate=recognized&&sheetMetalCapability.flatPlate;
  const busyUnfold=Boolean(sheetMetalUnfoldPromise);

  if(E.sheetMetalSection)E.sheetMetalSection.hidden=!recognized;
  if(E.sheetMetal){
    E.sheetMetal.hidden=!hasBends;
    E.sheetMetal.disabled=!hasBends||busyUnfold;
    E.sheetMetal.classList.toggle('active',Boolean(flatPatternActive));
    const label=E.sheetMetal.querySelector('span:last-child');
    if(label)label.textContent=flatPatternActive?(FR?'Replier':'Fold'):(FR?'Déplier':'Unfold');
    E.sheetMetal.title=flatPatternActive?(FR?'Revenir à la pièce pliée':'Return to folded part'):(FR?'Déplier automatiquement la tôle':'Automatically unfold sheet metal');
  }

  // V8.17.3 — DXF is a first-class quick action. As soon as the automatic
  // preflight proves that a STEP can generate a safe flat DXF, expose the
  // action directly in the viewport. Flat plates therefore get a DXF button
  // even though they correctly have no "Unfold" button.
  if(E.dxfExportFloat){
    E.dxfExportFloat.hidden=!recognized;
    E.dxfExportFloat.disabled=!recognized||busyUnfold;
    E.dxfExportFloat.title=flatPlate
      ? (FR?'Exporter le contour 1:1 en DXF':'Export the 1:1 contour as DXF')
      : (FR?'Déplier automatiquement si nécessaire puis exporter le DXF':'Automatically unfold if needed, then export DXF');
  }

  if(E.smSectionTitle)E.smSectionTitle.textContent=flatPlate?(FR?'DXF':'DXF'):(FR?'TÔLERIE':'SHEET METAL');
  if(E.smEngineNote)E.smEngineNote.textContent=flatPlate
    ? (FR?'Plaque plane détectée automatiquement. Le DXF reprend directement le contour exact de la pièce.':'Flat plate detected automatically. DXF uses the exact part contour directly.')
    : (FR?'Face fixe, épaisseur, rayon de pliage et facteur K détectés automatiquement. Utilisez les paramètres avancés seulement pour forcer une valeur.':'Fixed face, thickness, bend radius and K-factor are detected automatically. Use advanced settings only to override a value.');
  if(E.smAdvanced)E.smAdvanced.hidden=flatPlate;
  if(E.smKRow)E.smKRow.hidden=flatPlate;
  if(E.smBendsRow)E.smBendsRow.hidden=flatPlate;

  if(E.smFixedFace)E.smFixedFace.textContent=sheetMetalState.fixedFace?`Face #${sheetMetalState.fixedFace.elementId}`:(FR?'AUTO':'AUTO');
  if(E.smDetectedThickness){
    const value=flatPatternResult?.thickness;
    E.smDetectedThickness.textContent=Number.isFinite(value)?formatLength(value):'—';
  }
  if(E.smDetectedBends)E.smDetectedBends.textContent=flatPatternResult?.ok?String(flatPatternResult.bendCount):'—';
  if(E.smK){
    E.smK.textContent='—';
    if(flatPatternResult?.ok&&flatPatternResult.bendCount>0){
      const ks=[...new Set((flatPatternResult.bendLines||[]).map(b=>Number(b.k)).filter(Number.isFinite).map(k=>Number(k.toFixed(3))))];
      if(ks.length)E.smK.textContent=`${ks.map(k=>formatSheetMetalScalar(k,3)).join(' / ')} · ${sheetMetalState.manualKEnabled?'MANUAL':'AUTO'}`;
    }
  }
  if(E.smFlatSize){
    const b=flatPatternResult?.bounds;
    E.smFlatSize.textContent=b?`${formatLength(b.width)} × ${formatLength(b.height)}`:'—';
  }
  if(flatPlate&&flatPatternResult?.ok&&E.smStatus&&!E.smStatus.classList.contains('warn'))setSheetMetalStatus(SMT.flatPlateReady,'ok');
  if(E.smExportDxf)E.smExportDxf.disabled=!recognized||busyUnfold;
  if(E.smUnfold)E.smUnfold.disabled=!currentStepResult||busyUnfold;
  updateSheetMetalDimensionsUI();
  positionFloatingCadActions();
}

async function captureSheetMetalFixedFace({silent=false}={}){
  if(!currentStepResult){if(!silent)setSheetMetalStatus(SMT.needStep,'warn');return false;}
  const candidate=selected.length===1&&selected[0]?.kind==='face'?selected[0]:null;
  if(!candidate){if(!silent)setSheetMetalStatus(SMT.fixedFaceNeed,'warn');return false;}
  try{
    const details=await workerRequest('inspect',{selection:serialSelection(candidate)});
    if(!['plane','planar'].includes(String(details?.family||'').toLowerCase())){if(!silent)setSheetMetalStatus(SMT.fixedFacePlanar,'warn');return false;}
    sheetMetalState.fixedFace={geometryId:String(candidate.geometryId),elementId:Number(candidate.elementId)};
    clearFlatPattern();
    syncSheetMetalUnfoldUI();
    if(!silent)setSheetMetalStatus(`${SMT.fixedFaceReady} · Face #${candidate.elementId}`,'ok');
    captureActiveModelDocumentState();
    return true;
  }catch(error){console.warn('[NavoFlo fixed sheet face]',error);if(!silent)setSheetMetalStatus(SMT.fixedFacePlanar,'warn');return false;}
}

function resolveUnfoldK(innerRadius,thickness){
  if(sheetMetalState.manualKEnabled){
    const k=Number(sheetMetalState.manualK);return Number.isFinite(k)?k:NaN;
  }
  return getAirBendingRule(sheetMetalState.materialClass,innerRadius,thickness)?.k ?? NaN;
}

function describeUnfoldFailure(result){
  const code=String(result?.code||'');
  const messages=FR?{
    'no-bends':'Aucun pli cylindrique standard relié au panneau fixe n’a été détecté.',
    'bend-resolution-failed':'Un pli touche le panneau fixe, mais ses paramètres n’ont pas pu être résolus de façon fiable. Vérifiez T, le rayon intérieur et le facteur K.',
    'thickness-unresolved':'L’épaisseur de tôle n’a pas pu être détectée. Entrez T puis réessayez.',
    'fixed-face-map':'Impossible d’établir le repère de la face fixe.',
    'flat-empty':'Le développé n’a pas pu être reconstruit.',
    'fixed-face-not-planar':'La face fixe doit être plane.',
    'structural-profile':'Profilé / extrusion à section constante détecté. Le dépliage de tôle est désactivé automatiquement.'
  }:{
    'no-bends':'No standard cylindrical bend connected to the fixed panel was detected.',
    'bend-resolution-failed':'A bend touches the fixed panel, but its parameters could not be resolved safely. Check T, inside radius and K-factor.',
    'thickness-unresolved':'Sheet thickness could not be detected. Enter T and try again.',
    'fixed-face-map':'Unable to establish the fixed-face coordinate system.',
    'flat-empty':'The flat pattern could not be reconstructed.',
    'fixed-face-not-planar':'The fixed face must be planar.',
    'structural-profile':'A constant-section profile / extrusion was detected. Sheet-metal unfolding is automatically disabled.'
  };
  return messages[code]||result?.message||SMT.unsupportedTopology;
}

function manufacturingLooksLikeRoundShaft(c){
  if(c?.diagnostics?.suppressFlatDxf)return true;
  const aspect=Number(c?.aspect),confidence=Number(c?.confidence);
  const turningEvidence=Boolean(c?.processes?.turning)||Number(c?.features?.coaxialOtherRadii)>0||(c?.evidence||[]).includes('turning');
  return c?.stockType==='round-bar'&&Boolean(c?.machined)&&turningEvidence&&Number.isFinite(aspect)&&aspect>=0.45&&confidence>=0.72;
}
function manufacturingHasPlateSecondaryMachining(c){
  if(!c)return false;
  if(c?.capabilities?.directFlatDxf&&c?.processes?.machining)return true;
  const f=c.features||{},e=new Set(c.evidence||[]);
  return Boolean(
    Number(f.cones)>0||Number(f.grooves)>0||Number(f.tori)>0||
    Number(f.blindAxialCylinders)>0||Number(f.interiorParallelPlanes)>0||
    e.has('groove')||e.has('blind-hole')||e.has('counterbore')||e.has('recess')||e.has('pocket')
  );
}
function emptySheetMetalCapability(){return{recognized:false,bendCount:0,flatPlate:false,cuttablePlate:false,rolledPlate:false,rolledPlateData:null,profile:false,profileType:null,profileData:null};}
async function scheduleManufacturingMlReview(localKnowledge,sheetResult,docId=activeModelDocumentId,file=currentFile,stepRef=currentStepResult){
  if(!localKnowledge?.diagnostics?.needsMlReview||!file||!stepRef)return;
  const prediction=await requestManufacturingMlReview(file,localKnowledge).catch(()=>null);if(!prediction?.ok)return;
  const enhanced=applyManufacturingMlPrediction(localKnowledge,{sheetResult,mlPrediction:prediction});if(!enhanced)return;
  const doc=docId?modelDocuments.get(docId):null;
  if(doc?.analysis&&doc.analysis.sourceSignature===modelFileSignature(file))doc.analysis.manufacturingCapability=cloneModelAnalysisValue(enhanced);
  if(activeModelDocumentId!==docId||currentStepResult!==stepRef||currentFile!==file)return;
  manufacturingCapability=enhanced;modelAnalysisReady=true;
  updateGeometryTypeIndicator();updateManufacturingUI();captureActiveModelDocumentState();
  console.info('[NavoFlo MFR ML second opinion]',{engine:prediction.engine,features:prediction.features?.length||prediction.featureInstances?.length||0});
}

async function runSheetMetalUnfold({activate=true,quiet=false,force=false}={}){
  if(!currentStepResult){if(!quiet)setSheetMetalStatus(SMT.needStep,'warn');return null;}
  if(flatPatternResult&&!force){if(activate)setFlatPatternView(true);return flatPatternResult;}

  // If a background/preflight analysis is already running, reuse it instead of
  // launching the same OCCT requests twice. A click on DÉPLIÉE simply activates
  // the result as soon as it is ready.
  if(sheetMetalUnfoldPromise&&!force){
    const pending=await sheetMetalUnfoldPromise.catch(()=>null);
    if(activate&&pending?.ok)setFlatPatternView(true);
    return pending;
  }

  const stepRef=currentStepResult;
  const work=(async()=>{
    if(!quiet)setSheetMetalStatus(SMT.unfoldBusy);
    syncSheetMetalUnfoldUI();
    try{
      const allGeometries=Array.isArray(stepRef.geometries)?stepRef.geometries:[];
      const scopedGeometries=currentActiveGeometryIds.size?allGeometries.filter(g=>currentActiveGeometryIds.has(String(g.id))):allGeometries;
      const fixed=sheetMetalState.fixedFace?{...sheetMetalState.fixedFace}:null;
      const geometries=fixed?scopedGeometries.filter(g=>String(g.id)===String(fixed.geometryId)):scopedGeometries;
      if(!geometries.length){if(!quiet)setSheetMetalStatus(SMT.unfoldFailed+' · géométrie introuvable','warn');return null;}

      let best=null,bestScore=-Infinity,bestFailure=null,bestProfile=null,bestRolled=null,bestManufacturing=null;
      const manufacturingByGeometry=new Map();
      for(const geometry of geometries){
        if(currentStepResult!==stepRef)return null;
        let exact,result;
        const analyzeWith=info=>analyzeAndUnfold({
          geometry,
          faceInfo:info?.faces||[],
          edgeInfo:info?.edges||[],
          logicalGroups:info?.logicalGroups||[],
          fixedFaceId:fixed&&String(fixed.geometryId)===String(geometry.id)?fixed.elementId:null,
          thickness:sheetMetalState.thickness,
          fallbackInsideRadius:sheetMetalState.radius,
          kResolver:resolveUnfoldK
        });
        try{
          // V8.20.3 — sheet metal keeps a lightweight first pass. A perforated
          // bent part can contain hundreds of cylindrical hole faces and thousands
          // of edges; none of those hole descriptors are needed to prove its bends.
          exact=await workerRequest('sheetmetal-face-info',{geometryId:String(geometry.id)});
          const fastResult=analyzeWith(exact);
          result=fastResult;
          if(!(fastResult?.ok&&(Number(fastResult.bendCount)||0)>0)){
            try{
              const fullExact=await workerRequest('manufacturing-face-info',{geometryId:String(geometry.id)});
              exact=fullExact;result=analyzeWith(fullExact);
            }catch(error){
              if(!fastResult?.ok)throw error;
              console.warn('[NavoFlo manufacturing enrichment fallback]',error);
            }
          }
        }catch(error){bestFailure=bestFailure||{message:error?.message||String(error)};continue;}
        let manufacturing=null;
        if(!(result?.ok&&(Number(result.bendCount)||0)>0)){
          try{
            manufacturing=buildManufacturingKnowledge({
              geometry,
              faceInfo:exact?.faces||[],
              edgeInfo:exact?.edges||[],
              sheetResult:result?.ok||result?.code==='rolled-plate'?result:null,
              structuralProfile:result?.code==='structural-profile'?(result.profile||null):null
            });
          }catch(error){console.warn('[NavoFlo Manufacturing Recognition Engine]',error);}
        }

        // V8.19 — capabilities are independent from stock/process labels.  A
        // turned shaft can mathematically satisfy a naive two-plane slab proof,
        // but MRE explicitly suppresses flat DXF when round-stock + turning is
        // strongly proven.  Short machined disks remain DXF-capable.
        if(result?.ok&&result.flatPlate&&manufacturing&&manufacturing?.capabilities?.export2dDxf===false&&manufacturingLooksLikeRoundShaft(manufacturing)){
          const tagged={...manufacturing,geometryId:String(geometry.id)};
          manufacturingByGeometry.set(String(geometry.id),tagged);
          if(!bestManufacturing||(Number(tagged.confidence)||0)>(Number(bestManufacturing.confidence)||0))bestManufacturing=tagged;
          bestFailure=bestFailure||{code:'machined-round-stock',message:'Machined round stock / shaft detected; flat DXF is intentionally suppressed.'};
          continue;
        }
        if(!result?.ok){
          if(result?.code==='rolled-plate'&&result?.rolledPlateData){
            const confidence=Number(result.rolledPlateData.confidence)||0;
            if(!bestRolled||confidence>(Number(bestRolled?.rolledPlateData?.confidence)||0))bestRolled={...result,geometryId:String(geometry.id),manufacturing};
            continue;
          }
          if(result?.code==='structural-profile'){
            // Structural profile remains authoritative for the visible type, but
            // the MRE knowledge object is still retained with the document so later
            // feature/capability layers do not have to re-analyse this geometry.
            const confidence=Number(result?.profile?.confidence)||0;
            if(!bestProfile||confidence>(Number(bestProfile?.profile?.confidence)||0))bestProfile={...result,geometryId:String(geometry.id),manufacturing};
            continue;
          }
          if(manufacturing){
            const tagged={...manufacturing,geometryId:String(geometry.id)};
            manufacturingByGeometry.set(String(geometry.id),tagged);
            if(!bestManufacturing||(Number(tagged.confidence)||0)>(Number(bestManufacturing.confidence)||0))bestManufacturing=tagged;
          }
          // Prefer a meaningful bend/thickness failure over a generic no-bends
          // result when an assembly contains several unrelated solids.
          if(!bestFailure||bestFailure.code==='no-bends')bestFailure=result;
          continue;
        }
        if(manufacturing){
          const tagged={...manufacturing,geometryId:String(geometry.id)};
          manufacturingByGeometry.set(String(geometry.id),tagged);
          if(!bestManufacturing||(Number(tagged.confidence)||0)>(Number(bestManufacturing.confidence)||0))bestManufacturing=tagged;
        }
        const area=Math.max(Number(result.bounds?.width)||0,0)*Math.max(Number(result.bounds?.height)||0,0);
        const score=(Number(result.bendCount)||0)*1e12+(Number(result.panelCount)||0)*1e9+area;
        if(score>bestScore){best={result,geometry};bestScore=score;}
      }

      if(currentStepResult!==stepRef)return null;
      if(!best){
        flatPatternResult=null;clearFlatPattern();
        if(bestRolled){
          clearProfileStandardMatch();
          manufacturingCapability=bestRolled.manufacturing||null;
          sheetMetalCapability={recognized:false,bendCount:0,flatPlate:false,cuttablePlate:false,rolledPlate:true,rolledPlateData:bestRolled.rolledPlateData||null,profile:false,profileType:null,profileData:null};
          modelAnalysisReady=true;
          syncSheetMetalUnfoldUI();updateGeometryTypeIndicator();updateSheetMetalDimensionsUI();updateProfileStandardUI();updateManufacturingUI();captureActiveModelDocumentState();
          if(!quiet)console.info('[NavoFlo rolled plate detection]',bestRolled);
          return null;
        }
        if(bestProfile){
          manufacturingCapability=bestProfile.manufacturing||null;
          sheetMetalCapability={recognized:false,bendCount:0,flatPlate:false,cuttablePlate:false,rolledPlate:false,rolledPlateData:null,profile:true,profileType:bestProfile.profileType||'constant-section-profile',profileData:bestProfile.profile||null};
          modelAnalysisReady=true;
          syncSheetMetalUnfoldUI();updateGeometryTypeIndicator();updateProfileStandardUI();updateManufacturingUI();captureActiveModelDocumentState();
          void resolveProfileStandardMatch(sheetMetalCapability.profileData);
          if(!quiet)console.info('[NavoFlo profile detection]',bestProfile);
          return null;
        }
        clearProfileStandardMatch();
        sheetMetalCapability=emptySheetMetalCapability();
        manufacturingCapability=bestManufacturing;
        modelAnalysisReady=true;
        syncSheetMetalUnfoldUI();updateGeometryTypeIndicator();updateManufacturingUI();captureActiveModelDocumentState();
        void scheduleManufacturingMlReview(manufacturingCapability,null);
        if(!quiet){
          console.warn('[NavoUnfold diagnostics]',bestFailure);
          const reason=describeUnfoldFailure(bestFailure||{});
          const failCode=bestFailure?.diagnostics?.failures?.find(f=>f?.failure?.code)?.failure?.code;
          const detail=failCode?` · [${failCode}]`:'';
          setSheetMetalStatus(`${SMT.unfoldFailed} · ${reason}${detail}`,'warn');
        }
        return null;
      }

      const result=best.result;
      flatPatternResult=result;clearProfileStandardMatch();
      modelAnalysisReady=true;
      sheetMetalCapability={recognized:true,bendCount:Number(result.bendCount)||0,flatPlate:Boolean(result.flatPlate),cuttablePlate:Boolean(result.cuttablePlate),rolledPlate:false,rolledPlateData:null,profile:false,profileType:null,profileData:null};
      manufacturingCapability=manufacturingByGeometry.get(String(best.geometry.id))||null;
      if((Number(result.bendCount)||0)>0)manufacturingCapability=null;
      sheetMetalState.fixedFace={geometryId:String(best.geometry.id),elementId:Number(result.fixedFaceId)};
      if((!Number.isFinite(sheetMetalState.thickness)||sheetMetalState.thickness<=0)&&Number.isFinite(result.thickness))sheetMetalState.thickness=result.thickness;
      const firstR=result.bendLines?.find(b=>Number.isFinite(b.insideRadius))?.insideRadius;
      if((!Number.isFinite(sheetMetalState.radius)||sheetMetalState.radius<0)&&Number.isFinite(firstR))sheetMetalState.radius=firstR;
      buildFlatPatternScene(result);
      syncSheetMetalInputs();syncSheetMetalUnfoldUI();updateGeometryTypeIndicator();updateManufacturingUI();captureActiveModelDocumentState();
      void scheduleManufacturingMlReview(manufacturingCapability,result);
      if(!quiet){
        const warnings=(result.warnings||[]).filter(Boolean);
        const auto=result.fixedFaceAutomatic?(FR?' · détection auto':' · auto-detected'):'';
        setSheetMetalStatus(`${SMT.unfoldReady}${auto} · ${result.panelCount} ${FR?'face(s)':'face(s)'} · ${result.bendCount} ${FR?'pli(s)':'bend(s)'}${warnings.length?` · ⚠ ${warnings[0]}`:''}`,'ok');
      }
      if(activate)setFlatPatternView(true);
      return result;
    }catch(error){
      console.error('[NavoFlo unfold]',error);clearFlatPattern();if(!quiet)setSheetMetalStatus(`${SMT.unfoldFailed} · ${error?.message||error}`,'warn');return null;
    }
  })();

  sheetMetalUnfoldPromise=work;syncSheetMetalUnfoldUI();
  try{return await work;}finally{if(sheetMetalUnfoldPromise===work)sheetMetalUnfoldPromise=null;syncSheetMetalUnfoldUI();}
}

function flatPatternTrianglePositions(result){
  const top=[],bottom=[],sides=[],t=Math.max(Number(result.thickness)||0,1e-6);
  for(const tri of result.triangles||[]){
    const a=[tri[0][0],tri[0][1],0],b=[tri[1][0],tri[1][1],0],c=[tri[2][0],tri[2][1],0];top.push(...a,...b,...c);
    const ab=[a[0],a[1],-t],bb=[b[0],b[1],-t],cb=[c[0],c[1],-t];bottom.push(...cb,...bb,...ab);
  }
  // Use the exact B-Rep CUT boundary for the thickness walls whenever it closes.
  // Raw tessellation boundary edges can contain tangent seams between a flange and
  // a developed bend and were the source of false "slits" in the rendered flat.
  for(const chain of flatPhysicalBoundaryChains(result,0))for(let i=0;i+1<chain.length;i++){
    const a=chain[i],b=chain[i+1],a2=[a.x,a.y,-t],b2=[b.x,b.y,-t];
    sides.push(a.x,a.y,0,b.x,b.y,0,...b2,a.x,a.y,0,...b2,...a2);
  }
  return new Float32Array([...top,...bottom,...sides]);
}

function flatPrimitivePoints(primitive,z=0.055){
  const point=p=>new THREE.Vector3(Number(p?.[0])||0,Number(p?.[1])||0,z);
  if(primitive?.kind==='line')return[point(primitive.a),point(primitive.b)];
  if(primitive?.kind==='polyline')return(primitive.points||[]).map(point);
  if(primitive?.kind==='circle'){
    const pts=[],steps=72;for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2;pts.push(new THREE.Vector3(primitive.center[0]+Math.cos(a)*primitive.radius,primitive.center[1]+Math.sin(a)*primitive.radius,z));}return pts;
  }
  if(primitive?.kind==='arc'){
    let sweep=(primitive.endRad-primitive.startRad)%(Math.PI*2);if(sweep<0)sweep+=Math.PI*2;
    const steps=Math.max(12,Math.ceil(sweep/(Math.PI/36))),pts=[];
    for(let i=0;i<=steps;i++){const a=primitive.startRad+sweep*i/steps;pts.push(new THREE.Vector3(primitive.center[0]+Math.cos(a)*primitive.radius,primitive.center[1]+Math.sin(a)*primitive.radius,z));}return pts;
  }
  return[];
}
function flatPolylineLength(points){let length=0;for(let i=0;i+1<points.length;i++)length+=points[i].distanceTo(points[i+1]);return length;}

function flatPhysicalBoundaryChains(result,z=0.02){
  const exact=Boolean(result?.boundaryPrimitivesClosed&&(result.boundaryPrimitives||[]).length);
  if(exact)return(result.boundaryPrimitives||[]).map(p=>flatPrimitivePoints(p,z)).filter(pts=>pts.length>1);
  return(result?.boundaryEdges||[]).map(([a,b])=>[
    new THREE.Vector3(Number(a?.[0])||0,Number(a?.[1])||0,z),
    new THREE.Vector3(Number(b?.[0])||0,Number(b?.[1])||0,z)
  ]);
}
function flatWallGeometry(points,thickness){
  const t=Math.max(Number(thickness)||0,1e-6),pos=[];
  for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1];
    pos.push(a.x,a.y,0,b.x,b.y,0,b.x,b.y,-t,a.x,a.y,0,b.x,b.y,-t,a.x,a.y,-t);
  }
  if(!pos.length)return null;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}

function flatWallGeometryChains(chains,thickness){
  const t=Math.max(Number(thickness)||0,1e-6),pos=[];
  for(const points of chains||[])for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1];pos.push(a.x,a.y,0,b.x,b.y,0,b.x,b.y,-t,a.x,a.y,0,b.x,b.y,-t,a.x,a.y,-t);
  }
  if(!pos.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}

function buildFlatPatternScene(result){
  if(flatPatternRoot){scene.remove(flatPatternRoot);disposeObject(flatPatternRoot);}
  flatSurfaceMeshes=[];flatEdgeObjects=[];flatVertexObjects=[];
  flatPatternRoot=new THREE.Group();flatPatternRoot.name='NavoFlo Flat Pattern';
  const positions=flatPatternTrianglePositions(result),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:0xc7ced1,metalness:0.05,roughness:0.58,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.flatPattern=true;flatPatternRoot.add(mesh);

  // Selectable flat faces. V8.17.1 exposes the complete flattened solid, not
  // only its upper skin: top regions, underside, hole walls and plate-thickness
  // walls can all be selected/measured just like faces on the folded STEP model.
  const hitMaterial=()=>new THREE.MeshBasicMaterial({transparent:true,opacity:0.001,depthWrite:false,colorWrite:false,side:THREE.DoubleSide});
  const t=Math.max(Number(result.thickness)||0,1e-6);
  for(const [index,region] of (result.selectionFaces||[]).entries()){
    const topPos=[],bottomPos=[];
    for(const tri of region.triangles||[])for(const p of tri){topPos.push(p[0],p[1],0.035);bottomPos.push(p[0],p[1],-t-0.035);}
    if(!topPos.length)continue;
    const makeSkinHit=(pos,side)=>{const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));fg.computeVertexNormals();const hit=new THREE.Mesh(fg,hitMaterial());hit.userData.flatPatternSelection=true;hit.userData.flatKind=side==='top'?region.kind:'bottom';hit.userData.geometryId=`flat:${result.geometryId}`;hit.userData.elementId=side==='top'?(region.id||`face-${index+1}`):`bottom-${region.id||index+1}`;hit.userData.sourceFaceIds=region.sourceFaceIds||[];hit.renderOrder=80;flatPatternRoot.add(hit);flatSurfaceMeshes.push(hit);};
    makeSkinHit(topPos,'top');makeSkinHit(bottomPos,'bottom');
  }

  const physicalChains=flatPhysicalBoundaryChains(result,0.02);
  // V8.17.6: make flat wall selection obey the same logical-face conditions as
  // the folded STEP. Exact CUT primitives carry the source side-face IDs; all
  // pieces belonging to one OCCT logical cylinder are merged into one invisible
  // hit mesh. Clicking any part of a hole therefore selects the complete hole wall.
  const wallGroups=[];
  if(result?.boundaryPrimitivesClosed&&(result.boundaryPrimitives||[]).length){
    const grouped=new Map();
    for(const [index,primitive] of result.boundaryPrimitives.entries()){
      const ids=(primitive.wallFaceIds||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b),key=ids.length?`src:${ids.join(',')}`:`edge:${index}`;
      if(!grouped.has(key))grouped.set(key,{key,ids,chains:[]});const pts=flatPrimitivePoints(primitive,0.02);if(pts.length>1)grouped.get(key).chains.push(pts);
    }
    wallGroups.push(...grouped.values());
  }else physicalChains.forEach((chain,index)=>wallGroups.push({key:`mesh:${index}`,ids:[],chains:[chain]}));
  for(const [index,group] of wallGroups.entries()){
    const wg=flatWallGeometryChains(group.chains,t);if(!wg)continue;
    const wall=new THREE.Mesh(wg,hitMaterial());wall.userData.flatPatternSelection=true;wall.userData.flatKind='wall';wall.userData.geometryId=`flat:${result.geometryId}`;wall.userData.elementId=group.ids.length?`wall-face-${group.ids.join('-')}`:`wall-${index+1}`;wall.userData.sourceFaceIds=group.ids;wall.renderOrder=80;flatPatternRoot.add(wall);flatSurfaceMeshes.push(wall);
  }

  if(physicalChains.length){
    const linePos=[];for(const chain of physicalChains)for(let i=0;i+1<chain.length;i++)linePos.push(chain[i].x,chain[i].y,0.02,chain[i+1].x,chain[i+1].y,0.02);
    const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(linePos,3));const lm=new THREE.LineBasicMaterial({color:0x172027,depthTest:false,depthWrite:false});const lines=new THREE.LineSegments(lg,lm);lines.renderOrder=70;flatPatternRoot.add(lines);
  }

  // Selectable CUT primitives preserve arcs/circles instead of reducing everything
  // to triangle edges. The displayed outline remains lightweight while the picker
  // gets one logical object per edge/curve.
  const vertexMap=new Map(),addVertex=p=>{const key=`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`;if(!vertexMap.has(key))vertexMap.set(key,p.clone());};
  for(const [index,primitive] of (result.boundaryPrimitives||[]).entries()){
    const pts=flatPrimitivePoints(primitive);if(pts.length<2)continue;
    const eg=new THREE.BufferGeometry().setFromPoints(pts),em=new THREE.LineBasicMaterial({transparent:true,opacity:0.001,depthWrite:false});
    const line=new THREE.Line(eg,em);line.userData.flatPatternSelection=true;line.userData.cadEdge=true;line.userData.geometryId=`flat:${result.geometryId}`;line.userData.elementId=`cut-${primitive.edgeId??index+1}`;line.userData.flatLength=primitive.kind==='circle'?Math.PI*2*primitive.radius:primitive.kind==='arc'?primitive.radius*((primitive.endRad-primitive.startRad+Math.PI*2)%(Math.PI*2)):flatPolylineLength(pts);line.userData.flatPrimitive=primitive;flatPatternRoot.add(line);flatEdgeObjects.push(line);addVertex(pts[0]);addVertex(pts.at(-1));
  }

  if(result.bendLines?.length){
    const bendPos=[];for(const bend of result.bendLines)bendPos.push(bend.a[0],bend.a[1],0.04,bend.b[0],bend.b[1],0.04);
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bendPos,3));const bm=new THREE.LineDashedMaterial({color:0x21c58b,dashSize:Math.max(result.thickness*2,1),gapSize:Math.max(result.thickness,0.5),depthTest:false,depthWrite:false});const bl=new THREE.LineSegments(bg,bm);bl.computeLineDistances();bl.renderOrder=72;flatPatternRoot.add(bl);
    result.bendLines.forEach((bend,index)=>{const pts=[new THREE.Vector3(bend.a[0],bend.a[1],0.06),new THREE.Vector3(bend.b[0],bend.b[1],0.06)],eg=new THREE.BufferGeometry().setFromPoints(pts),em=new THREE.LineBasicMaterial({transparent:true,opacity:0.001,depthWrite:false}),line=new THREE.Line(eg,em);line.userData.flatPatternSelection=true;line.userData.cadEdge=true;line.userData.geometryId=`flat:${result.geometryId}`;line.userData.elementId=`bend-${index+1}`;line.userData.flatLength=pts[0].distanceTo(pts[1]);line.userData.flatBend=true;flatPatternRoot.add(line);flatEdgeObjects.push(line);addVertex(pts[0]);addVertex(pts[1]);});
  }

  if(vertexMap.size){
    const pts=[...vertexMap.values()],vg=new THREE.BufferGeometry().setFromPoints(pts),vm=new THREE.PointsMaterial({size:Math.max(modelSize*0.002,0.001),transparent:true,opacity:0.001,depthWrite:false}),vp=new THREE.Points(vg,vm);vp.userData.flatPatternSelection=true;vp.userData.geometryId=`flat:${result.geometryId}`;vp.userData.vertexIds=pts.map((_,i)=>`flat-v-${i+1}`);flatPatternRoot.add(vp);flatVertexObjects.push(vp);
  }
  flatPatternRoot.visible=false;scene.add(flatPatternRoot);
}

function captureCameraState(){return camera&&controls?{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),target:controls.target.toArray(),mode:cameraProjectionMode,zoom:camera.isOrthographicCamera?camera.zoom:1}:null;}
function restoreCameraState(state){
  if(!state||!camera||!controls)return false;setProjectionMode(state.mode==='perspective'?'perspective':'orthographic',{preserveScale:false,persist:false});camera.position.fromArray(state.position);camera.quaternion.fromArray(state.quaternion);camera.up.fromArray(state.up);controls.target.fromArray(state.target);if(camera.isOrthographicCamera&&Number.isFinite(state.zoom))camera.zoom=state.zoom;camera.updateProjectionMatrix();updateZoomClipping();return true;
}
function fitFlatPatternView(){
  if(!flatPatternRoot||!camera||!controls)return;const box=new THREE.Box3().setFromObject(flatPatternRoot);if(box.isEmpty())return;setProjectionMode('orthographic',{preserveScale:false,persist:false});
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),radius=Math.max(size.length()/2,1);camera.up.set(0,1,0);camera.position.set(center.x,center.y,center.z+radius*4);camera.lookAt(center);controls.target.copy(center);cadNav.pivot.copy(center);cadNav.wheelFocus.copy(center);configureOrthographicFrustum(camera);
  const margin=1.12,halfW=Math.max(size.x/2,1e-6),halfH=Math.max(size.y/2,1e-6);camera.zoom=Math.max(1e-12,Math.min((camera.right-camera.left)/(2*halfW*margin),(camera.top-camera.bottom)/(2*halfH*margin)));camera.updateProjectionMatrix();updateZoomClipping();syncProjectionUI();
}

function setFlatPatternView(active){
  active=Boolean(active&&flatPatternResult&&flatPatternRoot);if(active===flatPatternActive){if(active)fitFlatPatternView();return;}
  clearSelections();clearPreselection();clearGroup(measureOverlayRoot);clearDimensionLabel();
  if(active&&!flatPatternCameraState)flatPatternCameraState=captureCameraState();flatPatternActive=active;
  if(modelRoot)modelRoot.visible=!active;if(flatPatternRoot)flatPatternRoot.visible=active;if(sectionCapRoot)sectionCapRoot.visible=!active&&clipEnabled;
  // V8.17.2: selection + measurement remain fully available on the complete flat solid.
  for(const group of [selectionRoot,preselectionRoot,measureOverlayRoot,multiMeasureRoot])if(group)group.visible=true;
  if(E.measure)E.measure.disabled=!currentModel;if(E.multiMeasure)E.multiMeasure.disabled=!currentModel;if(E.section)E.section.disabled=active||!currentModel;
  if(active){closeSelectOther();fitFlatPatternView();if(measureEnabled){E.measureBadge.textContent=FR?'DÉPLIÉ 2D':'FLAT 2D';setMeasurePrompt(T.selectFirst);}}
  else{if(flatPatternCameraState)restoreCameraState(flatPatternCameraState);flatPatternCameraState=null;enableTools(Boolean(currentModel));if(measureEnabled)E.measureBadge.textContent=currentStepResult?T.exact:T.mesh;}
  syncSheetMetalUnfoldUI();
}

function clearFlatPattern(){
  const wasActive=flatPatternActive;
  if(flatPatternActive){flatPatternActive=false;if(modelRoot)modelRoot.visible=true;}
  if(flatPatternRoot){scene?.remove(flatPatternRoot);disposeObject(flatPatternRoot);flatPatternRoot=null;}
  flatSurfaceMeshes=[];flatEdgeObjects=[];flatVertexObjects=[];
  flatPatternResult=null;flatPatternCameraState=null;if(wasActive&&currentModel)enableTools(true);syncSheetMetalUnfoldUI();
}

async function exportFlatPatternDxf(){
  if(!currentStepResult){setSheetMetalStatus(SMT.needStep,'warn');return;}
  if(!flatPatternResult){
    const result=await runSheetMetalUnfold({activate:false,quiet:false});
    if(!result?.ok){setSheetMetalStatus(SMT.noFlat,'warn');return;}
  }
  try{
    const base=(currentFile?.name||'part').replace(/\.[^.]+$/,'')||'part',suffix=flatPatternResult?.bendCount>0?'_FLAT':'',name=`${base}${suffix}.dxf`,text=flatPatternToDxf(flatPatternResult,{partName:base,units:'in'}),blob=new Blob([text],{type:'application/dxf'});
    if(typeof window.showSaveFilePicker==='function'){
      const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'AutoCAD DXF',accept:{'application/dxf':['.dxf'],'text/plain':['.dxf']}}]});const writable=await handle.createWritable();await writable.write(blob);await writable.close();
    }else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
    setSheetMetalStatus(SMT.exportReady,'ok');
  }catch(error){if(error?.name!=='AbortError')setSheetMetalStatus(`${SMT.unfoldFailed} · ${error?.message||error}`,'warn');}
}


function positionFloatingCadActions(){
  if(!E.floatingActions||!E.workspace)return;
  const workspaceRect=E.workspace.getBoundingClientRect();
  const baseRight=14,gap=14;
  let right=baseRight;

  if(E.propsDrawer&&!E.propsDrawer.hidden){
    const drawerRect=E.propsDrawer.getBoundingClientRect();
    const actionsWidth=Math.max(E.floatingActions.offsetWidth||220,140);
    const freeLeft=Math.max(0,drawerRect.left-workspaceRect.left);
    const besideRight=Math.max(baseRight,workspaceRect.right-drawerRect.left+gap);

    // Prefer sitting beside Properties. On a narrow screen there may not be
    // enough room; in that case stay at the viewport edge with a higher z-index
    // than the drawer. The action is never hidden underneath Properties.
    right=freeLeft>=actionsWidth+gap*2?besideRight:baseRight;
  }

  E.floatingActions.style.right=`${Math.round(right)}px`;
}


function syncPropertiesState(persist=true) {
  const open = !E.propsDrawer.hidden;
  E.workspace.classList.toggle('properties-open', open);
  if(persist){navo3dPreferences.propertiesOpen=open;saveNavo3DPrefs();}
  requestAnimationFrame(()=>{resize();positionFloatingCadActions();});
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
  const targetRoot=flatPatternActive&&flatPatternRoot?flatPatternRoot:modelRoot;
  const box=new THREE.Box3().setFromObject(targetRoot);
  if (box.isEmpty()) return new THREE.Vector3(0,0,0);
  return box.getCenter(new THREE.Vector3());
}

function getCadPivotUnderPointer(clientX,clientY) {
  if (!currentModel) return getModelRotationCenter();

  setRayFromClient(clientX,clientY);
  const hit=raycaster.intersectObjects(activePickSurfaces(),false)[0]||null;

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
  if(camera?.isOrthographicCamera)return ((camera.top-camera.bottom)/Math.max(camera.zoom,1e-12))/Math.max(rect.height,1);
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

function viewPlanePointAt(clientX,clientY,planePoint){
  setRayFromClient(clientX,clientY);const normal=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize(),den=normal.dot(raycaster.ray.direction);if(Math.abs(den)<1e-10)return planePoint.clone();const t=normal.dot(planePoint.clone().sub(raycaster.ray.origin))/den;return raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction,t);
}
function orthographicZoomAt(clientX,clientY,factor){
  if(!camera?.isOrthographicCamera||!Number.isFinite(factor)||factor<=0)return;
  const focus=getCadPivotUnderPointer(clientX,clientY),before=viewPlanePointAt(clientX,clientY,focus);
  camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,1e-10,1e10);camera.updateProjectionMatrix();
  const after=viewPlanePointAt(clientX,clientY,focus),shift=before.sub(after);camera.position.add(shift);controls.target.add(shift);cadNav.pivot.add(shift);cadNav.wheelFocus.copy(focus);updateZoomClipping();updateDimensionLabelPosition();
}
function cadKeyboardZoom(inward=false){
  if(!camera||!currentModel)return;const rect=E.canvas.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  if(camera.isOrthographicCamera){orthographicZoomAt(x,y,inward?1.22:1/1.22);return;}
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize(),target=controls.target,d=Math.max(camera.position.distanceTo(target),modelSize*.02);camera.position.addScaledVector(forward,(inward?1:-1)*d*.16);updateZoomClipping();updateDimensionLabelPosition();
}
function cadKeyboardRotate(key,degrees=10){
  const pivot=getModelRotationCenter(),angle=THREE.MathUtils.degToRad(degrees),screenUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).normalize(),screenRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize();
  if(key==='arrowleft')rotateCameraRigidlyAroundPivot(screenUp,angle,pivot);else if(key==='arrowright')rotateCameraRigidlyAroundPivot(screenUp,-angle,pivot);else if(key==='arrowup')rotateCameraRigidlyAroundPivot(screenRight,angle,pivot);else if(key==='arrowdown')rotateCameraRigidlyAroundPivot(screenRight,-angle,pivot);controls.target.copy(pivot);cadNav.pivot.copy(pivot);updateZoomClipping();updateDimensionLabelPosition();
}

function cadDragZoom(dy,clientX,clientY) {
  if (!dy) return;
  if(camera?.isOrthographicCamera){orthographicZoomAt(clientX,clientY,Math.exp(-dy*0.012));return;}

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
  renderer.setSize(w,h,false);
  if(camera?.isPerspectiveCamera)camera.aspect=w/h;else if(camera?.isOrthographicCamera){const aspect=w/h;camera.left=-aspect;camera.right=aspect;camera.top=1;camera.bottom=-1;}
  camera?.updateProjectionMatrix();updateDimensionLabelPosition();positionFloatingCadActions();
}

function render() {
  renderer?.render(scene,camera);
  updateDimensionLabelPosition();
  updateMultiMeasureLabels();
}

async function loadFileSet(files,{restoreView=null,restoreSheetMetal=null,restoreAnalysis=null,restoreFocus=null,restoreAssembly=null}={}) {
  if (files.some(f=>f.size>MAX_FILE)) return showError(T.tooLarge);
  if (files.reduce((s,f)=>s+f.size,0)>MAX_TOTAL) return showError(T.totalTooLarge);

  const main = chooseMainFile(files);
  if (!main) return showError(T.unsupported);

  await clearModel(false);
  currentAssemblyFocus=restoreFocus||null;
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
      displayUnit=NAVO3D_DISPLAY_UNITS.has(navo3dPreferences.displayUnit)?navo3dPreferences.displayUnit:'mm';
      E.unitSelect.value=displayUnit;
      currentStepProperties=[];
      scanStepProperties(main).then(properties=>{
        if(currentFile!==main)return;
        currentStepProperties=properties;
        renderStepCustomProperties();
      }).catch(error=>console.warn('[NavoFlo STEP metadata]',error));
      buildExactStepScene(result);
      restoreAssemblyTreeState(restoreAssembly);
      const loadedStepRef=result;
      workerRequest('logical-face-groups',{}).then(info=>{if(currentStepResult===loadedStepRef)applyLogicalFaceCleanup(info?.groups||[]);}).catch(()=>{});
    } else {
      currentAssemblyFocus=null;currentAssemblyMode=false;currentAssemblyHierarchyAvailable=false;
      currentStepResult=null;
      currentUnit='u';
      displayUnit='u';
      E.unitSelect.value='u';
      currentStepProperties=[];
      await buildMeshScene(main,files);
    }

    finalizeLoadedModel();
    if(currentStepResult&&restoreSheetMetal){
      sheetMetalState.thickness=Number.isFinite(restoreSheetMetal.thickness)?restoreSheetMetal.thickness:null;
      sheetMetalState.radius=Number.isFinite(restoreSheetMetal.radius)?restoreSheetMetal.radius:null;
      sheetMetalState.bendAngleDeg=Number.isFinite(restoreSheetMetal.bendAngleDeg)?restoreSheetMetal.bendAngleDeg:90;
      sheetMetalState.manualKEnabled=Boolean(restoreSheetMetal.manualKEnabled);
      sheetMetalState.manualK=Number.isFinite(restoreSheetMetal.manualK)?restoreSheetMetal.manualK:(AIR_BENDING_K_TABLE[sheetMetalState.materialClass]?.toThickness??0.40);
      sheetMetalState.fixedFace=restoreSheetMetal.fixedFace&&restoreSheetMetal.fixedFace.geometryId!=null&&Number.isFinite(Number(restoreSheetMetal.fixedFace.elementId))
        ? {geometryId:String(restoreSheetMetal.fixedFace.geometryId),elementId:Number(restoreSheetMetal.fixedFace.elementId)}
        : null;
      syncSheetMetalInputs();
      syncSheetMetalUnfoldUI();
    }
    const restoredAnalysis=Boolean(currentStepResult&&!currentAssemblyMode&&restoreModelDocumentAnalysis(restoreAnalysis,main));
    E.propsDrawer.hidden=!navo3dPreferences.propertiesOpen;
    syncPropertiesState(false);
    fillProperties();
    E.empty.classList.add('hidden');
    enableTools(true);
    E.statusFile.textContent=currentAssemblyFocus?.name||main.name;
    E.statusFormat.textContent=currentFormat;
    E.statusUnits.textContent=unitLabel(displayUnit);
    fitCamera('iso');
    if(restoreView&&!restoreModelDocumentView({view:restoreView}))fitCamera('iso');

    // V8.18.4: each tab owns its completed geometric-analysis snapshot. Switching
    // or closing another tab restores the cached classification immediately.
    // Only re-run the expensive OCCT preflight when this file has no valid cache,
    // or when a sheet/plate cache intentionally has no reusable flat result.
    if(currentStepResult){
      if(currentAssemblyMode){
        // An assembly has no single manufacturing process or flat pattern. Do
        // not let the part recognizer pick an arbitrary child as the assembly
        // classification. Analysis happens per virtual part tab or via batch DXF.
        modelAnalysisReady=true;manufacturingCapability=null;sheetMetalCapability=emptySheetMetalCapability();clearFlatPattern();
        syncSheetMetalUnfoldUI();updateGeometryTypeIndicator();updateSheetMetalDimensionsUI();updateManufacturingUI();captureActiveModelDocumentState();
      }else{
        const autoDetectRef=currentStepResult;
        const needsPreflight=!restoredAnalysis||(sheetMetalCapability.recognized&&!flatPatternResult);
        if(needsPreflight)setTimeout(()=>{if(currentStepResult===autoDetectRef&&!flatPatternResult&&!sheetMetalUnfoldPromise)runSheetMetalUnfold({activate:false,quiet:true}).catch(()=>{});},120);
        else if(sheetMetalCapability.profile&&!currentProfileMatch&&sheetMetalCapability.profileData)void resolveProfileStandardMatch(sheetMetalCapability.profileData);
      }
    }
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
  const defs=(result.geometries||[]).map(makeCadDefinition),roots=result.rootNodes||[];
  assemblyTreeRecords=new Map();assemblyOccurrenceRecords=[];assemblyExpandedKeys.clear();assemblySelectedKey=null;currentHierarchyRootSpecs=[];currentActiveGeometryIds=new Set();

  currentAssemblyHierarchyAvailable=Boolean(roots.some(node=>assemblyNodeIsAssembly(node))||(roots.length>1&&Number(result?.stats?.partCount)>1));
  let rootSpecs=[];
  if(currentAssemblyFocus?.key){
    const focusNode=assemblyNodeAtKey(roots,currentAssemblyFocus.key);
    if(focusNode)rootSpecs=[{node:focusNode,key:String(currentAssemblyFocus.key)}];
    else currentAssemblyFocus=null;
  }
  if(!rootSpecs.length)rootSpecs=roots.map((node,index)=>({node,key:String(index)}));
  currentHierarchyRootSpecs=rootSpecs;
  currentAssemblyMode=Boolean(currentAssemblyHierarchyAvailable&&(rootSpecs.length>1||rootSpecs.some(spec=>assemblyNodeIsAssembly(spec.node))));

  if (rootSpecs.length) {
    for (const spec of rootSpecs) modelRoot.add(buildNode(spec.node,defs,spec.key,null,0));
  } else {
    defs.forEach((def,index)=>{
      const occurrence=makeOccurrence(def,index,null);modelRoot.add(occurrence);
      currentActiveGeometryIds.add(String(def.source.id));
    });
  }

  if(assemblyOccurrenceRecords.length){
    currentActiveGeometryIds=new Set(assemblyOccurrenceRecords.map(occ=>occ.geometryId));
    const leafCount=[...assemblyTreeRecords.values()].filter(record=>record.occurrences.length&&!record.childrenKeys.length).length;
    currentStats={
      partCount:Math.max(leafCount,1),
      geometryCount:currentActiveGeometryIds.size,
      triangleCount:assemblyOccurrenceRecords.reduce((sum,occ)=>sum+(Number(occ.triangleCount)||0),0)
    };
  }else{
    currentStats = result.stats || {partCount:roots.length||defs.length,geometryCount:defs.length,triangleCount:defs.reduce((s,d)=>s+d.triangleCount,0)};
  }

  function buildNode(node,defs,key,parentKey,depth) {
    const fallbackName=(node.meshes||[]).map(index=>defs[index]?.source?.name).find(Boolean)||'';
    const displayName=String(node.name||fallbackName||'(unnamed)');
    const group=new THREE.Group();group.name=displayName;group.userData={assemblyTreeKey:key,assemblyNode:true};
    if (Array.isArray(node.transform) && node.transform.length===16) {group.matrix.fromArray(node.transform);group.matrixAutoUpdate=false;}
    const record={key,parentKey,node,group,name:displayName,isAssembly:assemblyNodeIsAssembly(node),depth,childrenKeys:[],occurrences:[],meshIndices:[...(node.meshes||[])]};
    assemblyTreeRecords.set(key,record);
    if(parentKey&&assemblyTreeRecords.has(parentKey))assemblyTreeRecords.get(parentKey).childrenKeys.push(key);
    if(record.isAssembly&&depth<3)assemblyExpandedKeys.add(key);

    for (const meshIndex of node.meshes||[]) {
      const def=defs[meshIndex];if(!def)continue;
      const occurrence=makeOccurrence(def,meshIndex,key);group.add(occurrence);
      const occRecord={treeKey:key,group:occurrence,geometryId:String(def.source.id),meshIndex,geometry:def.source,triangleCount:def.triangleCount,surfaceMeshes:occurrence.userData.surfaceMeshes||[]};
      record.occurrences.push(occRecord);assemblyOccurrenceRecords.push(occRecord);
    }
    (node.children||[]).forEach((child,index)=>{const childKey=`${key}/${index}`;group.add(buildNode(child,defs,childKey,key,depth+1));});
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

function makeOccurrence(def,index,treeKey=null) {
  const group=new THREE.Group(),occurrenceSurfaces=[];

  const mesh=new THREE.Mesh(def.geometry,def.material);
  mesh.userData={cadSurface:true,geometryId:def.source.id,def,assemblyTreeKey:treeKey};
  surfaceMeshes.push(mesh);occurrenceSurfaces.push(mesh);
  group.add(mesh);

  for (const edge of def.source.edges||[]) {
    if (!edge.points?.length) continue;
    const eg=new THREE.BufferGeometry();
    eg.setAttribute('position',new THREE.BufferAttribute(edge.points,3));
    const line=new THREE.Line(eg,blackEdgeMaterial);
    line.userData={cadEdge:true,geometryId:def.source.id,elementId:Number(edge.id),def,edge,assemblyTreeKey:treeKey};
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
    points.userData={cadVertices:true,geometryId:def.source.id,vertexIds:ids,def,assemblyTreeKey:treeKey};
    vertexObjects.push(points); group.add(points);
  }
  group.userData={cadOccurrence:true,assemblyTreeKey:treeKey,geometryId:String(def.source.id),meshIndex:index,surfaceMeshes:occurrenceSurfaces};
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
  const hit=raycaster.intersectObjects(activePickSurfaces(),false)[0]||null;

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
  if(camera.isOrthographicCamera){
    const wheelUnits=THREE.MathUtils.clamp(Math.abs(delta)/100,0.01,5),factor=Math.exp((delta<0?1:-1)*0.18*wheelUnits);orthographicZoomAt(event.clientX,event.clientY,factor);return;
  }

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
  if(camera.isOrthographicCamera){
    camera.near=Math.max(centerDistance-radius*3.5,radius*1e-5,1e-7);camera.far=Math.max(centerDistance+radius*3.5,camera.near+radius*7);camera.updateProjectionMatrix();return;
  }

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
      if(currentAssemblyMode)clearAssemblyTreeSelection();
      clearGroup(measureOverlayRoot);clearDimensionLabel();
      clearPreselection();
    }
    return;
  }

  acceptSelection(selection, event);
  const treeKey=selection?.object?.userData?.assemblyTreeKey;if(currentAssemblyMode&&treeKey&&assemblyTreeRecords.has(treeKey))selectAssemblyTreeNode(treeKey);
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
  const hit=raycaster.intersectObjects(activePickSurfaces(),false)[0];
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
    const hit=raycaster.intersectObjects(activePickSurfaces(),true)[0];
    return hit ? {kind:'point',point:hit.point.clone(),object:hit.object,meshOnly:true} : null;
  }

  const wantVertex=selectionMode==='vertex'||selectionMode==='auto';
  const wantEdge=selectionMode==='edge'||selectionMode==='auto';
  const wantFace=selectionMode==='face'||selectionMode==='auto';

  let vertexCandidate=null,edgeCandidate=null,faceCandidate=null;

  // This is the opaque surface physically closest to the camera on the
  // current mouse ray. Edges/vertices farther behind it are not clickable.
  const frontSurfaceHit=raycaster.intersectObjects(activePickSurfaces(),false)[0]||null;
  const frontSurfaceDistance=frontSurfaceHit?.distance ?? Infinity;

  if (wantVertex) {
    const hits=raycaster.intersectObjects(activePickVertices(),false).slice(0,8);
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
    const hits=raycaster.intersectObjects(activePickEdges(),false).slice(0,12);
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

function selectionIncludesCandidate(grouped,candidate){
  if(!grouped||!candidate||grouped.kind!==candidate.kind||String(grouped.geometryId)!==String(candidate.geometryId)||grouped.object?.parent!==candidate.object?.parent)return false;
  if(grouped.kind==='face'&&Array.isArray(grouped.memberFaceIds))return grouped.memberFaceIds.map(Number).includes(Number(candidate.elementId));
  if(grouped.kind==='edge'&&Array.isArray(grouped.memberEdgeIds))return grouped.memberEdgeIds.map(Number).includes(Number(candidate.elementId));
  return Number(grouped.elementId)===Number(candidate.elementId);
}

function updatePreselection(clientX,clientY) {
  const candidate=pickSelectionCandidate(clientX,clientY);
  const key=candidate?selectionKey(candidate):'';

  // A committed selection must remain visually locked in blue.
  // Do not place the hover/preselection color over it.
  if(candidate && selected.some(item=>selectionKey(item)===key||selectionIncludesCandidate(item,candidate))){
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
    const g=buildFaceOverlayGeometry(s);
    if(!g)return;
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

  const frontSurfaceHit=raycaster.intersectObjects(activePickSurfaces(),false)[0]||null;
  const frontSurfaceDistance=frontSurfaceHit?.distance ?? Infinity;

  const push=(selection,score,depth)=>{
    if(!selection)return;
    const key=selectionKey(selection);
    if(seen.has(key))return;
    seen.add(key);
    candidates.push({selection,score,depth});
  };

  if (!currentStepResult) {
    for(const hit of raycaster.intersectObjects(activePickSurfaces(),true).slice(0,5)) {
      push({kind:'point',point:hit.point.clone(),object:hit.object,meshOnly:true},0,hit.distance);
    }
    return candidates.sort((a,b)=>a.depth-b.depth).map(x=>x.selection);
  }

  for(const hit of raycaster.intersectObjects(activePickVertices(),false).slice(0,8)) {
    if(!isPickVisible(hit.distance,frontSurfaceDistance,'vertex'))continue;
    const selection=selectionFromVertex(hit);
    push(selection,screenDistance(selection.point,clientX,clientY,rect)-4,hit.distance);
  }

  for(const hit of raycaster.intersectObjects(activePickEdges(),false).slice(0,16)) {
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
    point:hit.point.clone(),object:o,def:o.userData.def,flatPattern:Boolean(o.userData.flatPatternSelection),
    transform:o.matrixWorld.toArray()
  };
}
function selectionFromVertex(hit) {
  const o=hit.object,id=o.userData.vertexIds[hit.index];
  const point=new THREE.Vector3().fromBufferAttribute(o.geometry.getAttribute('position'),hit.index).applyMatrix4(o.matrixWorld);
  return {
    kind:'vertex',geometryId:o.userData.geometryId,elementId:id,
    point,object:o,def:o.userData.def,flatPattern:Boolean(o.userData.flatPatternSelection),transform:o.matrixWorld.toArray()
  };
}
function selectionFromFace(hit) {
  const o=hit.object;
  if(o.userData.flatPatternSelection){
    return {kind:'face',geometryId:o.userData.geometryId,elementId:o.userData.elementId,point:hit.point.clone(),object:o,flatPattern:true,transform:o.matrixWorld.toArray()};
  }
  const def=o.userData.def;
  let id = def?.triangleToFaceMap?.[hit.faceIndex];
  if (id == null || id < 0) {
    const offset=hit.faceIndex*3;
    const face=def?[...def.facesById.values()].find(f=>offset>=f.firstIndex&&offset<f.firstIndex+f.indexCount):null;
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
  if(selection?.flatPattern&&selection?.kind==='face')return new THREE.Vector3(0,0,1).transformDirection(selection.object.matrixWorld).normalize();
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
  if(selection?.flatPattern&&selection?.kind==='face'&&selection.object?.geometry){
    const geometry=selection.object.geometry,positions=geometry.getAttribute('position'),index=geometry.index?.array||null,matrix=selection.object.matrixWorld,normals=[];
    const count=index?index.length:positions?.count||0;
    for(let offset=0;offset+2<count;offset+=3){const ia=index?index[offset]:offset,ib=index?index[offset+1]:offset+1,ic=index?index[offset+2]:offset+2,a=new THREE.Vector3().fromBufferAttribute(positions,ia).applyMatrix4(matrix),b=new THREE.Vector3().fromBufferAttribute(positions,ib).applyMatrix4(matrix),c=new THREE.Vector3().fromBufferAttribute(positions,ic).applyMatrix4(matrix),normal=b.clone().sub(a).cross(c.clone().sub(a));if(normal.lengthSq()>1e-20)normals.push(normal.normalize());}return normals;
  }
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

async function expandLogicalFaceSelection(selection){
  if(selection?.flatPattern||selection?.kind!=='face'||!currentStepResult)return selection;
  const cacheKey=`${selection.geometryId}:${selection.elementId}`;
  let ids=logicalFaceGroupCache.get(cacheKey);
  if(!ids){
    try{const result=await workerRequest('logical-face-group',{selection:serialSelection(selection)});ids=Array.isArray(result?.faceIds)&&result.faceIds.length?result.faceIds.map(Number):[Number(selection.elementId)];}catch{ids=[Number(selection.elementId)];}
    ids=[...new Set(ids)].sort((a,b)=>a-b);for(const id of ids)logicalFaceGroupCache.set(`${selection.geometryId}:${id}`,ids);
  }
  if(ids.length>1){applyLogicalFaceCleanup([{geometryId:selection.geometryId,faceIds:ids,seamEdgeIds:internalSeamEdgesForFaceGroup(selection.def,ids)}]);return {...selection,elementId:ids[0],memberFaceIds:ids};}
  return selection;
}
async function expandLogicalEdgeSelection(selection){
  if(selection?.flatPattern||selection?.kind!=='edge'||!currentStepResult)return selection;
  const cacheKey=`${selection.geometryId}:${selection.elementId}`;let ids=logicalEdgeGroupCache.get(cacheKey);
  if(!ids){try{const result=await workerRequest('logical-edge-group',{selection:serialSelection(selection)});ids=Array.isArray(result?.edgeIds)&&result.edgeIds.length?result.edgeIds.map(Number):[Number(selection.elementId)];}catch{ids=[Number(selection.elementId)];}
    ids=[...new Set(ids)].sort((a,b)=>a-b);for(const id of ids)logicalEdgeGroupCache.set(`${selection.geometryId}:${id}`,ids);}
  return ids.length>1?{...selection,elementId:ids[0],memberEdgeIds:ids}:selection;
}
async function expandLogicalSelection(selection){selection=await expandLogicalFaceSelection(selection);selection=await expandLogicalEdgeSelection(selection);return selection;}
function internalSeamEdgesForFaceGroup(def,faceIds){
  const set=new Set((faceIds||[]).map(Number)),ids=[];for(const edge of def?.source?.edges||[]){const owners=(edge.ownerFaceIds||[]).map(Number).filter(id=>set.has(id));if(owners.length>=2)ids.push(Number(edge.id));}return ids;
}
function applyLogicalFaceCleanup(groups){
  for(const group of groups||[]){for(const edgeId of group.seamEdgeIds||[])logicalHiddenEdgeKeys.add(`${group.geometryId}:${Number(edgeId)}`);}
  for(const line of edgeObjects){const key=`${line.userData?.geometryId}:${Number(line.userData?.elementId)}`;line.userData.logicalHidden=logicalHiddenEdgeKeys.has(key);line.visible=edgesVisible&&!line.userData.logicalHidden;}
}
function edgeObjectsForSelection(selection){
  if(selection?.flatPattern){const parent=selection?.object?.parent;return flatEdgeObjects.filter(line=>line.parent===parent&&String(line.userData?.geometryId)===String(selection.geometryId)&&String(line.userData?.elementId)===String(selection.elementId));}
  const ids=new Set(Array.isArray(selection?.memberEdgeIds)&&selection.memberEdgeIds.length?selection.memberEdgeIds:[Number(selection?.elementId)]);
  const parent=selection?.object?.parent;return edgeObjects.filter(line=>line.parent===parent&&String(line.userData?.geometryId)===String(selection.geometryId)&&ids.has(Number(line.userData?.elementId)));
}

function faceIdsForHighlight(selection){
  return Array.isArray(selection?.memberFaceIds)&&selection.memberFaceIds.length?selection.memberFaceIds:[Number(selection.elementId)];
}
function buildFaceOverlayGeometry(selection){
  if(selection?.flatPattern&&selection.object?.geometry)return selection.object.geometry.clone();
  const source=selection.def?.geometry,srcIndex=source?.index?.array,indices=[];if(!source||!srcIndex)return null;
  for(const id of faceIdsForHighlight(selection)){
    const face=selection.def.facesById.get(Number(id));if(!face)continue;
    for(let i=face.firstIndex;i<face.firstIndex+face.indexCount;i++)indices.push(srcIndex[i]);
  }
  if(!indices.length)return null;
  const g=new THREE.BufferGeometry();g.setAttribute('position',source.getAttribute('position'));
  if(source.getAttribute('normal'))g.setAttribute('normal',source.getAttribute('normal'));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));return g;
}

async function acceptSelection(selection, event={}) {
  // Once clicked, the hover overlay must get out of the way immediately.
  // The committed blue overlay is the only visual state until deselection.
  clearPreselection();
  selection=await expandLogicalSelection(selection);

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
  E.measureBadge.textContent=flatPatternActive?(FR?'DÉPLIÉ 2D':'FLAT 2D'):(currentStepResult?T.exact:T.mesh);

  if(flatPatternActive&&selection?.flatPattern){
    if(selected.length===1)showFlatSingleMeasurement(selected[0]);
    else if(selected.length===2)showFlatPairMeasurement(selected[0],selected[1]);
    return;
  }

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
      const pinned=showSingleExact(details);
      if(!pinned)E.selectionSummary.textContent=T.selectSecond;
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
    kind:s.kind,geometryId:s.geometryId,elementId:s.elementId,
    elementIds:Array.isArray(s.memberFaceIds)?s.memberFaceIds:(Array.isArray(s.memberEdgeIds)?s.memberEdgeIds:undefined),
    transform:s.object.matrixWorld.toArray()
  };
}
function selectionKey(s){const memberKey=s.kind==='face'&&Array.isArray(s.memberFaceIds)?s.memberFaceIds.join(','):s.kind==='edge'&&Array.isArray(s.memberEdgeIds)?s.memberEdgeIds.join(','):(s.elementId??'');return `${s.kind}:${s.geometryId||''}:${memberKey}:${s.object?.parent?.uuid||s.object?.uuid||''}`}

function removeSelectionHighlight(key) {
  const group=selectionHighlightMap.get(key);
  if(!group)return;

  const sourceObjects=group.userData?.sourceObjects||[group.userData?.sourceObject].filter(Boolean);
  for(const sourceObject of sourceObjects)if(sourceObject?.userData?.cadEdge)sourceObject.visible=edgesVisible&&!sourceObject.userData.logicalHidden;

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
    const sources=edgeObjectsForSelection(s);parent.userData.sourceObjects=sources;
    for(const source of sources){source.visible=false;const line=new THREE.Line(source.geometry.clone(),new THREE.LineBasicMaterial({color,depthTest:true,depthWrite:false,depthFunc:THREE.LessEqualDepth}));line.matrix.copy(source.matrixWorld);line.matrixAutoUpdate=false;line.renderOrder=40;parent.add(line);}

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
    const g=buildFaceOverlayGeometry(s);
    if(!g)return;
    const mesh=new THREE.Mesh(g,selectionFaceMaterial.clone());
    mesh.material.color.setHex(faceColor);
    mesh.material.side=THREE.DoubleSide;
    mesh.material.depthWrite=false;
    mesh.material.depthFunc=s.flatPattern?THREE.LessEqualDepth:THREE.EqualDepth;
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
  if(!measureEnabled&&multiMeasureEnabled){multiMeasureEnabled=false;E.multiMeasure?.classList.remove('active');E.multiMeasure?.setAttribute('aria-pressed','false');}
  E.measure.classList.toggle('active',measureEnabled);
  E.measureType.disabled=!measureEnabled;
  E.workspace.classList.toggle('selecting',measureEnabled);
  clearSelections();
  if (measureEnabled) {
    E.measureCard.hidden=false;
    E.measureBadge.textContent=flatPatternActive?(FR?'DÉPLIÉ 2D':'FLAT 2D'):(currentStepResult?T.exact:T.mesh);
    setMeasurePrompt(T.selectFirst);
  } else {
    E.measureCard.hidden=true;
  }
}
function toggleMultiMeasure(){
  if(!currentModel)return;
  if(!measureEnabled)toggleMeasure();
  multiMeasureEnabled=!multiMeasureEnabled;
  E.multiMeasure?.classList.toggle('active',multiMeasureEnabled);
  E.multiMeasure?.setAttribute('aria-pressed',multiMeasureEnabled?'true':'false');
  if(multiMeasureEnabled){E.measureCard.hidden=false;E.selectionSummary.textContent=FR?'Multi-cotation active · les cotes terminées restent visibles.':'Multi-measure active · completed dimensions stay visible.';}
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
  clearMultiMeasurements();
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

  let viewportDimension=false;
  if(Number.isFinite(d.diameter)&&d.diameter>0){
    viewportDimension=drawExactDiameterDimension(d,`Ø ${formatLength(d.diameter)}`);
  }else if(Number.isFinite(d.radius)&&d.radius>0){
    viewportDimension=drawExactRadiusDimension(d,`R ${formatLength(d.radius)}`);
  }else if(d.kind==='edge'&&Number.isFinite(d.length)&&d.length>0){
    viewportDimension=drawExactEdgeLengthDimension(d,selected[0],formatLength(d.length));
  }

  if (d.hole?.diameter) {
    details.push([T.hole,`Ø ${formatLength(d.hole.diameter)}`]);
    if (isFinite(d.hole.depth)) details.push([T.depth,formatLength(d.hole.depth)]);
  }

  renderDetails(details);
  if(multiMeasureEnabled&&viewportDimension){pinCurrentMeasurement();E.selectionSummary.textContent=T.multiAdded;return true;}
  return false;
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

function faceFacePerpendicularAnnotation(result){
  if(selected.some(s=>s?.flatPattern))return null;
  if(selected.length!==2||selected[0]?.kind!=='face'||selected[1]?.kind!=='face')return null;
  const n1=getSelectedFaceNormal(selected[0]),n2=getSelectedFaceNormal(selected[1]);if(!n1||!n2||Math.abs(n1.dot(n2))<0.9995)return null;
  const a=selected[0].point?.clone?.(),b=selected[1].point?.clone?.();if(!a||!b)return null;
  const sign=Math.sign(n1.dot(b.clone().sub(a)))||1,mag=Number(result?.value);if(!Number.isFinite(mag))return null;
  const q=a.clone().addScaledVector(n1,sign*mag);return[a.toArray(),q.toArray()];
}
function addMeasureSegment(a,b,color=0x35d39a,order=40){
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false}));line.renderOrder=order;measureOverlayRoot.add(line);return line;
}
function planeIntersectionAnchor(pointA,normalA,pointB,normalB,near){
  const dir=normalA.clone().cross(normalB),denom=dir.lengthSq();if(denom<1e-12)return null;
  const d1=normalA.dot(pointA),d2=normalB.dot(pointB);
  const term1=normalB.clone().cross(dir).multiplyScalar(d1),term2=dir.clone().cross(normalA).multiplyScalar(d2),x=term1.add(term2).divideScalar(denom);
  const t=dir.dot(near.clone().sub(x))/denom;return{x:x.addScaledVector(dir,t),dir:dir.normalize()};
}
function addAngularArrow(tip,tangent,radial,size){
  const back=tip.clone().addScaledVector(tangent,-size),wing=size*.42;
  addMeasureSegment(tip,back.clone().addScaledVector(radial,wing),0x35d39a,43);addMeasureSegment(tip,back.clone().addScaledVector(radial,-wing),0x35d39a,43);
}
function drawAngleDimension(labelText=''){
  if(selected.length!==2)return false;const a=selected[0],b=selected[1];
  if(a.kind!=='face'||b.kind!=='face')return false;
  const n1=getSelectedFaceNormal(a),n2=getSelectedFaceNormal(b),p1=a.point?.clone?.(),p2=b.point?.clone?.();if(!n1||!n2||!p1||!p2)return false;
  const hit=planeIntersectionAnchor(p1,n1,p2,n2,p1.clone().add(p2).multiplyScalar(.5));if(!hit)return false;
  const axis=hit.dir,origin=hit.x;let r1=axis.clone().cross(n1).normalize(),r2=axis.clone().cross(n2).normalize();
  if(r1.dot(p1.clone().sub(origin))<0)r1.negate();if(r2.dot(p2.clone().sub(origin))<0)r2.negate();
  let signed=Math.atan2(axis.dot(r1.clone().cross(r2)),THREE.MathUtils.clamp(r1.dot(r2),-1,1));if(Math.abs(signed)<1e-6)return false;
  if(signed>Math.PI)signed-=Math.PI*2;if(signed<-Math.PI)signed+=Math.PI*2;
  const clickR=Math.min(p1.distanceTo(origin),p2.distanceTo(origin)),radius=Math.max(modelSize*.025,Math.min(modelSize*.16,clickR*.58||modelSize*.07)),points=[],steps=42;
  for(let i=0;i<=steps;i++){const q=r1.clone().applyAxisAngle(axis,signed*i/steps);points.push(origin.clone().addScaledVector(q,radius));}
  const arc=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x35d39a,depthTest:false,depthWrite:false}));arc.renderOrder=42;measureOverlayRoot.add(arc);
  const start=points[0],end=points[points.length-1],ext0=origin.clone().addScaledVector(r1,radius*1.12),ext1=origin.clone().addScaledVector(r2,radius*1.12);addMeasureSegment(origin.clone().addScaledVector(r1,radius*.14),ext0);addMeasureSegment(origin.clone().addScaledVector(r2,radius*.14),ext1);
  const sign=Math.sign(signed),tanStart=axis.clone().cross(r1).multiplyScalar(sign).normalize(),tanEnd=axis.clone().cross(r2).multiplyScalar(sign).normalize(),arrow=Math.max(modelSize*.006,radius*.085);
  addAngularArrow(start,tanStart,r1,arrow);addAngularArrow(end,tanEnd.negate(),r2,arrow);addMeasureMarker(start);addMeasureMarker(end);
  const midDir=r1.clone().applyAxisAngle(axis,signed*.5),labelPoint=origin.clone().addScaledVector(midDir,radius*1.10);setDimensionLabel(labelText,labelPoint);return true;
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
    if(!drawAngleDimension(label))drawMeasureLine(annotationA,annotationB,label);

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

    const perpendicular=faceFacePerpendicularAnnotation(r);
    const a=perpendicular?.[0]||annotationA;
    const b=perpendicular?.[1]||annotationB;
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
  if(multiMeasureEnabled){pinCurrentMeasurement();E.selectionSummary.textContent=T.multiAdded;}
}

function flatFaceArea(selection){
  const geometry=selection?.object?.geometry,positions=geometry?.getAttribute?.('position'),index=geometry?.index?.array||null;if(!positions)return 0;
  const count=index?index.length:positions.count;let area=0;
  for(let i=0;i+2<count;i+=3){const ia=index?index[i]:i,ib=index?index[i+1]:i+1,ic=index?index[i+2]:i+2,a=new THREE.Vector3().fromBufferAttribute(positions,ia),b=new THREE.Vector3().fromBufferAttribute(positions,ib),c=new THREE.Vector3().fromBufferAttribute(positions,ic);area+=b.sub(a).cross(c.sub(a)).length()/2;}
  return area;
}
function showFlatSingleMeasurement(selection){
  clearGroup(measureOverlayRoot);clearDimensionLabel();currentMeasureResult=null;
  if(selection?.kind==='edge'){
    const source=edgeObjectsForSelection(selection)[0]||selection.object,attr=source?.geometry?.getAttribute?.('position');let length=Number(source?.userData?.flatLength);
    if(!Number.isFinite(length)&&attr?.count>1){length=0;for(let i=0;i+1<attr.count;i++){const a=new THREE.Vector3().fromBufferAttribute(attr,i),b=new THREE.Vector3().fromBufferAttribute(attr,i+1);length+=a.distanceTo(b);}}
    if(Number.isFinite(length)){
      const label=formatLength(length);E.measureMain.textContent=label;renderDetails([[FR?'Longueur':'Length',label]]);currentMeasureResult={ok:true,kind:'distance',value:length};
      if(attr?.count>1){const a=new THREE.Vector3().fromBufferAttribute(attr,0).applyMatrix4(source.matrixWorld),b=new THREE.Vector3().fromBufferAttribute(attr,attr.count-1).applyMatrix4(source.matrixWorld);drawMeasureLine(a.toArray(),b.toArray(),label);}
    }
  }else if(selection?.kind==='face'){
    const area=flatFaceArea(selection),label=formatArea(area);E.measureMain.textContent=label;renderDetails([[T.area,label]]);currentMeasureResult={ok:true,kind:'area',value:area};
  }else{
    E.measureMain.textContent=formatPoint(selection.point);renderDetails([]);
  }
  E.selectionSummary.textContent=T.selectSecond;
}
function showFlatPairMeasurement(a,b){
  const mode=E.measureType.value;
  if(mode==='angle'||mode==='smart'){
    const angle=measureAngleFallback(a,b);
    if(angle?.ok&&Number.isFinite(angle.value)&&(mode==='angle'||angle.value>THREE.MathUtils.degToRad(0.25))){showPairExact(angle);return;}
  }
  const delta=new THREE.Vector3().subVectors(b.point,a.point),distance=a.point.distanceTo(b.point),result={ok:true,kind:'distance',value:distance,pointA:a.point.toArray(),pointB:b.point.toArray(),dx:Math.abs(delta.x),dy:Math.abs(delta.y),dz:Math.abs(delta.z),flat:true};
  showPairExact(result);
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


function edgeWorldPolyline(selection){
  const source=edgeObjectsForSelection(selection)[0];if(!source)return[];
  const attr=source.geometry?.getAttribute?.('position');if(!attr||attr.count<2)return[];
  const points=[];for(let i=0;i<attr.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(source.matrixWorld));return points;
}
function drawExactEdgeLengthDimension(details,selection,labelText){
  const points=edgeWorldPolyline(selection);if(points.length<2)return false;
  const a=points[0],b=points[points.length-1],dir=b.clone().sub(a);if(dir.lengthSq()<1e-16)return false;dir.normalize();
  const family=String(details?.family||'').toLowerCase();
  if(family!=='line'){
    const anchor=selection?.point?.clone?.()||points[Math.floor(points.length/2)].clone();
    let viewDir=new THREE.Vector3();camera.getWorldDirection(viewDir);let side=camera.up.clone().cross(viewDir).normalize();if(side.lengthSq()<1e-12)side.set(1,0,0);
    const labelPoint=anchor.clone().addScaledVector(side,Math.max(modelSize*.025,details.length*.08||0));addMeasureSegment(anchor,labelPoint,0x35d39a,41);addMeasureMarker(anchor);setDimensionLabel(labelText,labelPoint);return true;
  }
  let viewDir=new THREE.Vector3();camera.getWorldDirection(viewDir).normalize();let offsetDir=viewDir.clone().cross(dir);
  if(offsetDir.lengthSq()<1e-10)offsetDir=camera.up.clone().cross(dir);if(offsetDir.lengthSq()<1e-10)offsetDir.set(0,1,0);offsetDir.normalize();
  const span=a.distanceTo(b),offset=Math.max(modelSize*.018,Math.min(modelSize*.055,span*.20)),q1=a.clone().addScaledVector(offsetDir,offset),q2=b.clone().addScaledVector(offsetDir,offset);
  addMeasureSegment(a,q1,0x35d39a,39);addMeasureSegment(b,q2,0x35d39a,39);addMeasureSegment(q1,q2,0x35d39a,42);
  const arrow=Math.max(modelSize*.005,Math.min(span*.12,modelSize*.012)),wing=viewDir.clone();addLinearArrow3D(q1,dir,wing,arrow);addLinearArrow3D(q2,dir.clone().negate(),wing,arrow);addMeasureMarker(q1);addMeasureMarker(q2);
  const labelPoint=q1.clone().add(q2).multiplyScalar(.5).addScaledVector(offsetDir,Math.max(modelSize*.007,span*.035));setDimensionLabel(labelText,labelPoint);return true;
}


function exactRadialFrame(details){
  if(!Array.isArray(details?.center)||details.center.length!==3)return null;
  const center=new THREE.Vector3(...details.center),axis=new THREE.Vector3(...(details.axisDirection||[0,0,1]));
  if(axis.lengthSq()<1e-12)axis.set(0,0,1);axis.normalize();
  const click=selected[0]?.point?.clone?.();if(!click)return null;
  const sectionCenter=center.clone().addScaledVector(axis,click.clone().sub(center).dot(axis));
  let radial=click.clone().sub(sectionCenter);
  if(radial.lengthSq()<1e-12){radial=axis.clone().cross(camera?.up||new THREE.Vector3(0,1,0));if(radial.lengthSq()<1e-12)radial=axis.clone().cross(new THREE.Vector3(1,0,0));}
  radial.normalize();const tangent=axis.clone().cross(radial).normalize();return{center:sectionCenter,axis,radial,tangent};
}
function addLinearArrow3D(tip,direction,wingDir,size){
  const d=direction.clone().normalize(),w=wingDir.clone().normalize(),back=tip.clone().addScaledVector(d,-size),wing=size*.42;
  addMeasureSegment(tip,back.clone().addScaledVector(w,wing),0x35d39a,43);addMeasureSegment(tip,back.clone().addScaledVector(w,-wing),0x35d39a,43);
}
function drawExactDiameterDimension(details,labelText){
  const radius=Number(details.radius)||Number(details.diameter)/2,frame=exactRadialFrame(details);if(!(radius>0)||!frame)return false;
  const q1=frame.center.clone().addScaledVector(frame.radial,-radius),q2=frame.center.clone().addScaledVector(frame.radial,radius),arrow=Math.max(modelSize*.006,radius*.10);
  addMeasureSegment(q1,q2);addLinearArrow3D(q1,frame.radial,frame.tangent,arrow);addLinearArrow3D(q2,frame.radial.clone().negate(),frame.tangent,arrow);addMeasureMarker(q1);addMeasureMarker(q2);
  const labelPoint=q2.clone().addScaledVector(frame.radial,Math.max(radius*.48,modelSize*.018));addMeasureSegment(q2,labelPoint,0x35d39a,41);setDimensionLabel(labelText,labelPoint);return true;
}
function drawExactRadiusDimension(details,labelText){
  const radius=Number(details.radius),frame=exactRadialFrame(details);if(!(radius>0)||!frame)return false;
  const q=frame.center.clone().addScaledVector(frame.radial,radius),arrow=Math.max(modelSize*.006,radius*.10);addMeasureSegment(frame.center,q);addLinearArrow3D(q,frame.radial.clone().negate(),frame.tangent,arrow);addMeasureMarker(frame.center);addMeasureMarker(q);
  const labelPoint=q.clone().addScaledVector(frame.radial,Math.max(radius*.42,modelSize*.018));addMeasureSegment(q,labelPoint,0x35d39a,41);setDimensionLabel(labelText,labelPoint);return true;
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


function disposeMeasureGroup(group){
  group?.traverse?.(obj=>{if(obj!==group){obj.geometry?.dispose?.();if(obj.material&&!Array.isArray(obj.material))obj.material.dispose?.();else if(Array.isArray(obj.material))obj.material.forEach(m=>m?.dispose?.());}});group?.parent?.remove?.(group);
}
function createPinnedMeasureLabel(text,point,offset={x:0,y:0}){
  if(!text||!point)return null;
  const label=document.createElement('div');label.className='cad-dimension-label cad-multi-dimension-label';label.textContent=text;label.title=FR?'Cote multi · glissez pour déplacer':'Multi dimension · drag to move';E.workspace.append(label);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('cad-dimension-tether','cad-multi-dimension-tether');svg.setAttribute('aria-hidden','true');const line=document.createElementNS('http://www.w3.org/2000/svg','line');svg.append(line);E.workspace.append(svg);
  const rec={id:++multiMeasureSeq,label,svg,line,point:point.clone(),offset:{x:Number(offset.x)||0,y:Number(offset.y)||0},drag:null,group:null};
  label.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();rec.drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX:rec.offset.x,offsetY:rec.offset.y};label.setPointerCapture?.(event.pointerId);label.classList.add('dragging');});
  label.addEventListener('pointermove',event=>{if(!rec.drag||rec.drag.pointerId!==event.pointerId)return;event.preventDefault();rec.offset.x=rec.drag.offsetX+(event.clientX-rec.drag.startX);rec.offset.y=rec.drag.offsetY+(event.clientY-rec.drag.startY);updatePinnedMeasureLabel(rec);});
  const end=event=>{if(!rec.drag||rec.drag.pointerId!==event.pointerId)return;rec.drag=null;label.classList.remove('dragging');};label.addEventListener('pointerup',end);label.addEventListener('pointercancel',end);
  label.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();rec.offset={x:0,y:0};updatePinnedMeasureLabel(rec);});
  updatePinnedMeasureLabel(rec);return rec;
}
function updatePinnedMeasureLabel(rec){
  if(!rec?.label||!rec.point||!camera)return;const projected=rec.point.clone().project(camera);if(projected.z < -1 || projected.z > 1){rec.label.style.visibility='hidden';rec.svg.hidden=true;return;}
  const rect=E.workspace.getBoundingClientRect(),anchorX=(projected.x*.5+.5)*rect.width,anchorY=(-projected.y*.5+.5)*rect.height,x=anchorX+rec.offset.x,y=anchorY+rec.offset.y;rec.label.style.visibility='visible';rec.label.style.left=`${x}px`;rec.label.style.top=`${y}px`;
  const moved=Math.hypot(rec.offset.x,rec.offset.y)>5;rec.svg.hidden=!moved;rec.svg.style.display=moved?'':'none';if(moved){rec.line.setAttribute('x1',String(anchorX));rec.line.setAttribute('y1',String(anchorY));rec.line.setAttribute('x2',String(x));rec.line.setAttribute('y2',String(y));}
}
function updateMultiMeasureLabels(){for(const rec of multiMeasureRecords)updatePinnedMeasureLabel(rec);}
function pinCurrentMeasurement(){
  if(!measureOverlayRoot?.children?.length&&!dimensionLabelPoint)return false;
  const group=new THREE.Group();while(measureOverlayRoot.children.length)group.add(measureOverlayRoot.children[0]);multiMeasureRoot.add(group);
  const text=dimensionLabel&&!dimensionLabel.hidden?dimensionLabel.textContent:'';const rec=createPinnedMeasureLabel(text,dimensionLabelPoint,dimensionLabelOffset);if(rec)rec.group=group;multiMeasureRecords.push(rec||{id:++multiMeasureSeq,group,label:null,svg:null,line:null,point:null,offset:{x:0,y:0}});clearDimensionLabel();return true;
}
function clearMultiMeasurements(){
  for(const rec of multiMeasureRecords){rec.label?.remove?.();rec.svg?.remove?.();disposeMeasureGroup(rec.group);}multiMeasureRecords=[];if(multiMeasureRoot)while(multiMeasureRoot.children.length)disposeMeasureGroup(multiMeasureRoot.children[0]);
}

function ensureDimensionTether(){
  if(dimensionTether)return dimensionTether;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('cad-dimension-tether');svg.setAttribute('aria-hidden','true');
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1','0');line.setAttribute('y1','0');line.setAttribute('x2','0');line.setAttribute('y2','0');svg.append(line);E.workspace.append(svg);dimensionTether={svg,line};return dimensionTether;
}
function ensureDimensionLabel() {
  if (dimensionLabel) return dimensionLabel;
  const label=document.createElement('div');label.className='cad-dimension-label';label.hidden=true;label.title=FR?'Glissez pour déplacer la cote':'Drag to move the dimension label';E.workspace.appendChild(label);dimensionLabel=label;ensureDimensionTether();
  label.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();dimensionLabelDrag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX:dimensionLabelOffset.x,offsetY:dimensionLabelOffset.y};label.setPointerCapture?.(event.pointerId);label.classList.add('dragging');});
  label.addEventListener('pointermove',event=>{if(!dimensionLabelDrag||dimensionLabelDrag.pointerId!==event.pointerId)return;event.preventDefault();event.stopPropagation();dimensionLabelOffset.x=dimensionLabelDrag.offsetX+(event.clientX-dimensionLabelDrag.startX);dimensionLabelOffset.y=dimensionLabelDrag.offsetY+(event.clientY-dimensionLabelDrag.startY);updateDimensionLabelPosition();});
  const endDrag=event=>{if(!dimensionLabelDrag||dimensionLabelDrag.pointerId!==event.pointerId)return;dimensionLabelDrag=null;label.classList.remove('dragging');};label.addEventListener('pointerup',endDrag);label.addEventListener('pointercancel',endDrag);
  label.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();dimensionLabelOffset={x:0,y:0};updateDimensionLabelPosition();});
  return label;
}
function clearDimensionLabel() {
  dimensionLabelPoint=null;dimensionLabelOffset={x:0,y:0};dimensionLabelDrag=null;
  if(dimensionLabel){dimensionLabel.hidden=true;dimensionLabel.style.display='none';dimensionLabel.style.visibility='hidden';dimensionLabel.textContent='';dimensionLabel.classList.remove('dragging');}
  if(dimensionTether?.svg){dimensionTether.svg.hidden=true;dimensionTether.svg.style.display='none';dimensionTether.line.setAttribute('x1','0');dimensionTether.line.setAttribute('y1','0');dimensionTether.line.setAttribute('x2','0');dimensionTether.line.setAttribute('y2','0');}
}
function setDimensionLabel(text,point) {
  if(!text||!point)return clearDimensionLabel();
  const label=ensureDimensionLabel();dimensionLabelPoint=point.clone();dimensionLabelOffset={x:0,y:0};label.textContent=text;label.hidden=false;label.style.display='';if(dimensionTether?.svg)dimensionTether.svg.style.display='';updateDimensionLabelPosition();
}
function updateDimensionLabelPosition() {
  if(!dimensionLabel||dimensionLabel.hidden||!dimensionLabelPoint||!camera)return;
  const projected=dimensionLabelPoint.clone().project(camera);
  if(projected.z < -1 || projected.z > 1){dimensionLabel.style.visibility='hidden';if(dimensionTether?.svg)dimensionTether.svg.hidden=true;return;}
  const rect=E.workspace.getBoundingClientRect(),anchorX=(projected.x*0.5+0.5)*rect.width,anchorY=(-projected.y*0.5+0.5)*rect.height,x=anchorX+dimensionLabelOffset.x,y=anchorY+dimensionLabelOffset.y;
  dimensionLabel.style.visibility='visible';dimensionLabel.style.left=`${x}px`;dimensionLabel.style.top=`${y}px`;
  const tether=ensureDimensionTether(),moved=Math.hypot(dimensionLabelOffset.x,dimensionLabelOffset.y)>5;tether.svg.hidden=!moved;tether.svg.style.display=moved?'':'none';
  if(moved){tether.line.setAttribute('x1',String(anchorX));tether.line.setAttribute('y1',String(anchorY));tether.line.setAttribute('x2',String(x));tether.line.setAttribute('y2',String(y));}
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
  const selectedSourceEdges=new Set();
  for(const group of selectionHighlightMap.values())for(const object of (group.userData?.sourceObjects||[group.userData?.sourceObject].filter(Boolean)))selectedSourceEdges.add(object);
  visualEdges.forEach(object=>{object.visible=edgesVisible&&!object.userData?.logicalHidden&&!selectedSourceEdges.has(object);if(object.material===blackEdgeMaterial)object.material.visible=edgesVisible;});
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


// V8.17.7 — exact-size visual section caps from the actual triangulated solid.
//
// V8.17.6 used an infinite/oversized stencil plane.  Because Navo3D stores the
// displayed B-Rep skin as multiple face meshes, a stencil imbalance could make
// the entire helper plane visible.  Here we intersect the real displayed
// triangles with the clipping plane, weld the intersection segments into closed
// loops, detect holes by nesting, and triangulate only the true cross-section.
function clearSectionCaps(){
  if(!sectionCapRoot)return;scene?.remove(sectionCapRoot);
  sectionCapRoot.traverse(object=>{object.geometry?.dispose?.();if(object.material){for(const m of (Array.isArray(object.material)?object.material:[object.material]))m?.dispose?.();}});
  sectionCapRoot=null;sectionCapPlaneMesh=null;
}
function sectionPlaneBasis(normal){
  const n=normal.clone().normalize(),ref=Math.abs(n.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  const u=new THREE.Vector3().crossVectors(ref,n).normalize(),v=new THREE.Vector3().crossVectors(n,u).normalize();return{n,u,v};
}
function sectionPointKey(p,tol){return `${Math.round(p.x/tol)},${Math.round(p.y/tol)},${Math.round(p.z/tol)}`;}
function sectionTriangleSegment(a,b,c,plane,tol){
  const pts=[a,b,c],d=pts.map(p=>plane.distanceToPoint(p));
  if(d.every(x=>x>tol)||d.every(x=>x<-tol))return null;
  if(d.every(x=>Math.abs(x)<=tol))return null; // coplanar source face is not itself a section boundary
  const hits=[];
  // V8.18.2: every cap point is projected back onto the mathematical clipping
  // plane.  This prevents a vertex from a chamfer/angled end face that merely
  // falls inside the welding tolerance from pulling the visual cap onto that
  // angled face.
  const add=p=>{const snapped=plane.projectPoint(p,new THREE.Vector3());if(!hits.some(q=>q.distanceToSquared(snapped)<=tol*tol))hits.push(snapped);};
  for(let i=0;i<3;i++){
    const j=(i+1)%3,p=pts[i],q=pts[j],dp=d[i],dq=d[j];
    if(Math.abs(dp)<=tol)add(p);
    if((dp>tol&&dq<-tol)||(dp<-tol&&dq>tol))add(p.clone().lerp(q,dp/(dp-dq)));
  }
  if(hits.length<2)return null;
  let best=[hits[0],hits[1]],bestD=best[0].distanceToSquared(best[1]);
  for(let i=0;i<hits.length;i++)for(let j=i+1;j<hits.length;j++){const dd=hits[i].distanceToSquared(hits[j]);if(dd>bestD){best=[hits[i],hits[j]];bestD=dd;}}
  return bestD>tol*tol?best:null;
}
function sectionIntersectionSegments(){
  const tol=Math.max(modelSize*2e-6,1e-6),segments=[],dedupe=new Set(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const source of surfaceMeshes){
    if(!source?.isMesh||!source.geometry||source.userData?.flatPatternSelection)continue;
    source.updateWorldMatrix?.(true,false);const g=source.geometry,pos=g.getAttribute('position'),idx=g.index;
    if(!pos)continue;const triCount=idx?idx.count/3:pos.count/3;
    for(let t=0;t<triCount;t++){
      const ia=idx?idx.getX(t*3):t*3,ib=idx?idx.getX(t*3+1):t*3+1,ic=idx?idx.getX(t*3+2):t*3+2;
      a.fromBufferAttribute(pos,ia).applyMatrix4(source.matrixWorld);b.fromBufferAttribute(pos,ib).applyMatrix4(source.matrixWorld);c.fromBufferAttribute(pos,ic).applyMatrix4(source.matrixWorld);
      const seg=sectionTriangleSegment(a,b,c,clipPlane,tol);if(!seg)continue;
      // Defensive exact-plane snap after world transforms as well.  The cap is a
      // true section of the active clip plane, never a reuse of an angled end skin.
      const sa=clipPlane.projectPoint(seg[0],new THREE.Vector3()),sb=clipPlane.projectPoint(seg[1],new THREE.Vector3());
      const ka=sectionPointKey(sa,tol),kb=sectionPointKey(sb,tol),key=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;if(dedupe.has(key))continue;dedupe.add(key);segments.push({a:sa,b:sb,ka,kb});
    }
  }
  return{segments,tol};
}
function sectionLoopsFromSegments(segments,tol){
  const nodes=new Map(),edges=[];
  const node=(key,p)=>{if(!nodes.has(key))nodes.set(key,{key,p:p.clone(),edges:[]});return nodes.get(key);};
  for(const s of segments){const na=node(s.ka,s.a),nb=node(s.kb,s.b),ei=edges.length;edges.push({a:na,b:nb,used:false});na.edges.push(ei);nb.edges.push(ei);}
  const loops=[];
  for(let seed=0;seed<edges.length;seed++){
    if(edges[seed].used)continue;const e0=edges[seed];e0.used=true;let start=e0.a,prev=start,current=e0.b;const pts=[start.p.clone(),current.p.clone()];let guard=0;
    while(current!==start&&guard++<edges.length+8){
      const candidates=current.edges.filter(i=>!edges[i].used);if(!candidates.length)break;
      let chosen=candidates[0];
      if(candidates.length>1){
        const incoming=current.p.clone().sub(prev.p).normalize();let best=-Infinity;
        for(const i of candidates){const e=edges[i],next=e.a===current?e.b:e.a,dir=next.p.clone().sub(current.p).normalize(),score=incoming.dot(dir);if(score>best){best=score;chosen=i;}}
      }
      const e=edges[chosen];e.used=true;const next=e.a===current?e.b:e.a;prev=current;current=next;if(current!==start)pts.push(current.p.clone());
    }
    if(current===start&&pts.length>=3){
      const cleaned=[];for(const p of pts){if(!cleaned.length||cleaned.at(-1).distanceToSquared(p)>tol*tol)cleaned.push(p);}if(cleaned.length>=3)loops.push(cleaned);
    }
  }
  return loops;
}
function polygonArea2D(poly){let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=(poly[j].x*poly[i].y-poly[i].x*poly[j].y);return a/2;}
function pointInPoly2D(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j],hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y||1e-30)+a.x);if(hit)inside=!inside;}return inside;}
function buildSectionCaps(){
  clearSectionCaps();if(!clipEnabled||flatPatternActive||!currentModel||!surfaceMeshes.length)return;
  const {segments,tol}=sectionIntersectionSegments();if(!segments.length)return;const loops3=sectionLoopsFromSegments(segments,tol);if(!loops3.length)return;
  const basis=sectionPlaneBasis(clipPlane.normal),origin=new THREE.Vector3();clipPlane.coplanarPoint(origin);
  const loops=loops3.map(points3=>{
    const snapped=points3.map(p=>clipPlane.projectPoint(p,new THREE.Vector3()));
    return{points3:snapped,points2:snapped.map(p=>{const d=p.clone().sub(origin);return new THREE.Vector2(d.dot(basis.u),d.dot(basis.v));})};
  }).filter(l=>Math.abs(polygonArea2D(l.points2))>tol*tol);
  loops.sort((a,b)=>Math.abs(polygonArea2D(b.points2))-Math.abs(polygonArea2D(a.points2)));
  for(let i=0;i<loops.length;i++){let depth=0,parent=-1;for(let j=0;j<i;j++)if(pointInPoly2D(loops[i].points2[0],loops[j].points2)){depth++;if(parent<0)parent=j;}loops[i].depth=depth;loops[i].parent=parent;}
  const positions=[];
  for(let i=0;i<loops.length;i++){
    const outer=loops[i];if(outer.depth%2)continue;let contour=outer.points2.slice();if(polygonArea2D(contour)<0)contour.reverse();
    const holes=[];for(let j=0;j<loops.length;j++)if(loops[j].depth===outer.depth+1&&loops[j].parent===i){let h=loops[j].points2.slice();if(polygonArea2D(h)>0)h.reverse();holes.push(h);}
    const faces=THREE.ShapeUtils.triangulateShape(contour,holes),all=[...contour,...holes.flat()];
    for(const tri of faces)for(const vi of tri){
      const q=all[vi],p=origin.clone().addScaledVector(basis.u,q.x).addScaledVector(basis.v,q.y);
      clipPlane.projectPoint(p,p);positions.push(p.x,p.y,p.z);
    }
  }
  if(!positions.length)return;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  // Keep one mathematically exact normal for the whole section cap.  Computing
  // normals from triangulation can visually suggest an angled surface near a
  // sharp/sloped end even though the section points are coplanar.
  const normals=[];for(let i=0;i<positions.length/3;i++)normals.push(basis.n.x,basis.n.y,basis.n.z);
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  const material=new THREE.MeshStandardMaterial({color:0x93a0a5,metalness:0.04,roughness:0.68,side:THREE.DoubleSide,depthWrite:true,depthTest:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const cap=new THREE.Mesh(geometry,material);cap.name='NavoFlo exact section cap';cap.renderOrder=20;cap.userData.sectionCapPlane=true;
  const root=new THREE.Group();root.name='NavoFlo Solid Section Cap';root.add(cap);sectionCapRoot=root;sectionCapPlaneMesh=cap;scene.add(root);
}

function refreshCadEdgesAfterClipping(){
  // V8.18.2 — force CAD edge state back into sync with local clipping.
  //
  // Three.js recompiles line materials when clipping is added/removed. Because
  // Navo3D shares one black edge material across many exact B-Rep edge objects,
  // a clip toggle could leave the previous GPU program visible for one render
  // cycle (or until the user toggled Coupe again). Re-assert the visual state
  // immediately and once more on the next frame.
  const sync=()=>{
    blackEdgeMaterial.clippingPlanes=clipEnabled?[clipPlane]:null;
    blackEdgeMaterial.visible=edgesVisible;
    blackEdgeMaterial.needsUpdate=true;
    applyEdgesVisibility();
    for(const object of visualEdges){
      if(!object)continue;
      const materials=Array.isArray(object.material)?object.material:[object.material].filter(Boolean);
      materials.forEach(material=>{
        material.clippingPlanes=clipEnabled?[clipPlane]:null;
        material.visible=edgesVisible;
        material.needsUpdate=true;
      });
    }
  };
  sync();
  requestAnimationFrame(sync);
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
  // Assembly-tree blue highlight uses per-occurrence material clones. Keep
  // those clones synchronized with the section plane too.
  for(const mesh of surfaceMeshes){const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(m=>{if(!m)return;m.clippingPlanes=clipEnabled?[clipPlane]:null;m.needsUpdate=true;});}

  selectionRoot?.traverse?.(object=>{
    if(!object.material)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    materials.forEach(material=>{
      material.clippingPlanes=clipEnabled?[clipPlane]:null;
      material.needsUpdate=true;
    });
  });
  if(clipEnabled){buildSectionCaps();if(sectionCapRoot)sectionCapRoot.visible=!flatPatternActive;}
  else clearSectionCaps();
  refreshCadEdgesAfterClipping();
}

function modelBoundsViewExtents(center){
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).normalize(),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).normalize();
  const min=modelBounds.min,max=modelBounds.max,corners=[];
  for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z])corners.push(new THREE.Vector3(x,y,z));
  let halfW=0,halfH=0;for(const c of corners){const d=c.sub(center);halfW=Math.max(halfW,Math.abs(d.dot(right)));halfH=Math.max(halfH,Math.abs(d.dot(up)));}
  return{halfW:Math.max(halfW,1e-6),halfH:Math.max(halfH,1e-6)};
}
function fitCurrentView(){
  if(!modelBounds||!camera||!controls)return;
  const sphere=modelBounds.getBoundingSphere(new THREE.Sphere()),center=sphere.center.clone(),radius=Math.max(sphere.radius,0.001),forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  controls.target.copy(center);cadNav.pivot.copy(center);cadNav.wheelFocus.copy(center);
  if(camera.isOrthographicCamera){
    configureOrthographicFrustum(camera);const {halfW,halfH}=modelBoundsViewExtents(center),margin=1.12;
    camera.zoom=Math.max(1e-12,Math.min((camera.right-camera.left)/(2*halfW*margin),(camera.top-camera.bottom)/(2*halfH*margin)));
    camera.position.copy(center).addScaledVector(forward,-radius*4);camera.updateProjectionMatrix();
  }else{
    const distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov)/2)*1.12;camera.position.copy(center).addScaledVector(forward,-distance);
  }
  updateZoomClipping();updateDimensionLabelPosition();syncProjectionUI();
}
function fitCamera(view='iso') {
  if (!modelBounds) return;
  const standard=['front','back','left','right','top','bottom'].includes(view);
  if(standard&&cameraProjectionMode!=='orthographic')setProjectionMode('orthographic',{preserveScale:false});
  const center=modelBounds.getCenter(new THREE.Vector3()),radius=Math.max(modelBounds.getBoundingSphere(new THREE.Sphere()).radius,0.001);
  const dirs={iso:[1,.75,1],front:[0,0,1],back:[0,0,-1],right:[1,0,0],left:[-1,0,0],top:[0,1,0],bottom:[0,-1,0]},dir=new THREE.Vector3(...(dirs[view]||dirs.iso)).normalize();
  const up=(view==='top')?new THREE.Vector3(0,0,-1):(view==='bottom'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0));
  camera.position.copy(center).addScaledVector(dir,radius*4);camera.up.copy(up);camera.lookAt(center);camera.updateProjectionMatrix();
  fitCurrentView();
}



function profileConfidenceLabel(level){
  if(level==='high')return FR?'Élevée':'High';
  if(level==='probable')return FR?'Probable':'Probable';
  return FR?'À confirmer':'To confirm';
}
function ensureProfileStandardSection(){
  const drawer=E.propsDrawer,anchor=drawer?.querySelector?.('.drawer-stats');if(!drawer||!anchor)return null;
  let section=E.profileStandardSection||$('profile-standard-section');
  if(section&&$('profile-family')&&$('profile-total-weight'))return section;
  if(!section){section=document.createElement('div');section.id='profile-standard-section';section.className='drawer-section';section.hidden=true;anchor.after(section);}
  section.innerHTML=`<div class="drawer-section-title">${FR?'PROFILÉ STRUCTURAL':'STRUCTURAL PROFILE'}</div><dl class="drawer-stats compact-stats">
    <div><dt>${FR?'Standard / impérial':'Standard / imperial'}</dt><dd id="profile-aisc-label">—</dd></div>
    <div><dt>${FR?'Métrique':'Metric'}</dt><dd id="profile-metric-label">—</dd></div>
    <div><dt>${FR?'Famille':'Family'}</dt><dd id="profile-family">—</dd></div>
    <div><dt>${FR?'Dimensions':'Dimensions'}</dt><dd id="profile-dimensions">—</dd></div>
    <div><dt>${FR?'Épaisseur(s)':'Thickness(es)'}</dt><dd id="profile-thickness">—</dd></div>
    <div><dt>${FR?'Aire section':'Section area'}</dt><dd id="profile-area">—</dd></div>
    <div><dt>${FR?'Masse linéique':'Linear mass'}</dt><dd id="profile-weight">—</dd></div>
    <div><dt>${FR?'Longueur modèle':'Model length'}</dt><dd id="profile-length">—</dd></div>
    <div><dt>${FR?'Masse théorique':'Theoretical mass'}</dt><dd id="profile-total-weight">—</dd></div>
    <div><dt>${FR?'Concordance':'Match'}</dt><dd id="profile-confidence">—</dd></div>
  </dl><p id="profile-source" class="metadata-note">AISC Shapes Database v16.0 · LOCAL</p>`;
  E.profileStandardSection=section;
  E.profileAiscLabel=$('profile-aisc-label');E.profileMetricLabel=$('profile-metric-label');E.profileFamily=$('profile-family');E.profileDimensions=$('profile-dimensions');E.profileThickness=$('profile-thickness');E.profileArea=$('profile-area');E.profileWeight=$('profile-weight');E.profileLength=$('profile-length');E.profileTotalWeight=$('profile-total-weight');E.profileConfidence=$('profile-confidence');E.profileSource=$('profile-source');return section;
}
function profileUnit(){return displayUnit==='u'?'mm':displayUnit;}
function profileLengthMm(v){const n=Number(v);if(!Number.isFinite(n))return null;const u=profileUnit();return `${formatNumber(convertLength(n,'mm',u))} ${unitLabel(u)}`;}
function profileAreaMm2(v){const n=Number(v);if(!Number.isFinite(n))return null;const u=profileUnit(),f=unitScale('mm',u);return `${formatNumber(n*f*f)} ${unitLabel(u)}²`;}
function profileDimensionsText(m){
  const type=String(m?.type||''),len=profileLengthMm;
  if(['W','M','S','HP','C','MC','WT','MT','ST'].includes(type)&&Number.isFinite(m.dMm)&&Number.isFinite(m.bfMm))return `d ${len(m.dMm)} × bf ${len(m.bfMm)}`;
  if(type==='U'&&Number.isFinite(m.dMm)&&Number.isFinite(m.bfMm))return `${len(m.dMm)} × ${len(m.bfMm)}`;
  if(['L','2L'].includes(type)&&Number.isFinite(m.leg1Mm)&&Number.isFinite(m.leg2Mm))return `${len(m.leg1Mm)} × ${len(m.leg2Mm)}`;
  if(type==='HSS'){
    if(Number.isFinite(m.heightMm)&&Number.isFinite(m.widthMm))return `${len(m.heightMm)} × ${len(m.widthMm)}`;
    if(Number.isFinite(m.outerDiameterMm))return `Ø ${len(m.outerDiameterMm)}`;
  }
  if(type==='PIPE'&&Number.isFinite(m.outerDiameterMm))return `Ø ${len(m.outerDiameterMm)}`;
  const d=Array.isArray(m?.standardDimensionsMm)?m.standardDimensionsMm:[];return d.length>=2?`${len(d[0])} × ${len(d[1])}`:'—';
}
function profileThicknessText(m){
  const type=String(m?.type||''),len=profileLengthMm;
  if(['W','M','S','HP','C','MC','WT','MT','ST'].includes(type)){const a=Number.isFinite(m.twMm)?`tw ${len(m.twMm)}`:null,b=Number.isFinite(m.tfMm)?`tf ${len(m.tfMm)}`:null;return [a,b].filter(Boolean).join(' · ')||'—';}
  if(['L','2L','U'].includes(type)&&Number.isFinite(m.tMm))return `t ${len(m.tMm)}`;
  if(type==='HSS'||type==='PIPE'){const nom=Number.isFinite(m.tNomMm)?`tnom ${len(m.tNomMm)}`:null,des=Number.isFinite(m.tDesMm)?`tdes ${len(m.tDesMm)}`:null,t=Number.isFinite(m.tMm)?`t ${len(m.tMm)}`:null;return [nom,des,t].filter(Boolean).slice(0,2).join(' · ')||'—';}
  return '—';
}
function updateProfileStandardUI(){
  const section=ensureProfileStandardSection();if(!section)return;
  const active=Boolean(currentStepResult&&sheetMetalCapability.profile);section.hidden=!active;if(!active)return;
  const m=currentProfileMatch,fields=[E.profileAiscLabel,E.profileMetricLabel,E.profileFamily,E.profileDimensions,E.profileThickness,E.profileArea,E.profileWeight,E.profileLength,E.profileTotalWeight,E.profileConfidence];
  if(!m){fields.forEach(e=>{if(e)e.textContent='—';});if(E.profileAiscLabel)E.profileAiscLabel.textContent=FR?'Analyse locale…':'Local analysis…';if(E.profileSource)E.profileSource.textContent='AISC Shapes Database v16.0 · LOCAL';return;}
  if(E.profileAiscLabel)E.profileAiscLabel.textContent=m.imperialLabel||m.imperialEdi||'—';
  if(E.profileMetricLabel)E.profileMetricLabel.textContent=m.metricLabel||m.metricEdi||'—';
  if(E.profileFamily)E.profileFamily.textContent=m.type||'—';
  if(E.profileDimensions)E.profileDimensions.textContent=profileDimensionsText(m);
  if(E.profileThickness)E.profileThickness.textContent=profileThicknessText(m);
  if(E.profileArea)E.profileArea.textContent=profileAreaMm2(m.areaMm2)||'—';
  if(E.profileWeight){const kg=Number.isFinite(m.weightKgM)?`${m.weightKgM.toLocaleString(FR?'fr-CA':'en-CA',{maximumFractionDigits:2})} kg/m`:null,lb=Number.isFinite(m.weightLbFt)?`${m.weightLbFt.toLocaleString(FR?'fr-CA':'en-CA',{maximumFractionDigits:2})} ${FR?'lb/pi':'lb/ft'}`:null;E.profileWeight.textContent=[kg,lb].filter(Boolean).join(' · ')||'—';}
  if(E.profileLength)E.profileLength.textContent=profileLengthMm(m.profileLengthMm)||'—';
  if(E.profileTotalWeight){const mass=Number.isFinite(m.weightKgM)&&Number.isFinite(m.profileLengthMm)?m.weightKgM*m.profileLengthMm/1000:null;E.profileTotalWeight.textContent=Number.isFinite(mass)?`${mass.toLocaleString(FR?'fr-CA':'en-CA',{maximumFractionDigits:2})} kg · ${(mass*2.2046226218).toLocaleString(FR?'fr-CA':'en-CA',{maximumFractionDigits:2})} lb`:'—';}
  if(E.profileConfidence)E.profileConfidence.textContent=`${profileConfidenceLabel(m.level)} · ${Math.round((Number(m.confidence)||0)*100)} %`;
  if(E.profileSource)E.profileSource.textContent=`${m.sourceVersion||'AISC Shapes Database v16.0'} · LOCAL`;
}
async function resolveProfileStandardMatch(profile){
  const epoch=++profileMatchEpoch;currentProfileMatch=null;updateProfileStandardUI();
  if(!profile)return;
  try{
    const match=await matchAiscProfile(profile);
    if(epoch!==profileMatchEpoch||!sheetMetalCapability.profile||sheetMetalCapability.profileData!==profile)return;
    currentProfileMatch=match||null;updateProfileStandardUI();updateGeometryTypeIndicator();captureActiveModelDocumentState();
  }catch(error){
    if(epoch!==profileMatchEpoch)return;
    console.warn('[NavoFlo AISC profile matcher]',error);currentProfileMatch=null;updateProfileStandardUI();
  }
}
function clearProfileStandardMatch(){currentProfileMatch=null;profileMatchEpoch++;updateProfileStandardUI();}


function manufacturingLabel(c){
  if(!c)return '—';const len=profileLengthMm;
  if(c.stockType==='round-bar')return `${FR?'Barre ronde':'Round bar'} · Ø ${len(c.diameterMm)}`;
  if(c.stockType==='square-bar')return `${FR?'Barre carrée':'Square bar'} · ${len(c.widthMm)} × ${len(c.thicknessMm)}`;
  if(c.stockType==='flat-bar')return `${FR?'Barre plate':'Flat bar'} · ${len(c.widthMm)} × ${len(c.thicknessMm)}`;
  if(c.stockType==='plate-blank')return `${FR?'Plaque brute':'Plate blank'} · ${len(c.lengthMm)} × ${len(c.widthMm)} × ${len(c.thicknessMm)}`;
  if(c.stockType==='rolled-plate')return `${FR?'Plaque roulée':'Rolled plate'} · T ${len(c.thicknessMm)} · Ø ${FR?'ext.':'OD'} ${len(c.outerDiameterMm)}`;
  if(c.stockType==='hex-bar')return `${FR?'Barre hexagonale':'Hex bar'} · ${FR?'sur plats':'across flats'} ${len(c.acrossFlatsMm)}`;
  if(c.stockType==='rectangular-bar')return `${FR?'Barre rectangulaire':'Rectangular bar'} · ${len(c.widthMm)} × ${len(c.thicknessMm)}`;
  return FR?'Brut prismatique':'Prismatic stock';
}
function manufacturingLabelForCurrentContext(c){
  const cutPlate=Boolean(sheetMetalCapability?.flatPlate);
  if(cutPlate&&c?.stockType==='round-bar'&&Number(c?.aspect)<0.45){
    return `${FR?'Plaque ronde brute':'Round plate blank'} · Ø ${profileLengthMm(c.diameterMm)} × ${profileLengthMm(c.lengthMm)}`;
  }
  if(c?.stockType==='round-bar'&&c?.processes?.turning&&Number(c?.aspect)>=0.45){
    return `${FR?'Shaft / barre ronde':'Shaft / round bar'} · Ø ${profileLengthMm(c.diameterMm)}`;
  }
  return manufacturingLabel(c);
}
function manufacturingEvidenceText(c){const map=FR?{turning:'tournage',drilling:'perçage/alésage',chamfering:'chanfreins',fillets:'rayons/fillets',groove:'rainure / rayon','blind-hole':'trou borgne / alésage',counterbore:'lamage',recess:'alésage / lamage / trou borgne',pocket:'poche','through-hole':'trou traversant','material-removal':'enlèvement de matière','commercial-stock-plate':'dimensions de plaque / hors flat bar'}:{turning:'turning',drilling:'drilling/boring',chamfering:'chamfers',fillets:'fillets',groove:'groove / fillet','blind-hole':'blind hole / bore',counterbore:'counterbore',recess:'bore / counterbore / blind feature',pocket:'pocket','through-hole':'through hole','material-removal':'material removal','commercial-stock-plate':'plate dimensions / beyond flat-bar range'};return (c?.evidence||[]).map(x=>map[x]||x).join(' · ')||'—';}
function manufacturingFeatureText(c){
  const labels=FR?{
    'turned-step':'diamètre tourné','turned-groove':'gorge tournée','turned-groove-fillet':'gorge/rayon tourné','turned-chamfer-taper':'chanfrein/conicité tournée','turned-shoulder':'épaulement tourné',
    'axial-bore':'alésage axial','blind-axial-bore':'alésage axial borgne','blind-hole':'trou borgne','through-hole':'trou traversant','through-slot':'fente traversante','through-profile':'profil traversant','through-passage':'passage traversant','cross-hole':'perçage transversal','offset-bore':'alésage décentré',
    'counterbore':'lamage','countersink':'fraisure','annular-groove':'rainure annulaire','groove-fillet':'rainure/rayon','pocket-floor':'poche','countersink-chamfer':'fraisure/chanfrein','edge-chamfer':'chanfrein usiné','one-sided-recess':'usinage sur une face / poche'
  }:{
    'turned-step':'turned diameter','turned-groove':'turned groove','turned-groove-fillet':'turned groove/fillet','turned-chamfer-taper':'turned chamfer/taper','turned-shoulder':'turned shoulder',
    'axial-bore':'axial bore','blind-axial-bore':'blind axial bore','blind-hole':'blind hole','through-hole':'through hole','through-slot':'through slot','through-profile':'through profile','through-passage':'through passage','cross-hole':'cross drilling','offset-bore':'offset bore',
    'counterbore':'counterbore','countersink':'countersink','annular-groove':'annular groove','groove-fillet':'groove/fillet','pocket-floor':'pocket','countersink-chamfer':'countersink/chamfer','edge-chamfer':'machined chamfer','one-sided-recess':'one-sided recess / pocket'
  };
  const counts=new Map();for(const f of c?.featureInstances||[]){const key=labels[f.type]||f.type;counts.set(key,(counts.get(key)||0)+1);}return [...counts].map(([k,n])=>n>1?`${k} ×${n}`:k).join(' · ')||'—';
}
function ensureManufacturingSection(){
  const drawer=E.propsDrawer,anchor=drawer?.querySelector?.('.drawer-stats');if(!drawer||!anchor)return null;let section=$('manufacturing-section');if(!section){section=document.createElement('div');section.id='manufacturing-section';section.className='drawer-section';anchor.after(section);}
  if(!$('manufacturing-process'))section.innerHTML=`<div class="drawer-section-title">${FR?'FABRICATION DÉTECTÉE':'DETECTED MANUFACTURING'}</div><dl class="drawer-stats compact-stats"><div><dt>${FR?'Procédé probable':'Probable process'}</dt><dd id="manufacturing-process">—</dd></div><div><dt>${FR?'Brut probable':'Probable stock'}</dt><dd id="manufacturing-stock">—</dd></div><div><dt>${FR?'Longueur brut':'Stock length'}</dt><dd id="manufacturing-length">—</dd></div><div><dt>${FR?'Matière enlevée':'Material removed'}</dt><dd id="manufacturing-removal">—</dd></div><div><dt>${FR?'Features reconnues':'Recognized features'}</dt><dd id="manufacturing-features">—</dd></div><div><dt>${FR?'Indices géométriques':'Geometry evidence'}</dt><dd id="manufacturing-evidence">—</dd></div><div><dt>${FR?'Confiance':'Confidence'}</dt><dd id="manufacturing-confidence">—</dd></div></dl><p class="metadata-note">${FR?'MRE V8.20.3 · B-Rep/AAG + arbitrage critique + ML optionnel':'MRE V8.20.3 · B-Rep/AAG + critical arbitration + optional ML'}</p>`;
  return section;
}
function updateManufacturingUI(){
  const section=ensureManufacturingSection();if(!section)return;const c=manufacturingCapability;
  section.hidden=!c||Boolean(sheetMetalCapability?.profile)||Boolean(sheetMetalCapability?.bendCount>0);if(section.hidden||!c)return;
  const process=$('manufacturing-process'),stock=$('manufacturing-stock'),length=$('manufacturing-length'),rem=$('manufacturing-removal'),features=$('manufacturing-features'),evidence=$('manufacturing-evidence'),conf=$('manufacturing-confidence');
  const directDxf=Boolean(c?.capabilities?.directFlatDxf||sheetMetalCapability?.flatPlate),plateMachining=directDxf&&Boolean(c?.processes?.machining||manufacturingHasPlateSecondaryMachining(c));
  let processText;
  if(c?.stockType==='rolled-plate'||sheetMetalCapability?.rolledPlate)processText=c?.processes?.drilling?(FR?'Roulage + perçage':'Rolling + drilling'):(FR?'Roulage de plaque':'Plate rolling');
  else if(directDxf)processText=plateMachining?(FR?'Découpe de plaque + usinage':'Plate cutting + machining'):(FR?'Découpe de plaque':'Plate cutting');
  else if(c?.processes?.turning)processText=c?.processes?.drilling?(FR?'Tournage + perçage/alésage':'Turning + drilling/boring'):(FR?'Tournage / usinage':'Turning / machining');
  else if(c?.processes?.machining||c.machined)processText=FR?'Usinage probable':'Probable machining';
  else processText=FR?'Profilé / brut standard':'Stock profile';
  if(process)process.textContent=processText;
  if(stock)stock.textContent=manufacturingLabelForCurrentContext(c);
  if(length)length.textContent=profileLengthMm(c.lengthMm)||'—';
  if(rem)rem.textContent=Number.isFinite(c.materialRemoval)?`${(c.materialRemoval*100).toLocaleString(FR?'fr-CA':'en-CA',{maximumFractionDigits:1})} %`:'—';
  if(features)features.textContent=manufacturingFeatureText(c);
  if(evidence)evidence.textContent=manufacturingEvidenceText(c);
  if(conf)conf.textContent=`${Math.round((Number(c.confidence)||0)*100)} %`;
}


function updateSheetMetalDimensionsUI(){
  const row=E.propSheetDimensionsRow,label=E.propSheetDimensionsLabel,value=E.propSheetDimensions;if(!row||!label||!value)return;
  if(sheetMetalCapability?.rolledPlate&&sheetMetalCapability?.rolledPlateData){
    const r=sheetMetalCapability.rolledPlateData,t=Number(r.thicknessMm),h=Number(r.axialLengthMm),w=Number(r.developedLengthMm);
    if(t>0&&h>0&&w>0){label.textContent=FR?'Dimensions développées (T × H × L)':'Developed dimensions (T × H × W)';value.textContent=`${formatLength(t)} × ${formatLength(h)} × ${formatLength(w)}`;row.hidden=false;return;}
  }
  const result=flatPatternResult,b=result?.bounds,t=Number(result?.thickness);
  const recognized=Boolean(sheetMetalCapability?.recognized&&result?.ok),h=Number(b?.height),w=Number(b?.width);
  if(!recognized||!(t>0)||!(h>0)||!(w>0)){row.hidden=true;value.textContent='—';return;}
  const bent=(Number(sheetMetalCapability?.bendCount)||0)>0;
  label.textContent=bent?(FR?'Dimensions dépliées (T × H × L)':'Flat dimensions (T × H × W)'):(FR?'Dimensions (T × H × L)':'Dimensions (T × H × W)');
  // The fixed-face basis can exchange its two in-plane axes between files. Keep
  // the manufacturing dimensional stable: smaller developed side = H, larger = L/W.
  const height=Math.min(h,w),width=Math.max(h,w);
  value.textContent=`${formatLength(t)} × ${formatLength(height)} × ${formatLength(width)}`;
  row.hidden=false;
}


function updateGeometryTypeIndicator(){
  if(!E.propType)return;
  if(!currentStepResult){E.propType.textContent=currentModel?(FR?'Maillage':'Mesh'):'—';return;}
  if(currentAssemblyMode){E.propType.textContent=currentAssemblyFocus?ASMT.subassembly:ASMT.assembly;return;}
  if(sheetMetalCapability.rolledPlate){const drilled=Boolean(manufacturingCapability?.processes?.drilling);E.propType.textContent=drilled?(FR?'Plaque roulée · perçage':'Rolled plate · drilling'):(FR?'Plaque roulée':'Rolled plate');return;}
  if(sheetMetalCapability.profile){
    const match=currentProfileMatch,label=match&&(match.level==='high'||match.level==='probable')?(match.imperialLabel||match.metricLabel):null;
    if(label){const prefix=match?.sourceKind==='geometry'?(FR?'Profilé':'Profile'):(FR?'Profilé AISC':'AISC profile');E.propType.textContent=`${prefix} · ${label}`;return;}
    const aspect=Number(sheetMetalCapability.profileData?.aspect),suffix=Number.isFinite(aspect)?` · L/C ${aspect.toFixed(1)}`:'';
    E.propType.textContent=(FR?'Profilé / extrusion':'Profile / extrusion')+suffix;return;
  }
  if(sheetMetalCapability.recognized&&sheetMetalCapability.bendCount>0){E.propType.textContent=FR?'Tôle pliée':'Sheet metal';return;}
  if(sheetMetalCapability.recognized&&sheetMetalCapability.flatPlate){
    if(manufacturingCapability?.stockType==='flat-bar'&&!manufacturingCapability.machined){E.propType.textContent=`${FR?'Profilé probable':'Probable profile'} · ${manufacturingLabel(manufacturingCapability)}`;return;}
    const plateMachining=manufacturingHasPlateSecondaryMachining(manufacturingCapability);
    if(sheetMetalCapability.cuttablePlate||manufacturingCapability?.stockType==='plate-blank'||(manufacturingCapability?.stockType==='round-bar'&&Number(manufacturingCapability?.aspect)<0.45)){
      E.propType.textContent=plateMachining?(FR?'Plaque à découper · usinage':'Cut plate · machining'):(FR?'Plaque à découper':'Cut plate');return;
    }
    E.propType.textContent=plateMachining?(FR?'Plaque plane · usinage':'Flat plate · machining'):(FR?'Plaque plane':'Flat plate');return;
  }
  if(manufacturingCapability&&manufacturingCapability.machined){E.propType.textContent=`${FR?'Pièce usinée':'Machined part'} · ${manufacturingLabelForCurrentContext(manufacturingCapability)}`;return;}
  if(manufacturingCapability){
    if(manufacturingCapability.stockType==='plate-blank'){E.propType.textContent=FR?'Plaque brute':'Plate blank';return;}
    E.propType.textContent=`${FR?'Profilé':'Profile'} · ${manufacturingLabel(manufacturingCapability)}`;return;
  }
  E.propType.textContent=FR?'Solide STEP':'STEP solid';
}

function fillProperties() {
  E.propFile.textContent=currentAssemblyFocus?.name||currentFile?.name||'—';
  E.propFormat.textContent=currentFormat||'—';
  updateGeometryTypeIndicator();
  updateProfileStandardUI();
  updateManufacturingUI();
  E.propUnits.textContent=unitLabel(displayUnit);
  E.propParts.textContent=String(currentStats?.partCount??1);
  E.propGeometries.textContent=String(currentStats?.geometryCount??surfaceMeshes.length);
  E.propTriangles.textContent=formatInteger(currentStats?.triangleCount??0);

  if (currentStepResult) {
    E.stepMeta.hidden=false;
    E.sheetMetalSection.hidden=!sheetMetalCapability.recognized;
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
  // V8.20.4: hierarchy lives in the viewport. Keep the legacy drawer node only
  // as a compatibility anchor for older CSS/DOM references.
  renderAssemblyTree();
  if(E.stepTree){E.stepTree.replaceChildren();E.stepTree.textContent='—';}
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
  closeAssemblyContextMenu();
  clearAssemblyTreeSelection({rerender:false});
  clearSelections();
  clearMultiMeasurements();
  clearPreselection();
  clearFlatPattern();
  clearSectionCaps();
  if (currentStepResult && worker) {
    try {await workerRequest('release');} catch {}
  }

  for (const child of [...modelRoot.children]) {
    modelRoot.remove(child);disposeObject(child);
  }
  modelRoot.position.set(0,0,0);
  surfaceMeshes=[];edgeObjects=[];vertexObjects=[];visualEdges=[];baseMaterials=new Set();logicalFaceGroupCache=new Map();logicalEdgeGroupCache=new Map();logicalHiddenEdgeKeys.clear();
  currentModel=null;currentFile=null;currentFormat='';currentUnit='u';displayUnit='u';currentStats=null;currentStepHeader=null;currentStepResult=null;currentStepProperties=[];manufacturingCapability=null;
  currentAssemblyFocus=null;currentAssemblyMode=false;currentAssemblyHierarchyAvailable=false;currentHierarchyRootSpecs=[];currentActiveGeometryIds=new Set();assemblyTreeRecords=new Map();assemblyOccurrenceRecords=[];assemblyExpandedKeys.clear();assemblySelectedKey=null;assemblyContextKey=null;
  resetSheetMetalForModel();
  modelBounds=null;modelSize=1;clipEnabled=false;edgesVisible=navo3dPreferences.edgesVisible;blackEdgeMaterial.visible=edgesVisible;measureEnabled=false;multiMeasureEnabled=false;
  cadNav.active=false;cadNav.pointerId=null;cadNav.button=-1;cadNav.mode=null;
  cadNav.pivot.set(0,0,0);cadNav.wheelFocus.set(0,0,0);updateCadCursor();
  E.section.classList.remove('active');E.sectionPanel.hidden=true;E.edges.classList.toggle('active',edgesVisible);E.gridToggle.classList.toggle('active',navo3dPreferences.gridVisible);E.measure.classList.remove('active');E.multiMeasure?.classList.remove('active');E.multiMeasure?.setAttribute('aria-pressed','false');
  E.measureCard.hidden=true;E.propsDrawer.hidden=true;E.workspace.classList.remove('properties-open');E.stepMeta.hidden=true;E.sheetMetalSection.hidden=true;E.empty.classList.remove('hidden');
  if(E.assemblyTreePanel)E.assemblyTreePanel.hidden=true;if(E.assemblyTreeList)E.assemblyTreeList.replaceChildren();setAssemblyTreeStatus('');setAssemblyBatchBusy(false);
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
  [E.clear,E.save,E.saveAs,E.fit,E.edges,E.gridToggle,E.unitSelect,E.measure,E.multiMeasure,E.section,E.viewButton,E.props].filter(Boolean).forEach(el=>el.disabled=!on);
  if(E.save)E.save.disabled=!on||Boolean(currentAssemblyFocus);if(E.saveAs)E.saveAs.disabled=!on||Boolean(currentAssemblyFocus);
  document.querySelectorAll('[data-select-mode]').forEach(el=>el.disabled=!on);
  E.measureType.disabled=!on||!measureEnabled;
  E.sheetMetal.disabled=!on||!currentStepResult||!sheetMetalCapability.recognized||sheetMetalCapability.bendCount<=0;
  E.sheetMetal.hidden=!on||!sheetMetalCapability.recognized||sheetMetalCapability.bendCount<=0;
  if(E.smSetFixedFace)E.smSetFixedFace.disabled=!on||!currentStepResult;
  if(E.smUnfold)E.smUnfold.disabled=!on||!currentStepResult;
  syncSheetMetalUnfoldUI();
}
function busy(on,label=T.loading,sub='') {
  E.loading.hidden=!on;E.loadingLabel.textContent=label;E.loadingSub.textContent=sub||'';
}
function showError(message) {
  E.statusFile.textContent=message;
  E.empty.classList.remove('hidden');
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
  updateSheetMetalDimensionsUI();
  if(currentStepResult)syncSheetMetalInputs();
  updateProfileStandardUI();
  updateManufacturingUI();
}

async function refreshMeasurementUnits() {
  if(!measureEnabled)return;

  if(flatPatternActive){
    if(selected.length===1)showFlatSingleMeasurement(selected[0]);else if(selected.length===2)showFlatPairMeasurement(selected[0],selected[1]);
    return;
  }

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
