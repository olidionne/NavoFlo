// NavoFlo v8.26.0 — Company Settings (Capacités paramétrables + Facteur K + Outillage)
// Imperial (inch) display, metric (mm) storage. FR/EN via window.NAVO_LANG.

const FR = (window.NAVO_LANG || 'fr') === 'fr';

// ── Unit conversion (store mm, show inches) ──────────────────────────────────
const MM_PER_IN = 25.4;
const inToMm = v => (v === null || v === undefined || v === '') ? null : Number(v) * MM_PER_IN;
const mmToInStr = v => (v === null || v === undefined) ? '' : String(+(Number(v) / MM_PER_IN).toFixed(4));
const fmtIn = v => (v === null || v === undefined) ? '—' : (+(Number(v) / MM_PER_IN).toFixed(3)) + '″';

const T = FR ? {
  pageTitle: 'Paramètres de compagnie',
  pageDesc: 'Configurez les capacités de fabrication et les paramètres de pliage propres à votre organisation.',
  tabCap: 'Capacités',
  tabBend: 'Facteur K / Pliage',
  capTitle: 'Capacités de fabrication internes',
  capDesc: 'Cochez les procédés que votre entreprise effectue à l\u2019interne, puis précisez leurs paramètres. Dimensions en pouces (″).',
  capSave: 'Enregistrer les capacités',
  capSaved: 'Capacités enregistrées.',
  capError: 'Erreur lors de l\u2019enregistrement.',
  capParamsTitle: 'Paramètres des procédés activés',
  bedWidth: 'Largeur table (″)',
  bedLength: 'Longueur table (″)',
  maxThickness: 'Épaisseur max (″)',
  perMaterial: 'Épaisseur max par matériau',
  maxBendLength: 'Longueur de pli max (″)',
  maxTonnage: 'Tonnage max (t)',
  maxWidth: 'Largeur max (″)',
  minDiameter: 'Diamètre min (″)',
  bendTitle: 'Table Facteur K par matériau et rayon',
  bendDesc: 'Règles de facteur K spécifiques à votre entreprise. Remplacent les valeurs par défaut du STEP dans Navo3D. Épaisseurs et rayons en pouces (″).',
  bendAdd: '+ Ajouter une règle',
  bendSave: 'Enregistrer',
  bendCancel: 'Annuler',
  bendDelete: 'Supprimer',
  bendEdit: 'Modifier',
  bendSaved: 'Règle enregistrée.',
  bendDeleted: 'Règle supprimée.',
  bendError: 'Erreur lors de l\u2019enregistrement.',
  bendEmpty: 'Aucune règle K définie. Cliquez « + Ajouter » pour en créer une.',
  bendConfirmDelete: 'Supprimer cette règle de facteur K ?',
  colMat: 'Classe de matériau',
  colThickMin: 'ép. min (″)',
  colThickMax: 'ép. max (″)',
  colRadMin: 'R min (″)',
  colRadMax: 'R max (″)',
  colK: 'Facteur K',
  colNotes: 'Notes',
  colActions: '',
  matAll: 'Tous matériaux',
  matSoft: 'Doux (aluminium, cuivre)',
  matMedium: 'Intermédiaire (acier doux)',
  matHard: 'Dur (inox, acier haute résistance)',
  toolTitle: 'Outillage de pliage',
  toolDesc: 'Inventaire de vos matrices (V-dies) et poinçons. Choisissez un preset standard pour aller vite, puis ajustez.',
  toolDies: 'Matrices (V-dies)',
  toolPunches: 'Poinçons',
  toolAddDie: '+ Ajouter une matrice',
  toolAddPunch: '+ Ajouter un poinçon',
  toolPreset: 'Preset standard',
  toolPresetNone: '— Personnalisé —',
  toolName: 'Nom / repère',
  vOpening: 'Ouverture V (″)',
  dieAngle: 'Angle matrice (°)',
  punchRadius: 'Rayon de bout (″)',
  punchAngle: 'Angle poinçon (°)',
  toolLength: 'Longueur (″)',
  toolTonnage: 'Tonnage (t)',
  toolQty: 'Qté',
  toolEmptyDies: 'Aucune matrice enregistrée.',
  toolEmptyPunches: 'Aucun poinçon enregistré.',
  toolSaved: 'Outil enregistré.',
  toolDeleted: 'Outil supprimé.',
  toolConfirmDelete: 'Supprimer cet outil ?',
  accessDenied: 'Accès refusé. Rôle administrateur ou propriétaire requis.',
  notLoggedIn: 'Vous devez être connecté pour accéder à cette page.',
  noOrg: 'Aucune organisation active associée à votre compte.',
  accountNav: [
    { href: '/account/licenses/', label: 'Licences' },
    { href: '/account/company/', label: 'Compagnie', active: true }
  ]
} : {
  pageTitle: 'Company Settings',
  pageDesc: 'Configure your organization\u2019s manufacturing capabilities and bending parameters.',
  tabCap: 'Capabilities',
  tabBend: 'K-Factor / Bending',
  capTitle: 'Internal Manufacturing Capabilities',
  capDesc: 'Check the processes your company performs in-house, then specify their parameters. Dimensions in inches (″).',
  capSave: 'Save Capabilities',
  capSaved: 'Capabilities saved.',
  capError: 'Error saving capabilities.',
  capParamsTitle: 'Enabled process parameters',
  bedWidth: 'Bed width (″)',
  bedLength: 'Bed length (″)',
  maxThickness: 'Max thickness (″)',
  perMaterial: 'Max thickness per material',
  maxBendLength: 'Max bend length (″)',
  maxTonnage: 'Max tonnage (t)',
  maxWidth: 'Max width (″)',
  minDiameter: 'Min diameter (″)',
  bendTitle: 'K-Factor Table by Material and Radius',
  bendDesc: 'Company-specific K-factor rules. Override STEP defaults in Navo3D. Thickness and radius in inches (″).',
  bendAdd: '+ Add rule',
  bendSave: 'Save',
  bendCancel: 'Cancel',
  bendDelete: 'Delete',
  bendEdit: 'Edit',
  bendSaved: 'Rule saved.',
  bendDeleted: 'Rule deleted.',
  bendError: 'Error saving rule.',
  bendEmpty: 'No K-factor rules defined. Click "+ Add" to create one.',
  bendConfirmDelete: 'Delete this K-factor rule?',
  colMat: 'Material class',
  colThickMin: 'thick min (″)',
  colThickMax: 'thick max (″)',
  colRadMin: 'R min (″)',
  colRadMax: 'R max (″)',
  colK: 'K-Factor',
  colNotes: 'Notes',
  colActions: '',
  matAll: 'All materials',
  matSoft: 'Soft (aluminum, copper)',
  matMedium: 'Medium (mild steel)',
  matHard: 'Hard (stainless, HSLA)',
  toolTitle: 'Bending Tooling',
  toolDesc: 'Inventory of your V-dies and punches. Pick a standard preset to start, then adjust.',
  toolDies: 'V-Dies',
  toolPunches: 'Punches',
  toolAddDie: '+ Add die',
  toolAddPunch: '+ Add punch',
  toolPreset: 'Standard preset',
  toolPresetNone: '— Custom —',
  toolName: 'Name / tag',
  vOpening: 'V opening (″)',
  dieAngle: 'Die angle (°)',
  punchRadius: 'Tip radius (″)',
  punchAngle: 'Punch angle (°)',
  toolLength: 'Length (″)',
  toolTonnage: 'Tonnage (t)',
  toolQty: 'Qty',
  toolEmptyDies: 'No dies registered.',
  toolEmptyPunches: 'No punches registered.',
  toolSaved: 'Tool saved.',
  toolDeleted: 'Tool deleted.',
  toolConfirmDelete: 'Delete this tool?',
  accessDenied: 'Access denied. Admin or owner role required.',
  notLoggedIn: 'You must be logged in to access this page.',
  noOrg: 'No active organization associated with your account.',
  accountNav: [
    { href: '/en/account/licenses/', label: 'Licenses' },
    { href: '/en/account/company/', label: 'Company', active: true }
  ]
};

