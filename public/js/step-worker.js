import OcctJS from 'https://cdn.jsdelivr.net/gh/tx-code/occt-js@ad8ffb6007eb3fd25179232f291b626d6e78a195/dist/occt-js.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/gh/tx-code/occt-js@ad8ffb6007eb3fd25179232f291b626d6e78a195/dist/occt-js.wasm';
const ENGINE_REV = 'occt-js 0.1.14-dev @ ad8ffb6';

let occtPromise = null;
let exactModelId = null;
let bindingByGeometry = new Map();
let topologyByGeometry = new Map();
let logicalFaceGroupCache = new Map();
let logicalEdgeGroupCache = new Map();

function getOcct() {
  if (!occtPromise) {
    occtPromise = OcctJS({
      locateFile(filename) {
        if (filename === 'occt-js.wasm') return WASM_URL;
        return filename;
      }
    });
  }
  return occtPromise;
}

function releaseCurrent(occt) {
  if (exactModelId != null) {
    try { occt.ReleaseExactModel(exactModelId); } catch {}
  }
  exactModelId = null;
  bindingByGeometry = new Map();
  topologyByGeometry = new Map();
  logicalFaceGroupCache = new Map();
  logicalEdgeGroupCache = new Map();
}

function plainNode(node) {
  return {
    id: String(node?.id ?? ''),
    name: String(node?.name ?? ''),
    isAssembly: Boolean(node?.isAssembly),
    transform: Array.from(node?.transform ?? []),
    meshes: Array.from(node?.meshes ?? []),
    children: Array.from(node?.children ?? []).map(plainNode)
  };
}

function plainColor(c) {
  if (!c) return null;
  return { r: Number(c.r ?? 0.9), g: Number(c.g ?? 0.91), b: Number(c.b ?? 0.93), opacity: Number(c.opacity ?? 1) };
}

function plainGeometry(g) {
  return {
    id: String(g.id ?? ''),
    name: String(g.name ?? ''),
    color: plainColor(g.color),
    positions: new Float32Array(g.positions ?? []),
    normals: new Float32Array(g.normals ?? []),
    indices: new Uint32Array(g.indices ?? []),
    triangleToFaceMap: new Int32Array(g.triangleToFaceMap ?? []),
    faces: Array.from(g.faces ?? []).map(f => ({
      id: Number(f.id),
      name: String(f.name ?? ''),
      firstIndex: Number(f.firstIndex ?? 0),
      indexCount: Number(f.indexCount ?? 0),
      edgeIndices: Array.from(f.edgeIndices ?? []).map(Number),
      color: plainColor(f.color)
    })),
    edges: Array.from(g.edges ?? []).map(e => ({
      id: Number(e.id),
      name: String(e.name ?? ''),
      points: new Float32Array(e.points ?? []),
      ownerFaceIds: Array.from(e.ownerFaceIds ?? []).map(Number),
      isFreeEdge: Boolean(e.isFreeEdge),
      color: plainColor(e.color)
    })),
    vertices: Array.from(g.vertices ?? []).map(v => ({
      id: Number(v.id),
      position: Array.from(v.position ?? [0,0,0]).map(Number)
    }))
  };
}

function transferListFor(result) {
  const list = [];
  for (const g of result.geometries ?? []) {
    for (const arr of [g.positions, g.normals, g.indices, g.triangleToFaceMap]) {
      if (arr?.buffer) list.push(arr.buffer);
    }
    for (const e of g.edges ?? []) {
      if (e.points?.buffer) list.push(e.points.buffer);
    }
  }
  return list;
}


function faceIdsForSelection(selection) {
  const ids=Array.isArray(selection?.elementIds)&&selection.elementIds.length
    ? selection.elementIds.map(Number).filter(Number.isFinite)
    : [Number(selection?.elementId)].filter(Number.isFinite);
  return [...new Set(ids)];
}

