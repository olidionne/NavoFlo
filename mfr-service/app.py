"""NavoFeatureEngine V8.20.0 — AAGNet inference sidecar.

This service is intentionally isolated from the main NavoFlo Worker. It accepts
one STEP part, runs AAGNet instance segmentation, and returns feature hypotheses.
The browser-side Critical Manufacturing Arbitrator remains the final judge.
"""
from __future__ import annotations
import os, sys, tempfile, time, urllib.parse
from pathlib import Path
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

AAGNET_ROOT = Path(os.environ.get("AAGNET_ROOT", "/opt/AAGNet"))
if str(AAGNET_ROOT) not in sys.path:
    sys.path.insert(0, str(AAGNET_ROOT))

from dataset.AAGExtractor import AAGExtractor, TopologyChecker  # type: ignore
from models.inst_segmentors import AAGNetSegmentor  # type: ignore
from utils.data_utils import load_one_graph, load_json_or_pkl, load_statistics, standardization  # type: ignore
from OCC.Extend.TopologyUtils import TopologyExplorer  # type: ignore
from utils.data_utils import load_body_from_step  # type: ignore

APP_VERSION = "8.20.0"
AAGNET_COMMIT = os.environ.get("AAGNET_COMMIT", "e0e36b7a12a7f01a29d7be36efc22730d293a1bd")
MAX_STEP_BYTES = int(os.environ.get("MAX_STEP_BYTES", str(20 * 1024 * 1024)))
TOKEN = os.environ.get("MFR_SERVICE_TOKEN", "")
DEVICE = os.environ.get("AAGNET_DEVICE", "cpu")

FEATURE_NAMES = [
    'chamfer','through_hole','triangular_passage','rectangular_passage','6sides_passage',
    'triangular_through_slot','rectangular_through_slot','circular_through_slot',
    'rectangular_through_step','2sides_through_step','slanted_through_step','Oring','blind_hole',
    'triangular_pocket','rectangular_pocket','6sides_pocket','circular_end_pocket',
    'rectangular_blind_slot','v_circular_end_blind_slot','h_circular_end_blind_slot',
    'triangular_blind_step','circular_blind_step','rectangular_blind_step','round','stock'
]

app = FastAPI(title="NavoFeatureEngine", version=APP_VERSION)
model: AAGNetSegmentor | None = None
attribute_schema: dict[str, Any] | None = None
stat: dict[str, Any] | None = None
topo_checker = TopologyChecker()


def check_token(auth: str | None) -> None:
    if TOKEN and auth != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid service token")


def init_model() -> None:
    global model, attribute_schema, stat
    if model is not None:
        return
    attribute_schema = load_json_or_pkl(str(AAGNET_ROOT / "feature_lists/all.json"))
    stat = load_statistics(str(AAGNET_ROOT / "weights/attr_stat.json"))
    recognizer = AAGNetSegmentor(
        arch='AAGNetGraphEncoder', num_classes=len(FEATURE_NAMES),
        edge_attr_dim=12, node_attr_dim=10, edge_attr_emb=64, node_attr_emb=64,
        edge_grid_dim=0, node_grid_dim=7, edge_grid_emb=0, node_grid_emb=64,
        num_layers=3, delta=2, mlp_ratio=2, drop=0., drop_path=0.,
        head_hidden_dim=64, conv_on_edge=False
    )
    weights = torch.load(str(AAGNET_ROOT / "weights/weight_on_MFInstseg.pth"), map_location='cpu')
    recognizer.load_state_dict(weights)
    recognizer = recognizer.to(DEVICE)
    recognizer.eval()
    model = recognizer


def softmax_confidence(logits: np.ndarray, class_idx: int) -> float:
    v = np.asarray(logits, dtype=np.float64)
    v = v - np.max(v)
    e = np.exp(v)
    den = float(np.sum(e))
    return float(e[class_idx] / den) if den > 0 else 0.0