const PROCESSES = {
  laser:       FR ? 'Laser (découpe)' : 'Laser (cutting)',
  plasma:      FR ? 'Plasma (découpe)' : 'Plasma (cutting)',
  waterjet:    FR ? 'Jet d\u2019eau' : 'Waterjet',
  punching:    FR ? 'Poinçonnage' : 'Punching',
  bending:     FR ? 'Pliage (frein)' : 'Bending (brake)',
  rolling:     FR ? 'Roulage' : 'Rolling',
  stamping:    FR ? 'Estampage' : 'Stamping',
  milling:     FR ? 'Fraisage' : 'Milling',
  turning:     FR ? 'Tournage' : 'Turning',
  drilling:    FR ? 'Perçage' : 'Drilling',
  grinding:    FR ? 'Rectification' : 'Grinding',
  welding:     FR ? 'Soudage' : 'Welding',
  assembly:    FR ? 'Assemblage' : 'Assembly',
  sawing:      FR ? 'Sciage' : 'Sawing',
  painting:    FR ? 'Peinture' : 'Painting',
  sandblasting:FR ? 'Sablage' : 'Sandblasting'
};

// Process → parameter category (drives which editor is shown).
const CATEGORY = {
  laser: 'cutting', plasma: 'cutting', waterjet: 'cutting', punching: 'cutting',
  bending: 'bending', rolling: 'rolling'
};