function isCylinderFamily(info){
  return ['cylinder','cylindrical'].includes(String(info?.family||'').toLowerCase());
}
function vec3(v){return Array.isArray(v)&&v.length>=3?v.map(Number).slice(0,3):null;}
function sameCylinder(a,b){
  if(!isCylinderFamily(a)||!isCylinderFamily(b))return false;
  const ra=Number(a.radius),rb=Number(b.radius);
  const aa=vec3(a.axisDirection),ab=vec3(b.axisDirection),ca=vec3(a.localCenter),cb=vec3(b.localCenter);
  if(!Number.isFinite(ra)||!Number.isFinite(rb)||!aa||!ab||!ca||!cb)return false;
  const tol=Math.max(Math.abs(ra),Math.abs(rb),1)*1e-5;
  if(Math.abs(ra-rb)>tol)return false;
  const la=Math.hypot(...aa),lb=Math.hypot(...ab);if(la<1e-12||lb<1e-12)return false;
  const ua=aa.map(x=>x/la),ub=ab.map(x=>x/lb);
  const dot=Math.abs(ua[0]*ub[0]+ua[1]*ub[1]+ua[2]*ub[2]);if(dot<0.99999)return false;
  const d=[cb[0]-ca[0],cb[1]-ca[1],cb[2]-ca[2]];
  const proj=d[0]*ua[0]+d[1]*ua[1]+d[2]*ua[2];
  const perp=Math.hypot(d[0]-proj*ua[0],d[1]-proj*ua[1],d[2]-proj*ua[2]);
  return perp<=tol*2;
}
function exactGeometrySignature(occt,selection){
  const r=exactRef(selection),out={family:'other'};
  const type=occt.GetExactGeometryType(r.exactModelId,r.exactShapeHandle,r.kind,r.elementId);if(type?.ok)out.family=type.family;
  const family=String(out.family||'').toLowerCase();
  if(!['circle','circular','cylinder','cylindrical'].includes(family))return out;
  const radius=occt.MeasureExactRadius(r.exactModelId,r.exactShapeHandle,r.kind,r.elementId);
  if(radius?.ok){out.radius=radius.radius;out.localCenter=radius.localCenter;out.axisDirection=radius.localAxisDirection;}
  else{const center=occt.MeasureExactCenter(r.exactModelId,r.exactShapeHandle,r.kind,r.elementId);if(center?.ok){out.localCenter=center.localCenter;out.axisDirection=center.localAxisDirection;}}
  return out;
}
function logicalFaceGroup(occt,selection){
  const gid=String(selection.geometryId),fid=Number(selection.elementId),cacheKey=`${gid}:${fid}`;
  if(logicalFaceGroupCache.has(cacheKey))return logicalFaceGroupCache.get(cacheKey);
  const topo=topologyByGeometry.get(gid);
  if(!topo){const out=[fid];logicalFaceGroupCache.set(cacheKey,out);return out;}
  const base=exactGeometrySignature(occt,{...selection,kind:'face',elementId:fid,elementIds:undefined});
  if(!isCylinderFamily(base)){const out=[fid];logicalFaceGroupCache.set(cacheKey,out);return out;}
  const edgeToFaces=new Map();
  for(const face of topo.faces){for(const edge of face.edgeIndices||[]){const k=Number(edge);if(!edgeToFaces.has(k))edgeToFaces.set(k,[]);edgeToFaces.get(k).push(Number(face.id));}}
  const byId=new Map(topo.faces.map(f=>[Number(f.id),f]));
  const group=new Set([fid]),queue=[fid];
  while(queue.length){
    const id=queue.shift(),face=byId.get(id);if(!face)continue;
    const neighbors=new Set();for(const edge of face.edgeIndices||[])for(const n of edgeToFaces.get(Number(edge))||[])if(n!==id)neighbors.add(n);
    for(const n of neighbors){if(group.has(n))continue;
      const info=exactGeometrySignature(occt,{...selection,kind:'face',elementId:n,elementIds:undefined});
      if(sameCylinder(base,info)){group.add(n);queue.push(n);}
    }
  }
  const out=[...group].sort((a,b)=>a-b);for(const id of out)logicalFaceGroupCache.set(`${gid}:${id}`,out);return out;
}

