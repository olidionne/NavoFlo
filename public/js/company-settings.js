// NavoFlo v8.25.0 — Company Settings page (Capacités + Facteur K)
// Handles both FR and EN via window.NAVO_LANG

const FR = (window.NAVO_LANG || 'fr') === 'fr';

const T = FR ? {
  pageTitle: 'Paramètres de compagnie',
  pageDesc: 'Configurez les capacités de fabrication et les paramètres de pliage propres à votre organisation.',
  tabCap: 'Capacités',
  tabBend: 'Facteur K / Pliage',
  capTitle: 'Capacités de fabrication internes',
  capDesc: 'Cochez les procédés que votre entreprise effectue à l'interne. Ces informations seront utilisées pour les décisions acheter / fabriquer.',
  capSave: 'Enregistrer les capacités',
  capSaved: 'Capacités enregistrées.',
  capError: 'Erreur lors de l'enregistrement.',
  bendTitle: 'Table Facteur K par matériau et rayon',
  bendDesc: 'Définissez des règles de facteur K spécifiques à votre entreprise. Ces valeurs remplaceront les valeurs par défaut du STEP dans Navo3D lorsqu\'une correspondance est trouvée.',
  bendAdd: '+ Ajouter une règle',
  bendSave: 'Enregistrer',
  bendCancel: 'Annuler',
  bendDelete: 'Supprimer',
  bendEdit: 'Modifier',
  bendSaved: 'Règle enregistrée.',
  bendDeleted: 'Règle supprimée.',
  bendError: 'Erreur lors de l'enregistrement.',
  bendEmpty: 'Aucune règle K définie. Cliquez « + Ajouter » pour en créer une.',
  bendConfirmDelete: 'Supprimer cette règle de facteur K ?',
  colMat: 'Classe de matériau',
  colThickMin: 'ép. min (mm)',
  colThickMax: 'ép. max (mm)',
  colRadMin: 'R min (mm)',
  colRadMax: 'R max (mm)',
  colK: 'Facteur K',
  colNotes: 'Notes',
  colActions: '',
  matAll: 'Tous matériaux',
  matSoft: 'Doux (aluminium, cuivre)',
  matMedium: 'Intermédiaire (acier doux)',
  matHard: 'Dur (inox, acier haute résistance)',
  accessDenied: 'Accès refusé. Rôle administrateur ou propriétaire requis.',
  notLoggedIn: 'Vous devez être connecté pour accéder à cette page.',
  noOrg: 'Aucune organisation active associée à votre compte.',
  accountNav: [
    { href: '/account/licenses/', label: 'Licences' },
    { href: '/account/company/', label: 'Compagnie', active: true }
  ]
} : {
  pageTitle: 'Company Settings',
  pageDesc: 'Configure your organization\'s manufacturing capabilities and bending parameters.',
  tabCap: 'Capabilities',
  tabBend: 'K-Factor / Bending',
  capTitle: 'Internal Manufacturing Capabilities',
  capDesc: 'Check the processes your company performs in-house. This information will be used for make-vs-buy decisions.',
  capSave: 'Save Capabilities',
  capSaved: 'Capabilities saved.',
  capError: 'Error saving capabilities.',
  bendTitle: 'K-Factor Table by Material and Radius',
  bendDesc: 'Define company-specific K-factor rules. These values will override the STEP defaults in Navo3D when a match is found.',
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
  colThickMin: 'thick min (mm)',
  colThickMax: 'thick max (mm)',
  colRadMin: 'R min (mm)',
  colRadMax: 'R max (mm)',
  colK: 'K-Factor',
  colNotes: 'Notes',
  colActions: '',
  matAll: 'All materials',
  matSoft: 'Soft (aluminum, copper)',
  matMedium: 'Medium (mild steel)',
  matHard: 'Hard (stainless, HSLA)',
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
  waterjet:    FR ? 'Jet d'eau' : 'Waterjet',
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

const MAT_OPTIONS = [
  { value: 'all',    label: T.matAll },
  { value: 'soft',   label: T.matSoft },
  { value: 'medium', label: T.matMedium },
  { value: 'hard',   label: T.matHard }
];

// ── API helpers ─────────────────────────────────────────────────────────────

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

let capState = {};          // { process: boolean }
let bendState = [];         // array of row objects
let editingBendId = null;   // null = new row, number = existing row id

// ── Build UI ─────────────────────────────────────────────────────────────────

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
    </div>

    <!-- Bend params panel -->
    <div class="cs-panel" id="panel-bend">
      <div class="cs-card">
        <div class="cs-card-title">${T.bendTitle}</div>
        <div class="cs-card-desc">${T.bendDesc}</div>
        <div class="cs-bend-toolbar">
          <button class="cs-btn cs-btn-primary" id="bend-add">${T.bendAdd}</button>
        </div>

        <!-- Inline add/edit form -->
        <div class="cs-bend-form" id="bend-form">
          <div class="cs-field">
            <label>${T.colMat}</label>
            <select id="bf-mat">
              ${MAT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
          </div>
          <div class="cs-field">
            <label>${T.colThickMin}</label>
            <input type="number" id="bf-tmin" placeholder="—" min="0" step="0.1">
          </div>
          <div class="cs-field">
            <label>${T.colThickMax}</label>
            <input type="number" id="bf-tmax" placeholder="—" min="0" step="0.1">
          </div>
          <div class="cs-field">
            <label>${T.colRadMin}</label>
            <input type="number" id="bf-rmin" placeholder="—" min="0" step="0.1">
          </div>
          <div class="cs-field">
            <label>${T.colRadMax}</label>
            <input type="number" id="bf-rmax" placeholder="—" min="0" step="0.1">
          </div>
          <div class="cs-field" style="flex:0 1 90px">
            <label>${T.colK} *</label>
            <input type="number" id="bf-k" placeholder="0.40" min="0.2" max="0.8" step="0.01" required>
          </div>
          <div class="cs-field" style="flex:2 1 160px">
            <label>${T.colNotes}</label>
            <input type="text" id="bf-notes" placeholder="">
          </div>
          <div class="cs-form-actions">
            <button class="cs-btn cs-btn-primary" id="bend-form-save">${T.bendSave}</button>
            <button class="cs-btn" id="bend-form-cancel" style="border:1px solid #2c4351;color:#adc0cc">${T.bendCancel}</button>
          </div>
        </div>

        <span class="cs-save-msg" id="bend-msg" style="margin-bottom:10px;display:block"></span>

        <div class="cs-bend-table-wrap" id="bend-table-wrap">
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
    </div>
  `;

  // Tab switching
  root.querySelectorAll('.cs-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.cs-tab').forEach(t => t.classList.remove('active'));
      root.querySelectorAll('.cs-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Capabilities save
  document.getElementById('cap-save').addEventListener('click', saveCapabilities);

  // Bend: add button
  document.getElementById('bend-add').addEventListener('click', () => openBendForm(null));
  document.getElementById('bend-form-cancel').addEventListener('click', closeBendForm);
  document.getElementById('bend-form-save').addEventListener('click', saveBendParam);
}

// ── Capabilities ─────────────────────────────────────────────────────────────

function renderCapGrid() {
  const grid = document.getElementById('cap-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(PROCESSES).map(([key, label]) => {
    const checked = !!capState[key];
    return `<div class="cs-cap-item${checked ? ' checked' : ''}" data-process="${key}">
      <input type="checkbox" id="cap-${key}"${checked ? ' checked' : ''}>
      <label for="cap-${key}">${label}</label>
    </div>`;
  }).join('');

  grid.querySelectorAll('.cs-cap-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return; // native checkbox handles it
      const cb = item.querySelector('input');
      cb.checked = !cb.checked;
      updateCapItem(item, cb.checked);
    });
    item.querySelector('input').addEventListener('change', e => updateCapItem(item, e.target.checked));
  });
}

function updateCapItem(item, checked) {
  const process = item.dataset.process;
  capState[process] = checked;
  item.classList.toggle('checked', checked);
}

async function saveCapabilities() {
  const btn = document.getElementById('cap-save');
  const msg = document.getElementById('cap-msg');
  btn.disabled = true;
  msg.style.display = 'none';
  try {
    const capabilities = Object.entries(capState).map(([process, enabled]) => ({ process, enabled }));
    await apiFetch('/api/company/capabilities', { method: 'PUT', body: JSON.stringify({ capabilities }) });
    showMsg(msg, T.capSaved, false);
  } catch (e) {
    showMsg(msg, e.message || T.capError, true);
  } finally {
    btn.disabled = false;
  }
}

// ── Bend params ───────────────────────────────────────────────────────────────

function matLabel(val) {
  return MAT_OPTIONS.find(o => o.value === val)?.label || val;
}

function renderBendTable() {
  const tbody = document.getElementById('bend-tbody');
  const table = document.getElementById('bend-table');
  const empty = document.getElementById('bend-empty');
  if (!tbody) return;

  if (!bendState.length) {
    table.style.display = 'none';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  table.style.display = '';

  tbody.innerHTML = bendState.map(row => `
    <tr data-id="${row.id}">
      <td class="td-mat">${matLabel(row.material_class)}</td>
      <td>${row.thickness_min_mm ?? '—'}</td>
      <td>${row.thickness_max_mm ?? '—'}</td>
      <td>${row.inner_radius_min_mm ?? '—'}</td>
      <td>${row.inner_radius_max_mm ?? '—'}</td>
      <td class="td-k">${Number(row.k_factor).toFixed(3)}</td>
      <td>${row.notes || ''}</td>
      <td><div class="td-actions">
        <button class="cs-btn" style="padding:4px 10px;font-size:12px;border:1px solid #2c4351;color:#adc0cc" data-edit="${row.id}">${T.bendEdit}</button>
        <button class="cs-btn cs-btn-danger" style="padding:4px 10px;font-size:12px" data-del="${row.id}">${T.bendDelete}</button>
      </div></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openBendForm(Number(btn.dataset.edit)));
  });
  tbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteBend(Number(btn.dataset.del)));
  });
}