const MAT_OPTIONS = [
  { value: 'all',    label: T.matAll },
  { value: 'soft',   label: T.matSoft },
  { value: 'medium', label: T.matMedium },
  { value: 'hard',   label: T.matHard }
];
const CUT_MATERIALS = ['soft', 'medium', 'hard'];

// Standard tooling presets (values stored in mm; displayed in inches).
const DIE_PRESETS = [
  { name: 'V 1/4″',   v_opening_mm: 6.35,  die_angle_deg: 88 },
  { name: 'V 3/8″',   v_opening_mm: 9.53,  die_angle_deg: 88 },
  { name: 'V 1/2″',   v_opening_mm: 12.7,  die_angle_deg: 88 },
  { name: 'V 5/8″',   v_opening_mm: 15.88, die_angle_deg: 88 },
  { name: 'V 3/4″',   v_opening_mm: 19.05, die_angle_deg: 88 },
  { name: 'V 1″',     v_opening_mm: 25.4,  die_angle_deg: 88 },
  { name: 'V 1-1/2″', v_opening_mm: 38.1,  die_angle_deg: 88 },
  { name: 'V 2″',     v_opening_mm: 50.8,  die_angle_deg: 88 }
];
const PUNCH_PRESETS = [
  { name: 'R 1/64″ (0.4mm)', punch_radius_mm: 0.4, punch_angle_deg: 88 },
  { name: 'R 1/32″ (0.8mm)', punch_radius_mm: 0.8, punch_angle_deg: 88 },
  { name: 'R 1/16″ (1.6mm)', punch_radius_mm: 1.6, punch_angle_deg: 88 },
  { name: 'R 3/32″ (2.4mm)', punch_radius_mm: 2.4, punch_angle_deg: 88 },
  { name: 'R 1/8″ (3.2mm)',  punch_radius_mm: 3.2, punch_angle_deg: 88 },
  { name: FR ? 'Aigu 30°' : 'Acute 30°', punch_radius_mm: 0.6, punch_angle_deg: 30 },
  { name: FR ? 'Col de cygne' : 'Gooseneck', punch_radius_mm: 1.5, punch_angle_deg: 88 }
];

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'same-origin',
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'API error'), { status: res.status, code: data.code });
  return data;
}