function isCircleFamily(info){return ['circle','circular'].includes(String(info?.family||'').toLowerCase());}
function sameCircle(a,b){
  if(!isCircleFamily(a)||!isCircleFamily(b))return false;
  const ra=Number(a.radius),rb=Number(b.radius),ca=vec3(a.localCenter),cb=vec3(b.localCenter),aa=vec3(a.axisDirection),ab=vec3(b.axisDirection);
  if(!Number.isFinite(ra)||!Number.isFinite(rb)||!ca||!cb||!aa||!ab)return false;
  const tol=Math.max(Math.abs(ra),Math.abs(rb),1)*1e-5;if(Math.abs(ra-rb)>tol)return false;
  if(Math.hypot(ca[0]-cb[0],ca[1]-cb[1],ca[2]-cb[2])>tol*2)return false;
  const la=Math.hypot(...aa),lb=Math.hypot(...ab);if(la<1e-12||lb<1e-12)return false;
  return Math.abs((aa[0]*ab[0]+aa[1]*ab[1]+aa[2]*ab[2])/(la*lb))>=0.99999;
}
function logicalEdgeGroup(occt,selection){
  const gid=String(selection.geometryId),eid=Number(selection.elementId),cacheKey=`${gid}:${eid}`;
  if(logicalEdgeGroupCache.has(cacheKey))return logicalEdgeGroupCache.get(cacheKey);
  const topo=topologyByGeometry.get(gid),base=exactGeometrySignature(occt,{...selection,kind:'edge',elementId:eid,elementIds:undefined});
  if(!topo||!isCircleFamily(base)){const out=[eid];logicalEdgeGroupCache.set(cacheKey,out);return out;}
  const group=[];for(const edge of topo.edges||[]){const id=Number(edge.id);const info=exactGeometrySignature(occt,{...selection,kind:'edge',elementId:id,elementIds:undefined});if(sameCircle(base,info))group.push(id);}
  const out=[...new Set(group.length?group:[eid])].sort((a,b)=>a-b);for(const id of out)logicalEdgeGroupCache.set(`${gid}:${id}`,out);return out;
}
function allLogicalFaceGroups(occt){
  const groups=[];
  for(const [geometryId,topo] of topologyByGeometry){
    const seen=new Set();
    for(const face of topo.faces||[]){
      const fid=Number(face.id);if(seen.has(fid))continue;
      const faceIds=logicalFaceGroup(occt,{geometryId,elementId:fid,kind:'face'});for(const id of faceIds)seen.add(id);
      if(faceIds.length<2)continue;
      const faceSet=new Set(faceIds),seamEdgeIds=[];
      for(const edge of topo.edges||[]){const owners=(edge.ownerFaceIds||[]).filter(id=>faceSet.has(Number(id)));if(owners.length>=2)seamEdgeIds.push(Number(edge.id));}
      groups.push({geometryId,faceIds,seamEdgeIds:[...new Set(seamEdgeIds)]});
    }
  }
  return groups;
}

function sheetMetalFaceInfo(occt,geometryId){
  const gid=String(geometryId),topo=topologyByGeometry.get(gid);
  if(!topo)throw new Error(`No STEP topology for geometry ${gid}.`);
  const faces=[];
  for(const face of topo.faces||[]){
    const id=Number(face.id),selection={geometryId:gid,kind:'face',elementId:id},sig=exactGeometrySignature(occt,selection);
    const out={id,family:String(sig?.family||'other')};
    if(Number.isFinite(Number(sig?.radius)))out.radius=Number(sig.radius);
    const center=Array.isArray(sig?.localCenter)?sig.localCenter.map(Number).slice(0,3):null;
    const axis=Array.isArray(sig?.axisDirection)?sig.axisDirection.map(Number).slice(0,3):null;
    if(center?.length===3)out.localCenter=center;
    if(axis?.length===3)out.axisDirection=axis;
    const area=occt.MeasureExactFaceArea(exactModelId,shapeHandle(gid),'face',id);
    if(area?.ok&&Number.isFinite(Number(area.value))){
      out.area=Number(area.value);
      const centroid=Array.isArray(area.localCentroid)?area.localCentroid.map(Number).slice(0,3):null;
      if(centroid?.length===3&&centroid.every(Number.isFinite)){
        out.localCentroid=centroid;
        // Tessellation normals are adequate for display, but unfolding must use the
        // exact B-Rep plane normal. Evaluate it at the exact face centroid so STEP
        // meshing/triangle winding cannot turn a valid bend into a false 0°/no-bend.
        if(String(out.family).toLowerCase()==='plane'){
          const normal=occt.EvaluateExactFaceNormal(exactModelId,shapeHandle(gid),'face',id,centroid);
          const n=Array.isArray(normal?.localNormal)?normal.localNormal.map(Number).slice(0,3):null;
          if(normal?.ok&&n?.length===3&&n.every(Number.isFinite))out.localNormal=n;
        }
      }
    }
    faces.push(out);
  }
  const edges=[];
  for(const edge of topo.edges||[]){
    const id=Number(edge.id),selection={geometryId:gid,kind:'edge',elementId:id},sig=exactGeometrySignature(occt,selection);
    const out={id,family:String(sig?.family||'other')};
    if(Number.isFinite(Number(sig?.radius)))out.radius=Number(sig.radius);
    const center=Array.isArray(sig?.localCenter)?sig.localCenter.map(Number).slice(0,3):null;
    const axis=Array.isArray(sig?.axisDirection)?sig.axisDirection.map(Number).slice(0,3):null;
    if(center?.length===3)out.localCenter=center;
    if(axis?.length===3)out.axisDirection=axis;
    const length=occt.MeasureExactEdgeLength(exactModelId,shapeHandle(gid),'edge',id);
    if(length?.ok&&Number.isFinite(Number(length.value))){
      out.length=Number(length.value);
      const a=Array.isArray(length.localStartPoint)?length.localStartPoint.map(Number).slice(0,3):null;
      const b=Array.isArray(length.localEndPoint)?length.localEndPoint.map(Number).slice(0,3):null;
      if(a?.length===3&&a.every(Number.isFinite))out.localStartPoint=a;
      if(b?.length===3&&b.every(Number.isFinite))out.localEndPoint=b;
      if(!out.localStartPoint||!out.localEndPoint){
        const topoEdge=(topo.edges||[]).find(e=>Number(e.id)===id),pts=Array.from(topoEdge?.points||[]).map(Number);
        if(pts.length>=6){
          const sa=pts.slice(0,3),sb=pts.slice(-3);
          if(!out.localStartPoint&&sa.every(Number.isFinite))out.localStartPoint=sa;
          if(!out.localEndPoint&&sb.every(Number.isFinite))out.localEndPoint=sb;
        }
      }
    }
    edges.push(out);
  }
  const logicalGroups=allLogicalFaceGroups(occt).filter(group=>String(group.geometryId)===gid);
  return{geometryId:gid,faces,edges,logicalGroups};
}

