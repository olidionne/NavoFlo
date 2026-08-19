import OcctJS from 'https://cdn.jsdelivr.net/gh/tx-code/occt-js@ad8ffb6007eb3fd25179232f291b626d6e78a195/dist/occt-js.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/gh/tx-code/occt-js@ad8ffb6007eb3fd25179232f291b626d6e78a195/dist/occt-js.wasm';
const ENGINE_REV = 'occt-js 0.1.14-dev @ ad8ffb6';

let occtPromise = null;
let exactModelId = null;
let bindingByGeometry = new Map();

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
    out.axisDirection = radius.localAxisDirection;
  } else {
    const center = occt.MeasureExactCenter(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
    if (center?.ok) {
      out.localCenter = center.localCenter;
      out.center = transformPoint(center.localCenter, r.transform);
      out.axisDirection = center.localAxisDirection;
    }
  }

  if (r.kind === 'edge') {
    const length = occt.MeasureExactEdgeLength(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
    if (length?.ok) out.length = length.value;
  }

  if (r.kind === 'face') {
    const area = occt.MeasureExactFaceArea(r.exactModelId, r.exactShapeHandle, r.kind, r.elementId);
    if (area?.ok) out.area = area.value;
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
  const r=occt.MeasureExactDistance(
    a.exactModelId, a.exactShapeHandle, a.kind, a.elementId,
    b.exactShapeHandle, b.kind, b.elementId,
    a.transform, b.transform
  );
  if (!r?.ok) return r;
  return { ...r, kind:'distance', detailsA:aInfo, detailsB:bInfo };
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