// ── State ────────────────────────────────────────────────────────────────────
let capState = {};      // { process: boolean }
let capParams = {};     // { process: paramsObject }
let bendState = [];
let toolingState = [];
let editingBendId = null;
let editingToolId = null;
let editingToolType = 'die';

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ── Build page shell ──────────────────────────────────────────────────────────
function buildPage(root) {
  root.innerHTML = `
    <div class="cs-header">
      <nav class="cs-account-nav">
        ${T.accountNav.map(n => `<a href="${n.href}"${n.active ? ' class="active"' : ''}>${n.label}</a>`).join('')}
      </nav>
      <h1>${T.pageTitle}</h1>
      <p>${T.pageDesc}</p>
    </div>

    <div class="cs-tabs">
      <button class="cs-tab active" data-tab="capabilities">${T.tabCap}</button>
      <button class="cs-tab" data-tab="bend">${T.tabBend}</button>
    </div>

    <!-- Capabilities panel -->
    <div class="cs-panel active" id="panel-capabilities">
      <div class="cs-card">
        <div class="cs-card-title">${T.capTitle}</div>
        <div class="cs-card-desc">${T.capDesc}</div>
        <div class="cs-cap-grid" id="cap-grid"></div>
        <div class="cs-save-row">
          <button class="cs-btn cs-btn-primary" id="cap-save">${T.capSave}</button>
          <span class="cs-save-msg" id="cap-msg"></span>
        </div>
      </div>

      <div class="cs-card" id="cap-params-card">
        <div class="cs-card-title">${T.capParamsTitle}</div>
        <div id="cap-params"></div>
      </div>
    </div>

    <!-- Bend panel -->
    <div class="cs-panel" id="panel-bend">
      <div class="cs-card">
        <div class="cs-card-title">${T.bendTitle}</div>
        <div class="cs-card-desc">${T.bendDesc}</div>
        <div class="cs-bend-toolbar"><button class="cs-btn cs-btn-primary" id="bend-add">${T.bendAdd}</button></div>

        <div class="cs-bend-form" id="bend-form">
          <div class="cs-field"><label>${T.colMat}</label>
            <select id="bf-mat">${MAT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>
          </div>
          <div class="cs-field"><label>${T.colThickMin}</label><input type="number" id="bf-tmin" placeholder="—" min="0" step="0.001"></div>
          <div class="cs-field"><label>${T.colThickMax}</label><input type="number" id="bf-tmax" placeholder="—" min="0" step="0.001"></div>
          <div class="cs-field"><label>${T.colRadMin}</label><input type="number" id="bf-rmin" placeholder="—" min="0" step="0.001"></div>
          <div class="cs-field"><label>${T.colRadMax}</label><input type="number" id="bf-rmax" placeholder="—" min="0" step="0.001"></div>
          <div class="cs-field" style="flex:0 1 90px"><label>${T.colK} *</label><input type="number" id="bf-k" placeholder="0.40" min="0.2" max="0.8" step="0.01" required></div>
          <div class="cs-field" style="flex:2 1 160px"><label>${T.colNotes}</label><input type="text" id="bf-notes"></div>
          <div class="cs-form-actions">
            <button class="cs-btn cs-btn-primary" id="bend-form-save">${T.bendSave}</button>
            <button class="cs-btn" id="bend-form-cancel" style="border:1px solid #2c4351;color:#adc0cc">${T.bendCancel}</button>
          </div>
        </div>

        <span class="cs-save-msg" id="bend-msg" style="margin-bottom:10px;display:block"></span>

        <div class="cs-bend-table-wrap">
          <div class="cs-bend-empty" id="bend-empty" style="display:none">${T.bendEmpty}</div>
          <table class="cs-bend-table" id="bend-table" style="display:none">
            <thead><tr>
              <th>${T.colMat}</th><th>${T.colThickMin}</th><th>${T.colThickMax}</th>
              <th>${T.colRadMin}</th><th>${T.colRadMax}</th><th>${T.colK}</th>
              <th>${T.colNotes}</th><th>${T.colActions}</th>
            </tr></thead>
            <tbody id="bend-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- Tooling -->
      <div class="cs-card">
        <div class="cs-card-title">${T.toolTitle}</div>
        <div class="cs-card-desc">${T.toolDesc}</div>
        <span class="cs-save-msg" id="tool-msg" style="margin-bottom:10px;display:block"></span>

        <div class="cs-tool-section">
          <div class="cs-tool-head"><h3>${T.toolDies}</h3><button class="cs-btn cs-btn-primary" id="add-die">${T.toolAddDie}</button></div>
          <div id="dies-list"></div>
        </div>

        <div class="cs-tool-section">
          <div class="cs-tool-head"><h3>${T.toolPunches}</h3><button class="cs-btn cs-btn-primary" id="add-punch">${T.toolAddPunch}</button></div>
          <div id="punches-list"></div>
        </div>

        <!-- Tool add/edit form -->
        <div class="cs-tool-form" id="tool-form">
          <div class="cs-field"><label>${T.toolPreset}</label><select id="tf-preset"></select></div>
          <div class="cs-field" style="flex:2 1 140px"><label>${T.toolName}</label><input type="text" id="tf-name"></div>
          <div class="cs-field cs-die-only"><label>${T.vOpening}</label><input type="number" id="tf-vopen" min="0" step="0.001"></div>
          <div class="cs-field cs-die-only"><label>${T.dieAngle}</label><input type="number" id="tf-dieangle" min="0" max="180" step="0.5"></div>
          <div class="cs-field cs-punch-only"><label>${T.punchRadius}</label><input type="number" id="tf-prad" min="0" step="0.001"></div>
          <div class="cs-field cs-punch-only"><label>${T.punchAngle}</label><input type="number" id="tf-pangle" min="0" max="180" step="0.5"></div>
          <div class="cs-field"><label>${T.toolLength}</label><input type="number" id="tf-len" min="0" step="0.01"></div>
          <div class="cs-field" style="flex:0 1 90px"><label>${T.toolTonnage}</label><input type="number" id="tf-ton" min="0" step="1"></div>
          <div class="cs-field" style="flex:0 1 70px"><label>${T.toolQty}</label><input type="number" id="tf-qty" min="0" step="1"></div>
          <div class="cs-form-actions">
            <button class="cs-btn cs-btn-primary" id="tool-form-save">${T.bendSave}</button>
            <button class="cs-btn" id="tool-form-cancel" style="border:1px solid #2c4351;color:#adc0cc">${T.bendCancel}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('.cs-tab').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('.cs-tab').forEach(t => t.classList.remove('active'));
    root.querySelectorAll('.cs-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  }));

  document.getElementById('cap-save').addEventListener('click', saveCapabilities);
  document.getElementById('bend-add').addEventListener('click', () => openBendForm(null));
  document.getElementById('bend-form-cancel').addEventListener('click', closeBendForm);
  document.getElementById('bend-form-save').addEventListener('click', saveBendParam);
  document.getElementById('add-die').addEventListener('click', () => openToolForm('die', null));
  document.getElementById('add-punch').addEventListener('click', () => openToolForm('punch', null));
  document.getElementById('tool-form-cancel').addEventListener('click', closeToolForm);
  document.getElementById('tool-form-save').addEventListener('click', saveTool);
  document.getElementById('tf-preset').addEventListener('change', applyPreset);
}

// ── Capabilities ──────────────────────────────────────────────────────────────
function renderCapGrid() {
  const grid = document.getElementById('cap-grid');
  grid.innerHTML = Object.entries(PROCESSES).map(([key, label]) => {
    const checked = !!capState[key];
    return `<div class="cs-cap-item${checked ? ' checked' : ''}" data-process="${key}">
      <input type="checkbox" id="cap-${key}"${checked ? ' checked' : ''}>
      <label for="cap-${key}">${label}</label>
    </div>`;
  }).join('');
  grid.querySelectorAll('.cs-cap-item').forEach(item => {
    const cb = item.querySelector('input');
    item.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') { cb.checked = !cb.checked; toggleCap(item, cb.checked); } });
    cb.addEventListener('change', e => toggleCap(item, e.target.checked));
  });
}

function toggleCap(item, checked) {
  capState[item.dataset.process] = checked;
  item.classList.toggle('checked', checked);
  renderCapParams();
}

// Render a param editor for each enabled process that has a category.
function renderCapParams() {
  const host = document.getElementById('cap-params');
  const card = document.getElementById('cap-params-card');
  const enabled = Object.keys(PROCESSES).filter(p => capState[p] && CATEGORY[p]);
  if (!enabled.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  host.innerHTML = enabled.map(p => {
    const cat = CATEGORY[p];
    const params = capParams[p] || {};
    if (cat === 'cutting') {
      const matRows = CUT_MATERIALS.map(mc => {
        const found = (params.materials || []).find(m => m.class === mc);
        const label = MAT_OPTIONS.find(o => o.value === mc).label;
        return `<div class="cs-matrow"><span>${label}</span>
          <input type="number" min="0" step="0.001" data-cap="${p}" data-mat="${mc}" placeholder="—" value="${found ? esc(mmToInStr(found.max_thickness_mm)) : ''}"><span class="cs-unit">″</span></div>`;
      }).join('');
      return `<div class="cs-param-block"><div class="cs-param-title">${PROCESSES[p]}</div>
        <div class="cs-param-row">
          <div class="cs-field"><label>${T.bedWidth}</label><input type="number" min="0" step="0.01" data-cap="${p}" data-field="bed_width_mm" value="${esc(mmToInStr(params.bed_width_mm))}"></div>
          <div class="cs-field"><label>${T.bedLength}</label><input type="number" min="0" step="0.01" data-cap="${p}" data-field="bed_length_mm" value="${esc(mmToInStr(params.bed_length_mm))}"></div>
        </div>
        <div class="cs-param-sub">${T.perMaterial}</div>
        <div class="cs-matgrid">${matRows}</div>
      </div>`;
    }
    if (cat === 'bending') {
      return `<div class="cs-param-block"><div class="cs-param-title">${PROCESSES[p]}</div>
        <div class="cs-param-row">
          <div class="cs-field"><label>${T.maxBendLength}</label><input type="number" min="0" step="0.01" data-cap="${p}" data-field="max_bend_length_mm" value="${esc(mmToInStr(params.max_bend_length_mm))}"></div>
          <div class="cs-field"><label>${T.maxTonnage}</label><input type="number" min="0" step="1" data-cap="${p}" data-field="max_tonnage_raw" value="${params.max_tonnage ?? ''}"></div>
        </div>
      </div>`;
    }
    if (cat === 'rolling') {
      return `<div class="cs-param-block"><div class="cs-param-title">${PROCESSES[p]}</div>
        <div class="cs-param-row">
          <div class="cs-field"><label>${T.maxWidth}</label><input type="number" min="0" step="0.01" data-cap="${p}" data-field="max_width_mm" value="${esc(mmToInStr(params.max_width_mm))}"></div>
          <div class="cs-field"><label>${T.minDiameter}</label><input type="number" min="0" step="0.01" data-cap="${p}" data-field="min_diameter_mm" value="${esc(mmToInStr(params.min_diameter_mm))}"></div>
          <div class="cs-field"><label>${T.maxThickness}</label><input type="number" min="0" step="0.001" data-cap="${p}" data-field="max_thickness_mm" value="${esc(mmToInStr(params.max_thickness_mm))}"></div>
        </div>
      </div>`;
    }
    return '';
  }).join('');
}

// Gather params from the editor inputs into capParams (converting inches → mm).
function collectCapParams() {
  const host = document.getElementById('cap-params');
  if (!host) return;
  const result = {};
  host.querySelectorAll('input[data-cap]').forEach(inp => {
    const p = inp.dataset.cap;
    const cat = CATEGORY[p];
    result[p] = result[p] || { kind: cat, materials: [] };
    if (inp.dataset.mat) {
      const mm = inToMm(inp.value);
      if (mm != null) result[p].materials.push({ class: inp.dataset.mat, max_thickness_mm: mm });
    } else if (inp.dataset.field === 'max_tonnage_raw') {
      const n = inp.value === '' ? null : Number(inp.value);
      if (n != null && Number.isFinite(n)) result[p].max_tonnage = n;
    } else {
      const mm = inToMm(inp.value);
      if (mm != null) result[p][inp.dataset.field] = mm;
    }
  });
  // clean empty materials arrays for non-cutting
  for (const p of Object.keys(result)) {
    if (CATEGORY[p] !== 'cutting') delete result[p].materials;
  }
  capParams = result;
}

async function saveCapabilities() {
  const btn = document.getElementById('cap-save');
  const msg = document.getElementById('cap-msg');
  btn.disabled = true; msg.style.display = 'none';
  try {
    collectCapParams();
    const capabilities = Object.keys(PROCESSES).map(process => ({
      process,
      enabled: !!capState[process],
      params: (capState[process] && CATEGORY[process]) ? capParams[process] : null
    }));
    await apiFetch('/api/company/capabilities', { method: 'PUT', body: JSON.stringify({ capabilities }) });
    showMsg(msg, T.capSaved, false);
  } catch (e) {
    showMsg(msg, e.message || T.capError, true);
  } finally { btn.disabled = false; }
}

// ── Bend params (inch display, mm storage) ────────────────────────────────────
function matLabel(v) { return MAT_OPTIONS.find(o => o.value === v)?.label || v; }

function renderBendTable() {
  const tbody = document.getElementById('bend-tbody');
  const table = document.getElementById('bend-table');
  const empty = document.getElementById('bend-empty');
  if (!bendState.length) { table.style.display = 'none'; empty.style.display = ''; return; }
  empty.style.display = 'none'; table.style.display = '';
  tbody.innerHTML = bendState.map(row => `
    <tr data-id="${row.id}">
      <td class="td-mat">${matLabel(row.material_class)}</td>
      <td>${fmtIn(row.thickness_min_mm)}</td>
      <td>${fmtIn(row.thickness_max_mm)}</td>
      <td>${fmtIn(row.inner_radius_min_mm)}</td>
      <td>${fmtIn(row.inner_radius_max_mm)}</td>
      <td class="td-k">${Number(row.k_factor).toFixed(3)}</td>
      <td>${esc(row.notes || '')}</td>
      <td><div class="td-actions">
        <button class="cs-btn" style="padding:4px 10px;font-size:12px;border:1px solid #2c4351;color:#adc0cc" data-edit="${row.id}">${T.bendEdit}</button>
        <button class="cs-btn cs-btn-danger" style="padding:4px 10px;font-size:12px" data-del="${row.id}">${T.bendDelete}</button>
      </div></td>
    </tr>`).join('');
  tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openBendForm(Number(b.dataset.edit))));
  tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmDeleteBend(Number(b.dataset.del))));
}

function openBendForm(id) {
  editingBendId = id;
  const row = id ? bendState.find(r => r.id === id) : null;
  const g = s => document.getElementById(s);
  g('bf-mat').value = row?.material_class ?? 'all';
  g('bf-tmin').value = row ? mmToInStr(row.thickness_min_mm) : '';
  g('bf-tmax').value = row ? mmToInStr(row.thickness_max_mm) : '';
  g('bf-rmin').value = row ? mmToInStr(row.inner_radius_min_mm) : '';
  g('bf-rmax').value = row ? mmToInStr(row.inner_radius_max_mm) : '';
  g('bf-k').value = row?.k_factor ?? '';
  g('bf-notes').value = row?.notes ?? '';
  g('bend-form').classList.add('open');
  g('bf-k').focus();
}
function closeBendForm() { document.getElementById('bend-form').classList.remove('open'); editingBendId = null; }

async function saveBendParam() {
  const msg = document.getElementById('bend-msg');
  const btn = document.getElementById('bend-form-save');
  btn.disabled = true; msg.style.display = 'none';
  const v = id => document.getElementById(id).value.trim();
  const payload = {
    id: editingBendId || undefined,
    material_class: v('bf-mat'),
    thickness_min_mm: inToMm(v('bf-tmin')),
    thickness_max_mm: inToMm(v('bf-tmax')),
    inner_radius_min_mm: inToMm(v('bf-rmin')),
    inner_radius_max_mm: inToMm(v('bf-rmax')),
    k_factor: v('bf-k') === '' ? null : Number(v('bf-k')),
    notes: v('bf-notes') || null
  };
  try {
    await apiFetch('/api/company/bend-params', { method: 'PUT', body: JSON.stringify(payload) });
    bendState = (await apiFetch('/api/company/bend-params')).bend_params || [];
    renderBendTable(); closeBendForm(); showMsg(msg, T.bendSaved, false);
  } catch (e) { showMsg(msg, e.message || T.bendError, true); }
  finally { btn.disabled = false; }
}

async function confirmDeleteBend(id) {
  if (!confirm(T.bendConfirmDelete)) return;
  const msg = document.getElementById('bend-msg');
  try {
    await apiFetch('/api/company/bend-params/' + id, { method: 'DELETE' });
    bendState = bendState.filter(r => r.id !== id); renderBendTable(); showMsg(msg, T.bendDeleted, false);
  } catch (e) { showMsg(msg, e.message || T.bendError, true); }
}

// ── Tooling ────────────────────────────────────────────────────────────────────
function renderTooling() {
  const dies = toolingState.filter(t => t.tool_type === 'die');
  const punches = toolingState.filter(t => t.tool_type === 'punch');

  const dieList = document.getElementById('dies-list');
  const punchList = document.getElementById('punches-list');

  dieList.innerHTML = dies.length ? dies.map(d => `
    <div class="cs-tool-card" data-id="${d.id}">
      <div class="cs-tool-main">
        <strong>${esc(d.name || ('V ' + fmtIn(d.v_opening_mm)))}</strong>
        <span>${T.vOpening.replace(' (″)','')}: ${fmtIn(d.v_opening_mm)} · ${d.die_angle_deg ?? '—'}°${d.length_mm ? ' · ' + fmtIn(d.length_mm) : ''}${d.max_tonnage ? ' · ' + d.max_tonnage + 't' : ''}${d.quantity ? ' · ×' + d.quantity : ''}</span>
      </div>
      <div class="td-actions">
        <button class="cs-btn" style="padding:4px 10px;font-size:12px;border:1px solid #2c4351;color:#adc0cc" data-edit-tool="${d.id}">${T.bendEdit}</button>
        <button class="cs-btn cs-btn-danger" style="padding:4px 10px;font-size:12px" data-del-tool="${d.id}">${T.bendDelete}</button>
      </div>
    </div>`).join('') : `<div class="cs-bend-empty">${T.toolEmptyDies}</div>`;

  punchList.innerHTML = punches.length ? punches.map(p => `
    <div class="cs-tool-card" data-id="${p.id}">
      <div class="cs-tool-main">
        <strong>${esc(p.name || ('R ' + fmtIn(p.punch_radius_mm)))}</strong>
        <span>${T.punchRadius.replace(' (″)','')}: ${fmtIn(p.punch_radius_mm)} · ${p.punch_angle_deg ?? '—'}°${p.length_mm ? ' · ' + fmtIn(p.length_mm) : ''}${p.max_tonnage ? ' · ' + p.max_tonnage + 't' : ''}${p.quantity ? ' · ×' + p.quantity : ''}</span>
      </div>
      <div class="td-actions">
        <button class="cs-btn" style="padding:4px 10px;font-size:12px;border:1px solid #2c4351;color:#adc0cc" data-edit-tool="${p.id}">${T.bendEdit}</button>
        <button class="cs-btn cs-btn-danger" style="padding:4px 10px;font-size:12px" data-del-tool="${p.id}">${T.bendDelete}</button>
      </div>
    </div>`).join('') : `<div class="cs-bend-empty">${T.toolEmptyPunches}</div>`;

  document.querySelectorAll('[data-edit-tool]').forEach(b => b.addEventListener('click', () => {
    const t = toolingState.find(x => x.id === Number(b.dataset.editTool));
    if (t) openToolForm(t.tool_type, t.id);
  }));
  document.querySelectorAll('[data-del-tool]').forEach(b => b.addEventListener('click', () => confirmDeleteTool(Number(b.dataset.delTool))));
}

function populatePresetOptions(type) {
  const sel = document.getElementById('tf-preset');
  const presets = type === 'die' ? DIE_PRESETS : PUNCH_PRESETS;
  sel.innerHTML = `<option value="">${T.toolPresetNone}</option>` + presets.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('');
}

function applyPreset() {
  const idx = document.getElementById('tf-preset').value;
  if (idx === '') return;
  const presets = editingToolType === 'die' ? DIE_PRESETS : PUNCH_PRESETS;
  const p = presets[Number(idx)];
  if (!p) return;
  const g = s => document.getElementById(s);
  g('tf-name').value = p.name;
  if (editingToolType === 'die') {
    g('tf-vopen').value = mmToInStr(p.v_opening_mm);
    g('tf-dieangle').value = p.die_angle_deg ?? '';
  } else {
    g('tf-prad').value = mmToInStr(p.punch_radius_mm);
    g('tf-pangle').value = p.punch_angle_deg ?? '';
  }
}

function openToolForm(type, id) {
  editingToolType = type; editingToolId = id;
  const t = id ? toolingState.find(x => x.id === id) : null;
  const form = document.getElementById('tool-form');
  form.classList.toggle('is-die', type === 'die');
  form.classList.toggle('is-punch', type === 'punch');
  populatePresetOptions(type);
  const g = s => document.getElementById(s);
  g('tf-preset').value = '';
  g('tf-name').value = t?.name ?? '';
  g('tf-vopen').value = t ? mmToInStr(t.v_opening_mm) : '';
  g('tf-dieangle').value = t?.die_angle_deg ?? (type === 'die' ? 88 : '');
  g('tf-prad').value = t ? mmToInStr(t.punch_radius_mm) : '';
  g('tf-pangle').value = t?.punch_angle_deg ?? (type === 'punch' ? 88 : '');
  g('tf-len').value = t ? mmToInStr(t.length_mm) : '';
  g('tf-ton').value = t?.max_tonnage ?? '';
  g('tf-qty').value = t?.quantity ?? '';
  form.classList.add('open');
  g('tf-name').focus();
}
function closeToolForm() { document.getElementById('tool-form').classList.remove('open'); editingToolId = null; }

async function saveTool() {
  const msg = document.getElementById('tool-msg');
  const btn = document.getElementById('tool-form-save');
  btn.disabled = true; msg.style.display = 'none';
  const v = id => document.getElementById(id).value.trim();
  const numRaw = id => v(id) === '' ? null : Number(v(id));
  const payload = {
    id: editingToolId || undefined,
    tool_type: editingToolType,
    name: v('tf-name') || null,
    v_opening_mm: editingToolType === 'die' ? inToMm(v('tf-vopen')) : null,
    die_angle_deg: editingToolType === 'die' ? numRaw('tf-dieangle') : null,
    punch_radius_mm: editingToolType === 'punch' ? inToMm(v('tf-prad')) : null,
    punch_angle_deg: editingToolType === 'punch' ? numRaw('tf-pangle') : null,
    length_mm: inToMm(v('tf-len')),
    max_tonnage: numRaw('tf-ton'),
    quantity: numRaw('tf-qty')
  };
  try {
    await apiFetch('/api/company/tooling', { method: 'PUT', body: JSON.stringify(payload) });
    toolingState = (await apiFetch('/api/company/tooling')).tooling || [];
    renderTooling(); closeToolForm(); showMsg(msg, T.toolSaved, false);
  } catch (e) { showMsg(msg, e.message || T.bendError, true); }
  finally { btn.disabled = false; }
}

async function confirmDeleteTool(id) {
  if (!confirm(T.toolConfirmDelete)) return;
  const msg = document.getElementById('tool-msg');
  try {
    await apiFetch('/api/company/tooling/' + id, { method: 'DELETE' });
    toolingState = toolingState.filter(t => t.id !== id); renderTooling(); showMsg(msg, T.toolDeleted, false);
  } catch (e) { showMsg(msg, e.message || T.bendError, true); }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function showMsg(el, text, isErr) {
  el.textContent = text; el.classList.toggle('err', isErr); el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}
function showError(root, message) {
  root.innerHTML = `<div class="cs-card" style="margin-top:32px"><p style="color:#f87171">${esc(message)}</p></div>`;
}

// ── Init ────────────────────────────────────────────────────────────────────────
async function init() {
  const root = document.getElementById('company-settings-app');
  if (!root) return;
  try {
    const [capData, bendData, toolData] = await Promise.all([
      apiFetch('/api/company/capabilities'),
      apiFetch('/api/company/bend-params'),
      apiFetch('/api/company/tooling')
    ]);
    for (const c of (capData.capabilities || [])) {
      capState[c.process] = c.enabled;
      if (c.params) capParams[c.process] = c.params;
    }
    bendState = bendData.bend_params || [];
    toolingState = toolData.tooling || [];

    buildPage(root);
    renderCapGrid();
    renderCapParams();
    renderBendTable();
    renderTooling();
  } catch (e) {
    if (e.status === 401) showError(root, T.notLoggedIn);
    else if (e.status === 403 && e.code === 'NO_ORGANIZATION') showError(root, T.noOrg);
    else if (e.status === 403) showError(root, T.accessDenied);
    else showError(root, e.message || 'Error loading settings.');
  }
}

init();