function openBendForm(id) {
  editingBendId = id;
  const form = document.getElementById('bend-form');
  const row = id ? bendState.find(r => r.id === id) : null;

  const get = (sel) => document.getElementById(sel);
  get('bf-mat').value   = row?.material_class ?? 'all';
  get('bf-tmin').value  = row?.thickness_min_mm ?? '';
  get('bf-tmax').value  = row?.thickness_max_mm ?? '';
  get('bf-rmin').value  = row?.inner_radius_min_mm ?? '';
  get('bf-rmax').value  = row?.inner_radius_max_mm ?? '';
  get('bf-k').value     = row?.k_factor ?? '';
  get('bf-notes').value = row?.notes ?? '';

  form.classList.add('open');
  get('bf-k').focus();
}

function closeBendForm() {
  document.getElementById('bend-form').classList.remove('open');
  editingBendId = null;
}

async function saveBendParam() {
  const msg = document.getElementById('bend-msg');
  const btn = document.getElementById('bend-form-save');
  btn.disabled = true;
  msg.style.display = 'none';

  const val = (id) => document.getElementById(id).value.trim();
  const num = (id) => { const v = val(id); return v === '' ? null : Number(v); };

  const payload = {
    id: editingBendId || undefined,
    material_class: val('bf-mat'),
    thickness_min_mm: num('bf-tmin'),
    thickness_max_mm: num('bf-tmax'),
    inner_radius_min_mm: num('bf-rmin'),
    inner_radius_max_mm: num('bf-rmax'),
    k_factor: num('bf-k'),
    notes: val('bf-notes') || null
  };

  try {
    const res = await apiFetch('/api/company/bend-params', { method: 'PUT', body: JSON.stringify(payload) });
    // Reload bend params
    const fresh = await apiFetch('/api/company/bend-params');
    bendState = fresh.bend_params || [];
    renderBendTable();
    closeBendForm();
    showMsg(msg, T.bendSaved, false);
  } catch (e) {
    showMsg(msg, e.message || T.bendError, true);
  } finally {
    btn.disabled = false;
  }
}