function shapeHandle(geometryId) {
  const handle = bindingByGeometry.get(String(geometryId));
  if (handle == null) throw new Error(`No exact B-Rep binding for geometry ${geometryId}.`);
  return handle;
}

function exactRef(selection) {
  if (exactModelId == null) throw new Error('No retained exact STEP model.');
  return {
    exactModelId,
    exactShapeHandle: shapeHandle(selection.geometryId),
    kind: selection.kind,
    elementId: Number(selection.elementId),
    transform: Array.isArray(selection.transform) && selection.transform.length === 16
      ? selection.transform.map(Number)
      : [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
  };
}

function transformVector(vector,m){
  const x=Number(vector?.[0])||0,y=Number(vector?.[1])||0,z=Number(vector?.[2])||0;
  const out=[m[0]*x+m[4]*y+m[8]*z,m[1]*x+m[5]*y+m[9]*z,m[2]*x+m[6]*y+m[10]*z];
  const len=Math.hypot(...out)||1;return out.map(v=>v/len);
}

function transformPoint(point, m) {
  const x=point[0], y=point[1], z=point[2];
  return [
    m[0]*x + m[4]*y + m[8]*z + m[12],
    m[1]*x + m[5]*y + m[9]*z + m[13],
    m[2]*x + m[6]*y + m[10]*z + m[14]
  ];
}

function inspectSelection(occt, selection) {
  const r = exactRef(selection);
  const out = {
    kind: r.kind,
    elementId: r.elementId,
    geometryId: selection.geometryId,
    family: 'other'
  };

  const type = occt.GetExactGeometryType(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
  if (type?.ok) out.family = type.family;

  const radius = occt.MeasureExactRadius(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
  if (radius?.ok) {
    out.radius = radius.radius;
    out.diameter = radius.diameter;
    out.localCenter = radius.localCenter;
    out.center = transformPoint(radius.localCenter, r.transform);
    out.localAxisDirection = radius.localAxisDirection;
    out.axisDirection = transformVector(radius.localAxisDirection, r.transform);
  } else {
    const center = occt.MeasureExactCenter(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
    if (center?.ok) {
      out.localCenter = center.localCenter;
      out.center = transformPoint(center.localCenter, r.transform);
      out.localAxisDirection = center.localAxisDirection;
      out.axisDirection = transformVector(center.localAxisDirection, r.transform);
    }
  }

  if (r.kind === 'edge') {
    const ids=faceIdsForSelection(selection);let lengthSum=0,lengthOk=false;
    for(const edgeId of ids){const length=occt.MeasureExactEdgeLength(r.exactModelId,r.exactShapeHandle,r.kind,edgeId);if(length?.ok&&Number.isFinite(length.value)){lengthSum+=length.value;lengthOk=true;}}
    if(lengthOk)out.length=lengthSum;if(ids.length>1)out.logicalEdgeIds=ids;
  }

  if (r.kind === 'face') {
    const ids=faceIdsForSelection(selection);
    let areaSum=0,areaOk=false;
    for(const faceId of ids){const area=occt.MeasureExactFaceArea(r.exactModelId,r.exactShapeHandle,r.kind,faceId);if(area?.ok&&Number.isFinite(area.value)){areaSum+=area.value;areaOk=true;}}
    if(areaOk) out.area=areaSum;
    if(ids.length>1) out.logicalFaceIds=ids;
    const hole = occt.DescribeExactHole(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
    if (hole?.ok) {
      out.hole = {
        diameter: hole.diameter,
        radius: hole.radius,
        depth: hole.depth,
        isThrough: hole.isThrough
      };
    }
  } else if (r.kind === 'edge') {
    const hole = occt.DescribeExactHole(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
    if (hole?.ok) {
      out.hole = {
        diameter: hole.diameter,
        radius: hole.radius,
        depth: hole.depth,
        isThrough: hole.isThrough
      };
    }
  }

  return out;
}

function isRadialGeometry(info) {
  const family=String(info?.family||'').toLowerCase();

  // These geometries have a meaningful CAD center/axis for center-to-center.
  return [
    'circle',
    'circular',
    'cylinder',
    'cylindrical',
    'sphere',
    'spherical',
    'torus',
    'toroidal'
  ].includes(family);
}

function centerDistance(a, b) {
  if (!a.center || !b.center) {
    return { ok:false, code:'no-center', message:'Both selections must expose an exact center.' };
  }
  const dx=b.center[0]-a.center[0], dy=b.center[1]-a.center[1], dz=b.center[2]-a.center[2];
  return {
    ok:true, kind:'center-center',
    value: Math.hypot(dx,dy,dz),
    dx:Math.abs(dx), dy:Math.abs(dy), dz:Math.abs(dz),
    pointA:a.center, pointB:b.center,
    detailsA:a, detailsB:b
  };
}

function exactDistance(occt, aSel, bSel, aInfo, bInfo) {
  const a=exactRef(aSel), b=exactRef(bSel);
  const aIds=faceIdsForSelection(aSel),bIds=faceIdsForSelection(bSel);
  let best=null;
  for(const aid of aIds){for(const bid of bIds){
    const r=occt.MeasureExactDistance(
      a.exactModelId,a.exactShapeHandle,a.kind,aid,
      b.exactShapeHandle,b.kind,bid,
      a.transform,b.transform
    );
    if(r?.ok&&Number.isFinite(r.value)&&(!best||r.value<best.value))best=r;
  }}
  if(!best)return {ok:false,code:'no-distance',message:'Exact distance unavailable.'};
  return {...best,kind:'distance',detailsA:aInfo,detailsB:bInfo};
}

function exactAngle(occt, aSel, bSel, aInfo, bInfo) {
  const a=exactRef(aSel), b=exactRef(bSel);
  const r=occt.MeasureExactAngle(
    a.exactModelId, a.exactShapeHandle, a.kind, a.elementId,
    b.exactShapeHandle, b.kind, b.elementId,
    a.transform, b.transform
  );
  if (!r?.ok) return r;
  return { ...r, kind:'angle', detailsA:aInfo, detailsB:bInfo };
}

self.onmessage = async (event) => {
  const { id, action, payload } = event.data ?? {};
  if (!id || !action) return;

  try {
    const occt = await getOcct();

    if (action === 'load-step') {
      releaseCurrent(occt);

      const bytes = new Uint8Array(payload.buffer);
      const raw = occt.OpenExactStepModel(bytes, {
        rootMode: 'one-shape',
        linearUnit: 'millimeter',
        linearDeflectionType: 'bounding_box_ratio',
        linearDeflection: 0.002,
        angularDeflection: 0.35,
        readNames: true,
        colorMode: 'source',
        appearancePreset: 'cad-solid'
      });

      if (!raw?.success) {
        throw new Error(raw?.error || 'OpenCascade could not open this STEP file.');
      }
      if (raw.exactModelId == null) throw new Error('Exact STEP handle was not created.');

      exactModelId = raw.exactModelId;
      bindingByGeometry = new Map(
        Array.from(raw.exactGeometryBindings ?? []).map(b => [String(b.geometryId), Number(b.exactShapeHandle)])
      );
      topologyByGeometry = new Map(Array.from(raw.geometries ?? []).map(g=>[String(g.id),{faces:Array.from(g.faces??[]).map(f=>({id:Number(f.id),edgeIndices:Array.from(f.edgeIndices??[]).map(Number)})),edges:Array.from(g.edges??[]).map(e=>({id:Number(e.id),ownerFaceIds:Array.from(e.ownerFaceIds??[]).map(Number),points:Array.from(e.points??[]).map(Number)}))}]));
      logicalFaceGroupCache = new Map();
  logicalEdgeGroupCache = new Map();

      const result = {
        success: true,
        engine: ENGINE_REV,
        sourceFormat: String(raw.sourceFormat ?? 'step'),
        sourceUnit: String(raw.sourceUnit ?? 'millimeter'),
        unitScaleToMeters: Number(raw.unitScaleToMeters ?? 0.001),
        stats: raw.stats ? {
          rootCount:Number(raw.stats.rootCount ?? 0),
          nodeCount:Number(raw.stats.nodeCount ?? 0),
          partCount:Number(raw.stats.partCount ?? 0),
          geometryCount:Number(raw.stats.geometryCount ?? 0),
          materialCount:Number(raw.stats.materialCount ?? 0),
          triangleCount:Number(raw.stats.triangleCount ?? 0),
          reusedInstanceCount:Number(raw.stats.reusedInstanceCount ?? 0)
        } : null,
        rootNodes: Array.from(raw.rootNodes ?? []).map(plainNode),
        geometries: Array.from(raw.geometries ?? []).map(plainGeometry)
      };

      const transfer = transferListFor(result);
      self.postMessage({ id, ok:true, result }, transfer);
      return;
    }

    if (action === 'logical-face-group') {
      const faceIds=logicalFaceGroup(occt,payload.selection);
      self.postMessage({id,ok:true,result:{faceIds}});
      return;
    }
    if (action === 'logical-edge-group') {
      const edgeIds=logicalEdgeGroup(occt,payload.selection);
      self.postMessage({id,ok:true,result:{edgeIds}});
      return;
    }
    if (action === 'logical-face-groups') {
      self.postMessage({id,ok:true,result:{groups:allLogicalFaceGroups(occt)}});
      return;
    }

    if (action === 'sheetmetal-face-info') {
      const result=sheetMetalFaceInfo(occt,payload.geometryId);
      self.postMessage({id,ok:true,result});
      return;
    }

    if (action === 'inspect') {
      const result = inspectSelection(occt, payload.selection);
      self.postMessage({ id, ok:true, result });
      return;
    }

    if (action === 'measure') {
      const aInfo = inspectSelection(occt, payload.a);
      const bInfo = inspectSelection(occt, payload.b);
      let result;

      if (payload.mode === 'center') {
        result = centerDistance(aInfo, bInfo);
      } else if (payload.mode === 'angle') {
        result = exactAngle(occt, payload.a, payload.b, aInfo, bInfo);
      } else if (
        payload.mode === 'smart' &&
        aInfo.center &&
        bInfo.center &&
        isRadialGeometry(aInfo) &&
        isRadialGeometry(bInfo)
      ) {
        // Hole/circle/cylinder -> hole/circle/cylinder: center-to-center.
        result = centerDistance(aInfo, bInfo);
      } else {
        // Face -> face, cylindrical face -> planar face, edge -> face, etc.
        // Use OpenCascade's exact minimum B-Rep distance.
        result = exactDistance(occt, payload.a, payload.b, aInfo, bInfo);
      }

      self.postMessage({ id, ok:true, result });
      return;
    }

    if (action === 'release') {
      releaseCurrent(occt);
      self.postMessage({ id, ok:true, result:{released:true} });
      return;
    }

    throw new Error(`Unknown CAD worker action: ${action}`);
  } catch (error) {
    self.postMessage({
      id,
      ok:false,
      error:error?.message || String(error)
    });
  }
};
