function plain(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function merge(base, incoming) {
  const out = { ...plain(base) };
  for (const [key, value] of Object.entries(plain(incoming))) {
    if (plain(value) === value && plain(out[key]) === out[key]) out[key] = merge(out[key], value);
    else out[key] = value;
  }
  return out;
}

export async function loadUserPreferences(module, defaults = {}) {
  try {
    const response = await fetch(`/api/preferences?module=${encodeURIComponent(module)}`, {
      credentials:'same-origin', headers:{ accept:'application/json' }, cache:'no-store'
    });
    if (!response.ok) return { ...defaults };
    const data = await response.json().catch(() => ({}));
    return merge(defaults, data.preferences || {});
  } catch {
    return { ...defaults };
  }
}

export async function saveUserPreferences(module, preferences) {
  try {
    const response = await fetch('/api/preferences', {
      method:'PUT',
      credentials:'same-origin',
      headers:{ 'content-type':'application/json', accept:'application/json' },
      body:JSON.stringify({ module, preferences }),
      keepalive:true
    });
    return response.ok;
  } catch { return false; }
}

export function createPreferenceSaver(module, snapshot, delay = 450) {
  let timer = 0;
  let inFlight = false;
  let dirty = false;

  const flush = async () => {
    timer = 0;
    if (inFlight) { dirty = true; return; }
    inFlight = true;
    try { await saveUserPreferences(module, snapshot()); }
    finally {
      inFlight = false;
      if (dirty) { dirty = false; schedule(); }
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };
  schedule.flush = flush;
  addEventListener('pagehide', () => {
    if (!timer && !dirty) return;
    clearTimeout(timer);
    timer = 0;
    // keepalive:true in saveUserPreferences lets the small preference payload finish while navigating away.
    void saveUserPreferences(module, snapshot());
  }, { once:false });
  return schedule;
}