async function confirmDeleteBend(id) {
  if (!confirm(T.bendConfirmDelete)) return;
  const msg = document.getElementById('bend-msg');
  try {
    await apiFetch('/api/company/bend-params/' + id, { method: 'DELETE' });
    bendState = bendState.filter(r => r.id !== id);
    renderBendTable();
    showMsg(msg, T.bendDeleted, false);
  } catch (e) {
    showMsg(msg, e.message || T.bendError, true);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showMsg(el, text, isErr) {
  el.textContent = text;
  el.classList.toggle('err', isErr);
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function showError(root, message) {
  root.innerHTML = `<div class="cs-card" style="margin-top:32px"><p style="color:#f87171">${message}</p></div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const root = document.getElementById('company-settings-app');
  if (!root) return;

  try {
    const [capData, bendData] = await Promise.all([
      apiFetch('/api/company/capabilities'),
      apiFetch('/api/company/bend-params')
    ]);

    for (const c of (capData.capabilities || [])) {
      capState[c.process] = c.enabled;
    }
    bendState = bendData.bend_params || [];

    buildPage(root);
    renderCapGrid();
    renderBendTable();

  } catch (e) {
    if (e.status === 401) showError(root, T.notLoggedIn);
    else if (e.status === 403 && e.code === 'NO_ORGANIZATION') showError(root, T.noOrg);
    else if (e.status === 403) showError(root, T.accessDenied);
    else showError(root, e.message || 'Error loading settings.');
  }
}

init();