def infer_step(path: Path) -> dict[str, Any]:
    init_model()
    assert model is not None and attribute_schema is not None and stat is not None
    t0 = time.perf_counter()
    solid = load_body_from_step(path)
    if not topo_checker(solid):
        raise ValueError("AAGNet rejected the STEP topology (open/non-manifold/invalid B-Rep).")
    faces = list(TopologyExplorer(solid).faces())
    aag = AAGExtractor(path, attribute_schema).process()
    sample = load_one_graph(str(path), aag)
    sample = standardization(sample, stat)
    graph = sample["graph"].to(DEVICE)
    prep_ms = (time.perf_counter() - t0) * 1000.0

    t1 = time.perf_counter()
    with torch.no_grad():
        seg_out, inst_out, bottom_out = model(graph)
    infer_ms = (time.perf_counter() - t1) * 1000.0

    face_logits = seg_out.detach().cpu().numpy()
    inst = inst_out[0].sigmoid().detach().cpu().numpy() > 0.5
    bottom = bottom_out.sigmoid().detach().cpu().numpy() > 0.5

    proposals: list[list[int]] = []
    used = np.zeros(inst.shape[0], dtype=bool)
    for row_idx, row in enumerate(inst):
        if used[row_idx] or np.sum(row) == 0:
            continue
        proposal = []
        for col_idx, item in enumerate(row):
            if used[col_idx] or not item:
                continue
            proposal.append(int(col_idx))
            used[col_idx] = True
        if proposal:
            proposals.append(proposal)

    features = []
    confidences = []
    for proposal in proposals:
        summed = np.sum(face_logits[proposal], axis=0)
        class_idx = int(np.argmax(summed))
        name = FEATURE_NAMES[class_idx]
        if name == 'stock':
            continue
        conf = softmax_confidence(summed, class_idx)
        confidences.append(conf)
        # AAGNet/PythonOCC face order is returned explicitly as advisory. NavoFlo
        # never treats these IDs as exact OCCT-js IDs until a geometric mapper
        # validates them; class/instance semantics are still useful immediately.
        features.append({
            "name": name,
            "type": name,
            "confidence": conf,
            "faces": [i + 1 for i in proposal],
            "bottomFaces": [i + 1 for i in proposal if bool(bottom[i])],
            "source": "AAGNet-MFInstSeg",
            "faceIdDomain": "pythonocc-topology-order-advisory"
        })

    return {
        "ok": True,
        "engine": "AAGNet",
        "engineVersion": AAGNET_COMMIT[:12],
        "serviceVersion": APP_VERSION,
        "confidence": float(np.mean(confidences)) if confidences else 0.0,
        "featureInstances": features,
        "features": features,
        "faceCount": len(faces),
        "timingMs": {"preprocess": prep_ms, "inference": infer_ms, "total": (time.perf_counter() - t0) * 1000.0},
        "faceMapping": "advisory"
    }


@app.on_event("startup")
def startup() -> None:
    init_model()


@app.get("/health")
def health(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    check_token(authorization)
    return {"ok": True, "engine": "AAGNet", "serviceVersion": APP_VERSION, "device": DEVICE, "commit": AAGNET_COMMIT}


@app.post("/analyze")
async def analyze(request: Request, authorization: str | None = Header(default=None), x_file_name: str | None = Header(default=None)):
    check_token(authorization)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty STEP body")
    if len(body) > MAX_STEP_BYTES:
        raise HTTPException(status_code=413, detail="STEP exceeds MAX_STEP_BYTES")
    raw_name = urllib.parse.unquote(x_file_name or "model.step")
    suffix = ".stp" if raw_name.lower().endswith(".stp") else ".step"
    with tempfile.TemporaryDirectory(prefix="navoflo-mfr-") as td:
        path = Path(td) / ("input" + suffix)
        path.write_bytes(body)
        try:
            return JSONResponse(infer_step(path))
        except Exception as exc:
            return JSONResponse({"ok": False, "engine": "AAGNet", "serviceVersion": APP_VERSION, "error": str(exc)}, status_code=422)
