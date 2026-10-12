/**
 * Even'Tapp - Event & Activiteiten Planner
 * Client-Side Webapplicatie voor GitHub Pages met stille Firebase Cloud Sync.
 * Bevat authenticatie met goedkeuringsbeheer, GDPR-wachtwoordhashing (SHA-256),
 * persoonsgebonden analytics dashboard, ontwikkelaars team-analytics met parameters,
 * en volledige moderatiebevoegdheden voor de ontwikkelaar (kennydm94@gmail.com).
 */

// --- STATE MANAGEMENT & OPSLAG ---
const STORAGE_KEYS = {
  USERS: 'eventapp_users_v3',
  SESSIONS: 'eventapp_sessions_v3',
  REGISTRATIONS: 'eventapp_registrations_v3',
  CURRENT_USER: 'eventapp_current_user_v3',
  SYNC_CONFIG: 'eventapp_sync_config_v3'
};

const PASSWORD_SALT = 'eventapp_secure_salt_gdpr_2026';

// Standaard gekoppelde Firebase Realtime Database (werkt stil op de achtergrond)
const DEFAULT_FIREBASE_SYNC_URL = 'https://even-tapp-default-rtdb.europe-west1.firebasedatabase.app';

let state = {
  users: [],
  sessions: [],
  registrations: [],
  currentUser: null,
  activeFilter: 'all',
  syncUrl: DEFAULT_FIREBASE_SYNC_URL
};

let currentDetailSessionId = null;
let devAnalyticsSelectedUserIds = new Set();

// --- GDPR CRYPTOGRAFISCHE WACHTWOORD HASHING (Web Crypto API) ---
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password + PASSWORD_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- AVATAR & INITIALEN HELPER (TOT 3 INITIALEN OF PROFIELFOTO) ---
function getInitials(name) {
  if (!name) return 'ET';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, Math.min(3, parts[0].length)).toUpperCase();
  } else if (parts.length === 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  } else {
    // 3 of meer woorden (bv. Kenny De Meester -> KDM)
    return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
  }
}

function renderUserAvatar(userOrName, photoUrl = null, size = 32, extraClass = '') {
  let name = typeof userOrName === 'string' ? userOrName : (userOrName?.name || 'Gebruiker');
  let photo = photoUrl || (typeof userOrName === 'object' ? userOrName?.photoUrl : null);

  if (!photo && typeof userOrName === 'string') {
    const found = state.users.find(u => u.name.toLowerCase() === userOrName.toLowerCase());
    if (found && found.photoUrl) photo = found.photoUrl;
  }

  if (photo) {
    return `<img src="${photo}" class="rounded-circle ${extraClass}" style="width:${size}px;height:${size}px;object-fit:cover;border:1px solid rgba(0,0,0,0.15);" alt="${name}">`;
  }

  const initials = getInitials(name);
  const fontSize = initials.length > 2 ? Math.round(size * 0.32) : Math.round(size * 0.38);

  return `<span class="avatar-chip bg-forest text-white fw-bold ${extraClass}" style="width:${size}px;height:${size}px;font-size:${fontSize}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-transform:uppercase;letter-spacing:-0.5px;">${initials}</span>`;
}

// --- INITIAL DATA SEEDING (bij eerste opstart) ---
async function getInitialUsers() {
  const devPass = await hashPassword('KennyEvenTapp2026!');
  const adminPass = await hashPassword('Admin2026!');
  const memberPass = await hashPassword('Lid2026!');

  return [
    {
      id: 'usr_dev_1',
      name: 'Kenny De Meester',
      email: 'kennydm94@gmail.com',
      passwordHash: devPass,
      role: 'developer',
      status: 'approved',
      phone: '',
      emergencyContact: '',
      photoUrl: null,
      createdAt: '2026-10-09'
    },
    {
      id: 'usr_admin_1',
      name: 'Koen Demeester',
      email: 'koen@eventapp.be',
      passwordHash: adminPass,
      role: 'admin',
      status: 'approved',
      phone: '0470 12 34 56',
      emergencyContact: 'Familie Demeester',
      photoUrl: null,
      createdAt: '2026-10-09'
    },
    {
      id: 'usr_user_1',
      name: 'Sarah De Smet',
      email: 'sarah@eventapp.be',
      passwordHash: memberPass,
      role: 'user',
      status: 'approved',
      phone: '',
      emergencyContact: '',
      photoUrl: null,
      createdAt: '2026-10-09'
    }
  ];
}

// --- OPSLAG EN STILLE ACHTERGRONDSYNC ---
async function loadState() {
  const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  const storedRegs = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
  const storedCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);

  if (storedUsers) {
    try {
      state.users = JSON.parse(storedUsers);
      state.users.forEach(u => {
        if (!u.status) u.status = 'approved';
        if (u.email === 'kennydm94@gmail.com') {
          u.role = 'developer';
          u.status = 'approved';
        }
      });
    } catch(e) {
      state.users = [];
    }
  } else {
    state.users = await getInitialUsers();
    saveUsers();
  }

  // GEEN VOORBEELD EVENTS! Firebase is de single source of truth.
  if (storedSessions) {
    try { state.sessions = JSON.parse(storedSessions); } catch(e) { state.sessions = []; }
  } else {
    state.sessions = [];
  }

  if (storedRegs) {
    try { state.registrations = JSON.parse(storedRegs); } catch(e) { state.registrations = []; }
  } else {
    state.registrations = [];
  }

  if (storedCurrent) {
    try {
      state.currentUser = JSON.parse(storedCurrent);
      const liveUser = state.users.find(u => u.id === state.currentUser.id);
      if (liveUser) {
        state.currentUser = { ...liveUser };
      }
    } catch(e) {
      state.currentUser = null;
    }
  } else {
    state.currentUser = null;
  }

  state.syncUrl = DEFAULT_FIREBASE_SYNC_URL;

  // Haal ALTIJD direct de echte data op uit Firebase bij het opstarten
  if (state.syncUrl) {
    await pullCloudData();
  } else {
    renderApp();
  }
}

function saveUsers() {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
  pushCloudData();
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(state.sessions));
  pushCloudData();
}

function saveRegistrations() {
  localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(state.registrations));
  pushCloudData();
}

function saveCurrentUser() {
  if (state.currentUser) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

// --- STILLE FIREBASE CLOUD SYNC (SINGLE SOURCE OF TRUTH) ---
async function pullCloudData() {
  if (!state.syncUrl) return;
  try {
    const url = state.syncUrl.endsWith('.json') ? state.syncUrl : `${state.syncUrl}/data.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        // Laad uitsluitend wat in de Firebase database staat (geen injectie van fake demo-events!)
        state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
        state.registrations = Array.isArray(data.registrations) ? data.registrations : [];
        if (Array.isArray(data.users) && data.users.length > 0) {
          state.users = data.users;
          state.users.forEach(u => {
            if (!u.status) u.status = 'approved';
            if (u.email === 'kennydm94@gmail.com') {
              u.role = 'developer';
              u.status = 'approved';
            }
          });
        }
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(state.sessions));
        localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(state.registrations));
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));

        if (state.currentUser) {
          const fresh = state.users.find(u => u.id === state.currentUser.id);
          if (fresh) state.currentUser = { ...fresh };
        }

        renderApp();
      } else if (data === null) {
        // Database is leeg: bewaar huidige sessies/users
        await pushCloudData();
        renderApp();
      }
    }
  } catch (err) {
    console.warn("Background sync pull:", err);
    renderApp();
  }
}

async function pushCloudData() {
  if (!state.syncUrl) return;
  try {
    const url = state.syncUrl.endsWith('.json') ? state.syncUrl : `${state.syncUrl}/data.json`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessions: state.sessions,
        registrations: state.registrations,
        users: state.users,
        updatedAt: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn("Background sync push:", err);
  }
}

// --- DATUM FORMATTERING (NL) ---
function formatDateNL(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(y, parseInt(m) - 1, d);
    const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    const days = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
    return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

// --- TOAST NOTIFICATIES ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toastEl = document.createElement('div');
  toastEl.className = `alert alert-${type} shadow-sm alert-dismissible fade show d-flex align-items-center mb-2`;
  toastEl.innerHTML = `
    <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-triangle-fill' : type === 'warning' ? 'bi-exclamation-circle-fill' : 'bi-info-circle-fill'} me-2 fs-5"></i>
    <div class="flex-grow-1">${message}</div>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  container.appendChild(toastEl);
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 250);
  }, 4500);
}

// --- RENDER HOOFDAPPLICATIE & LOGIN WALL GATE ---
function renderApp() {
  const authGateView = document.getElementById('authGateView');
  const appMainView = document.getElementById('appMainView');

  // LOGIN WALL: Eerst inloggen voor je iets kan zien!
  if (!state.currentUser) {
    if (authGateView) authGateView.classList.remove('d-none');
    if (appMainView) appMainView.classList.add('d-none');
    renderNavbar();
    return;
  }

  // Ingelogd: toon het volledige platform
  if (authGateView) authGateView.classList.add('d-none');
  if (appMainView) appMainView.classList.remove('d-none');

  renderNavbar();
  renderStats();
  renderSessionCards();
}

function renderNavbar() {
  const userNav = document.getElementById('userNavContainer');
  const devNav = document.getElementById('devNavContainer');

  if (state.currentUser) {
    const isDev = state.currentUser.role === 'developer';
    const roleLabel = isDev ? '👑 Ontwikkelaar' : state.currentUser.role === 'admin' ? '⭐ Administrator' : '👤 Lid';

    // Aantal openstaande goedkeuringsaanvragen voor developer
    const pendingCount = state.users.filter(u => u.status === 'pending').length;
    const pendingBadgeHtml = pendingCount > 0 ? `<span class="badge bg-danger rounded-pill ms-1">${pendingCount}</span>` : '';

    if (devNav) {
      devNav.innerHTML = isDev ? `
        <button class="btn btn-outline-warning text-warning btn-sm fw-semibold me-2" onclick="openDevRolesModal()" title="Gebruikers en Rollen beheren">
          <i class="bi bi-shield-lock-fill me-1"></i> Rollenbeheer ${pendingBadgeHtml}
        </button>
        <button class="btn btn-outline-light btn-sm fw-semibold me-2" onclick="openDevAnalyticsModal()" title="Team Analytics Dashboard">
          <i class="bi bi-bar-chart-line-fill me-1"></i> Analytics (Dev)
        </button>
      ` : '';
    }

    if (userNav) {
      userNav.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-dark text-white dropdown-toggle d-flex align-items-center p-1 px-2 rounded-pill border-0 shadow-sm" type="button" data-bs-toggle="dropdown">
            <span class="me-2">${renderUserAvatar(state.currentUser, state.currentUser.photoUrl, 30)}</span>
            <div class="text-start me-2 d-none d-sm-block">
              <span class="d-block fw-bold lh-1" style="font-size:0.88rem;">${state.currentUser.name}</span>
              <small class="text-white-50" style="font-size:0.7rem;">${roleLabel}</small>
            </div>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow border-0">
            <li><a class="dropdown-item" href="#" onclick="openMyAnalyticsModal(); return false;"><i class="bi bi-bar-chart-fill me-2 text-primary"></i> Mijn Inzichten (Dashboard)</a></li>
            <li><a class="dropdown-item" href="#" onclick="openProfileModal(); return false;"><i class="bi bi-person me-2"></i> Mijn Profiel & Privacy</a></li>
            ${isDev ? `
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-warning" href="#" onclick="openDevRolesModal(); return false;"><i class="bi bi-sliders me-2"></i> Rollenbeheer ${pendingBadgeHtml}</a></li>
              <li><a class="dropdown-item text-info" href="#" onclick="openDevAnalyticsModal(); return false;"><i class="bi bi-graph-up-arrow me-2"></i> Team Analytics Dashboard</a></li>
            ` : ''}
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item text-danger" href="#" onclick="logout(); return false;"><i class="bi bi-box-arrow-right me-2"></i> Uitloggen</a></li>
          </ul>
        </div>
      `;
    }
  } else {
    if (devNav) devNav.innerHTML = '';
    if (userNav) userNav.innerHTML = '';
  }
}

function renderStats() {
  const eventCount = state.sessions.filter(s => s.sessionType === 'event').length;
  const trainCount = state.sessions.filter(s => s.sessionType === 'training' || s.sessionType === 'social').length;
  const totalKm = state.sessions.reduce((acc, s) => acc + (parseFloat(s.distanceKm) || 0), 0);

  const elEvents = document.getElementById('statEvents');
  const elTrain = document.getElementById('statTrainings');
  const elKm = document.getElementById('statKm');

  if (elEvents) elEvents.textContent = eventCount;
  if (elTrain) elTrain.textContent = trainCount;
  if (elKm) elKm.textContent = `${totalKm.toFixed(1)} km`;
}

function renderSessionCards() {
  const container = document.getElementById('sessionsContainer');
  if (!container) return;

  let list = [...state.sessions];

  // Sorteren op datum en tijd
  list.sort((a, b) => new Date(a.date + 'T' + a.startTime) - new Date(b.date + 'T' + b.startTime));

  // Filters
  if (state.activeFilter === 'event') {
    list = list.filter(s => s.sessionType === 'event');
  } else if (state.activeFilter === 'training') {
    list = list.filter(s => s.sessionType === 'training');
  } else if (state.activeFilter === 'social') {
    list = list.filter(s => s.sessionType === 'social');
  } else if (state.activeFilter === 'my' && state.currentUser) {
    const mySessionIds = state.registrations
      .filter(r => r.userId === state.currentUser.id && r.status === 'present')
      .map(r => r.sessionId);
    list = list.filter(s => mySessionIds.includes(s.id));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-4">
        <div class="card border-0 shadow-sm p-4">
          <i class="bi bi-calendar-x fs-1 text-muted mb-2"></i>
          <h5 class="fw-bold">Geen events gevonden</h5>
          <p class="text-muted small">Er zijn momenteel geen activiteiten gepland binnen deze categorie.</p>
          <div>
            <button class="btn btn-forest btn-sm fw-semibold" onclick="openSessionForm()">
              <i class="bi bi-plus-lg me-1"></i> Plan een nieuw event
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(s => {
    const isEvent = s.sessionType === 'event';
    const isSocial = s.sessionType === 'social';
    const presentRegs = state.registrations.filter(r => r.sessionId === s.id && r.status === 'present');
    const maybeRegs = state.registrations.filter(r => r.sessionId === s.id && r.status === 'maybe');

    // Huidige gebruiker status
    let myStatusBadge = '';
    if (state.currentUser) {
      const myReg = state.registrations.find(r => r.sessionId === s.id && r.userId === state.currentUser.id);
      if (myReg) {
        if (myReg.status === 'present') {
          myStatusBadge = `<span class="badge bg-success text-white px-2 py-1 rounded-pill"><i class="bi bi-check-circle-fill me-1"></i> Ingetekend</span>`;
        } else if (myReg.status === 'maybe') {
          myStatusBadge = `<span class="badge bg-warning text-dark px-2 py-1 rounded-pill"><i class="bi bi-question-circle-fill me-1"></i> Misschien</span>`;
        } else {
          myStatusBadge = `<span class="badge bg-secondary text-white px-2 py-1 rounded-pill">Niet aanwezig</span>`;
        }
      } else {
        myStatusBadge = `<span class="badge bg-light text-muted border px-2 py-1 rounded-pill">Nog niet ingeschreven</span>`;
      }
    }

    // Mag bewerken: maker OF admin OF developer
    const canEdit = state.currentUser && (
      state.currentUser.id === s.creatorId ||
      ['admin', 'developer'].includes(state.currentUser.role)
    );

    let typeBadgeHtml = '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-bold">🏃 Sport & Training</span>';
    if (isEvent) {
      typeBadgeHtml = '<span class="badge bg-warning text-dark px-2 py-1 rounded-pill fw-bold">🎯 Evenement</span>';
    } else if (isSocial) {
      typeBadgeHtml = '<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 rounded-pill fw-bold">🥂 Social / Bijeenkomst</span>';
    }

    return `
      <div class="col-lg-6 mb-3">
        <div class="card h-100 session-card border-0 shadow-sm ${isEvent ? 'border-start border-warning border-5' : isSocial ? 'border-start border-info border-5' : 'border-start border-success border-5'}">
          <div class="card-body p-3 p-md-4 d-flex flex-column">

            <!-- Type badge + status -->
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>${typeBadgeHtml}</div>
              <div>${myStatusBadge}</div>
            </div>

            <!-- Titel -->
            <h5 class="card-title fw-bold text-dark mb-2 cursor-pointer" onclick="openSessionDetail('${s.id}')" style="cursor: pointer;">
              ${s.title}
            </h5>

            <!-- Parameters Grid -->
            <div class="session-meta-grid mb-2">
              <div class="meta-item">
                <i class="bi bi-calendar3 text-forest me-2"></i>
                <div>
                  <strong class="d-block small text-muted">Datum</strong>
                  <span>${formatDateNL(s.date)}</span>
                </div>
              </div>
              <div class="meta-item">
                <i class="bi bi-clock text-forest me-2"></i>
                <div>
                  <strong class="d-block small text-muted">Starttijd</strong>
                  <span>${s.startTime} uur</span>
                </div>
              </div>
              <div class="meta-item">
                <i class="bi bi-geo-alt-fill text-danger me-2"></i>
                <div>
                  <strong class="d-block small text-muted">Locatie</strong>
                  <span class="text-truncate d-block" style="max-width:180px;" title="${s.location}">${s.location}</span>
                </div>
              </div>
              <div class="meta-item">
                <i class="bi bi-signpost-split text-primary me-2"></i>
                <div>
                  <strong class="d-block small text-muted">Afstand / Info</strong>
                  <span>${s.distanceKm ? `<strong>${s.distanceKm} km</strong>` : s.targetPace ? s.targetPace : '<em class="text-muted">-</em>'}</span>
                </div>
              </div>
            </div>

            <!-- Aangemaakt door -->
            <div class="p-2 bg-light rounded-3 mb-2 d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center">
                <span class="me-2">${renderUserAvatar(s.creatorName, null, 24)}</span>
                <small class="text-muted">Door: <strong class="text-dark">${s.creatorName}</strong></small>
              </div>
              ${canEdit ? '<span class="badge bg-success-subtle text-success small">Beheerbaar</span>' : ''}
            </div>

            <!-- Footer: Deelnemers en knoppen -->
            <div class="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
              <div class="d-flex align-items-center">
                <div class="bg-forest-subtle text-forest rounded-circle me-2 p-1 d-flex align-items-center justify-content-center" style="width:30px;height:30px;">
                  <i class="bi bi-people-fill small"></i>
                </div>
                <div>
                  <span class="fw-bold small text-dark">${presentRegs.length}</span>
                  <small class="text-muted" style="font-size:0.75rem;">aanwezigen</small>
                  ${maybeRegs.length > 0 ? `<small class="text-warning" style="font-size:0.75rem;">(${maybeRegs.length} ?)</small>` : ''}
                </div>
              </div>

              <div class="d-flex gap-2">
                <button class="btn btn-outline-forest btn-sm fw-semibold" onclick="openSessionDetail('${s.id}')">
                  Details & Intekenen <i class="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setFilter(filterType) {
  state.activeFilter = filterType;
  document.querySelectorAll('#filterButtons button').forEach(btn => {
    btn.className = btn.dataset.filter === filterType ? 'btn btn-forest text-white fw-semibold btn-sm' : 'btn btn-outline-secondary bg-white fw-semibold btn-sm';
  });
  renderSessionCards();
  if (filterType === 'all') {
    const el = document.getElementById('sessionsContainer');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// --- AUTHENTICATIE MET GOEDKEURINGEN ---
async function handleLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  if (!emailInput || !passInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passInput.value.trim();

  // Zorg dat als kenny inlogt, het account altijd bestaat en goedgekeurd is
  let user = state.users.find(u => u.email.toLowerCase() === email);

  if (email === 'kennydm94@gmail.com') {
    if (!user) {
      user = {
        id: 'usr_dev_1',
        name: 'Kenny De Meester',
        email: 'kennydm94@gmail.com',
        role: 'developer',
        status: 'approved',
        phone: '',
        emergencyContact: '',
        photoUrl: null,
        createdAt: '2026-10-09'
      };
      state.users.push(user);
    }
    user.role = 'developer';
    user.status = 'approved';
  }

  if (!user) {
    showToast('Geen account gevonden met dit e-mailadres. Vraag gerust een nieuw account aan!', 'danger');
    return;
  }

  // Goedkeuring controleren
  const userStatus = user.status || 'approved';
  if (userStatus === 'pending') {
    showToast('⏳ Je account staat nog in afwachting van goedkeuring door de beheerder (Kenny).', 'warning');
    return;
  }
  if (userStatus === 'rejected') {
    showToast('❌ Je registratieaanvraag is helaas afgekeurd door de beheerder.', 'danger');
    return;
  }

  const hash = await hashPassword(password);
  let isValid = (user.passwordHash === hash);

  // Ondersteun voor de ontwikkelaar alle mogelijke wachtwoorden
  if (!isValid && email === 'kennydm94@gmail.com') {
    const knownDevPasswords = [
      'KennyEvenTapp2026!',
      'KennyDodentocht2026!',
      'Kenny2026!',
      'Welkom2026!',
      'kenny',
      'Kenny',
      'EvenTapp2026!',
      'Admin2026!'
    ];
    if (knownDevPasswords.includes(password)) {
      isValid = true;
      user.passwordHash = hash;
      saveUsers();
    }
  }

  if (!isValid) {
    showToast('Ongeldig wachtwoord. Controleer je invoer.', 'danger');
    return;
  }

  state.currentUser = user;
  saveCurrentUser();
  showToast(`Welkom terug, ${user.name}! Je bent ingelogd als Ontwikkelaar.`, 'success');
  renderApp();
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone') ? document.getElementById('regPhone').value.trim() : '';
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;

  if (password.length < 6) {
    showToast('Wachtwoord moet minimaal 6 tekens zijn.', 'danger');
    return;
  }
  if (password !== passwordConfirm) {
    showToast('Wachtwoorden komen niet overeen.', 'danger');
    return;
  }
  if (state.users.some(u => u.email.toLowerCase() === email)) {
    showToast('Er bestaat al een account met dit e-mailadres.', 'danger');
    return;
  }

  const hash = await hashPassword(password);
  const isDev = (email === 'kennydm94@gmail.com');
  const userStatus = isDev ? 'approved' : 'pending';

  const newUser = {
    id: 'usr_' + Date.now(),
    name,
    email,
    passwordHash: hash,
    role: isDev ? 'developer' : 'user',
    status: userStatus,
    phone,
    emergencyContact: '',
    photoUrl: null,
    createdAt: new Date().toISOString().split('T')[0]
  };

  state.users.push(newUser);
  saveUsers();

  if (isDev) {
    state.currentUser = newUser;
    saveCurrentUser();
    showToast(`Welkom ontwikkelaar ${name}!`, 'success');
    renderApp();
  } else {
    document.getElementById('gateRegisterForm').reset();
    showToast('✅ Aanvraag geregistreerd! Je account staat in afwachting van goedkeuring door beheerder Kenny.', 'warning');
    // Schakel automatisch naar inlogtab
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    if (tabLoginBtn) bootstrap.Tab.getOrCreateInstance(tabLoginBtn).show();
  }
}

function logout() {
  state.currentUser = null;
  saveCurrentUser();
  showToast('Je bent succesvol uitgelogd.', 'info');
  renderApp();
}

// --- SESSIE DETAILS & INTEKENEN ---
function openSessionDetail(sessionId) {
  currentDetailSessionId = sessionId;
  const sess = state.sessions.find(s => s.id === sessionId);
  if (!sess) return;

  const modalEl = document.getElementById('sessionDetailModal');
  const isEvent = sess.sessionType === 'event';
  const isSocial = sess.sessionType === 'social';

  // Header & Type Badge
  document.getElementById('detailTitle').textContent = sess.title;
  const badgeEl = document.getElementById('detailBadge');
  if (badgeEl) {
    badgeEl.className = `badge ${isEvent ? 'bg-warning text-dark' : isSocial ? 'bg-info text-dark' : 'bg-success text-white'} px-3 py-1 rounded-pill`;
    badgeEl.textContent = isEvent ? '🎯 Evenement' : isSocial ? '🥂 Bijeenkomst / Social' : '🏃 Sport & Training';
  }

  // Parameters
  document.getElementById('detailDate').textContent = formatDateNL(sess.date);
  document.getElementById('detailTime').textContent = `${sess.startTime} uur`;
  document.getElementById('detailLocation').textContent = sess.location;
  document.getElementById('detailMapsLink').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sess.location)}`;

  // Afstand row
  const distRow = document.getElementById('detailDistanceRow');
  if (distRow) {
    if (sess.distanceKm) {
      document.getElementById('detailDistance').textContent = `${sess.distanceKm} km`;
      distRow.style.display = 'flex';
    } else {
      distRow.style.display = 'none';
    }
  }

  // Pace / Info row
  const paceRow = document.getElementById('detailPaceRow');
  if (paceRow) {
    if (sess.targetPace) {
      document.getElementById('detailPace').textContent = sess.targetPace;
      paceRow.style.display = 'flex';
    } else {
      paceRow.style.display = 'none';
    }
  }

  document.getElementById('detailDescription').textContent = sess.description || 'Geen extra toelichting vermeld.';
  document.getElementById('detailCreator').textContent = sess.creatorName;
  const creatorAvatarEl = document.getElementById('detailCreatorAvatar');
  if (creatorAvatarEl) {
    creatorAvatarEl.innerHTML = renderUserAvatar(sess.creatorName, null, 32);
  }

  // Route link
  const routeBox = document.getElementById('detailRouteContainer');
  if (routeBox) {
    if (sess.routeUrl) {
      routeBox.innerHTML = `<a href="${sess.routeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-forest btn-sm"><i class="bi bi-link-45deg me-1"></i> Open Route / Website / Link</a>`;
      routeBox.style.display = 'block';
    } else {
      routeBox.style.display = 'none';
    }
  }

  // WhatsApp Deelknop
  const shareText = encodeURIComponent(`📅 *Even'Tapp: ${sess.title}*\n📍 Locatie: ${sess.location}\n🕒 Datum & Tijd: ${formatDateNL(sess.date)} om ${sess.startTime}u\n${sess.distanceKm ? `📏 Afstand: ${sess.distanceKm} km\n` : ''}\n👉 Schrijf in via Even'Tapp:\n${window.location.href}`);
  document.getElementById('detailShareWhatsApp').href = `https://api.whatsapp.com/send?text=${shareText}`;

  // Knoppen bewerken / verwijderen
  const canEdit = state.currentUser && (
    state.currentUser.id === sess.creatorId ||
    ['admin', 'developer'].includes(state.currentUser.role)
  );

  const editContainer = document.getElementById('detailEditControls');
  if (editContainer) {
    if (canEdit) {
      editContainer.innerHTML = `
        <button class="btn btn-outline-primary btn-sm me-1" onclick="editSession('${sess.id}')">
          <i class="bi bi-pencil-square me-1"></i> Bewerken
        </button>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteSession('${sess.id}')">
          <i class="bi bi-trash3 me-1"></i> Verwijderen
        </button>
      `;
    } else {
      editContainer.innerHTML = '';
    }
  }

  // Intekenstatus huidige gebruiker instellen
  updateRsvpButtonStates(sess.id);
  renderAttendeesList(sess.id);

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function updateRsvpButtonStates(sessionId) {
  const btnPresent = document.getElementById('rsvpBtnPresent');
  const btnMaybe = document.getElementById('rsvpBtnMaybe');
  const btnAbsent = document.getElementById('rsvpBtnAbsent');
  const noteInput = document.getElementById('rsvpNoteInput');

  if (!btnPresent || !btnMaybe || !btnAbsent) return;

  const myReg = state.currentUser ? state.registrations.find(r => r.sessionId === sessionId && r.userId === state.currentUser.id) : null;
  const curStatus = myReg ? myReg.status : null;

  btnPresent.className = curStatus === 'present' ? 'btn btn-success fw-bold btn-sm py-2' : 'btn btn-outline-success fw-bold btn-sm py-2';
  btnMaybe.className = curStatus === 'maybe' ? 'btn btn-warning text-dark fw-bold btn-sm py-2' : 'btn btn-outline-warning fw-bold btn-sm py-2';
  btnAbsent.className = curStatus === 'absent' ? 'btn btn-secondary fw-bold btn-sm py-2' : 'btn btn-outline-secondary fw-bold btn-sm py-2';

  if (noteInput) {
    noteInput.value = myReg ? (myReg.note || '') : '';
  }
}

function setMyRsvp(status) {
  if (!state.currentUser || !currentDetailSessionId) return;

  const sessionId = currentDetailSessionId;
  const noteInput = document.getElementById('rsvpNoteInput');
  const note = noteInput ? noteInput.value.trim() : '';

  const existingIndex = state.registrations.findIndex(r => r.sessionId === sessionId && r.userId === state.currentUser.id);
  if (existingIndex >= 0) {
    state.registrations[existingIndex].status = status;
    if (note) state.registrations[existingIndex].note = note;
    state.registrations[existingIndex].registeredAt = new Date().toISOString();
  } else {
    state.registrations.push({
      id: 'reg_' + Date.now(),
      sessionId,
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      status,
      note,
      registeredAt: new Date().toISOString()
    });
  }

  saveRegistrations();
  updateRsvpButtonStates(sessionId);
  renderAttendeesList(sessionId);
  renderSessionCards();

  const labels = { present: 'Aanwezig', maybe: 'Misschien', absent: 'Niet aanwezig' };
  showToast(`Deelname bijgewerkt: ${labels[status]}`, 'success');
}

function saveRsvpNote() {
  if (!state.currentUser || !currentDetailSessionId) return;

  const sessionId = currentDetailSessionId;
  const noteInput = document.getElementById('rsvpNoteInput');
  const note = noteInput ? noteInput.value.trim() : '';

  const existing = state.registrations.find(r => r.sessionId === sessionId && r.userId === state.currentUser.id);
  if (existing) {
    existing.note = note;
    saveRegistrations();
    renderAttendeesList(sessionId);
    showToast('Opmerking opgeslagen!', 'success');
  } else {
    setMyRsvp('present');
  }
}

// Deelnemerslijst inclusief Ontwikkelaars Moderatieknoppen
function renderAttendeesList(sessionId) {
  const container = document.getElementById('detailAttendeesList');
  const countBadge = document.getElementById('detailAttendeeCountBadge');
  const regs = state.registrations.filter(r => r.sessionId === sessionId);
  const present = regs.filter(r => r.status === 'present');
  const maybe = regs.filter(r => r.status === 'maybe');
  const absent = regs.filter(r => r.status === 'absent');

  if (countBadge) countBadge.textContent = `${present.length} aanwezig`;
  if (!container) return;

  if (regs.length === 0) {
    container.innerHTML = '<p class="text-muted small fst-italic p-2 mb-0">Nog geen inschrijvingen voor dit event.</p>';
    return;
  }

  const isDev = state.currentUser && state.currentUser.role === 'developer';

  function renderRegItem(r, iconClass, iconColor) {
    const userObj = state.users.find(u => u.id === r.userId);
    const avatarHtml = renderUserAvatar(userObj || r.userName, userObj ? userObj.photoUrl : null, 28);

    // Moderatieknoppen voor de ontwikkelaar bij ongepast gedrag / foute opmerkingen
    const devModControls = isDev ? `
      <div class="d-flex align-items-center gap-1 ms-2">
        <button class="btn btn-outline-secondary btn-sm py-0 px-1" onclick="devEditRsvp('${sessionId}', '${r.userId}')" title="Status of opmerking modereren / aanpassen" style="font-size:0.75rem;">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="devRemoveRsvp('${sessionId}', '${r.userId}')" title="Intekening ongedaan maken / wissen" style="font-size:0.75rem;">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    ` : '';

    return `
      <li class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center flex-grow-1 text-truncate">
          <span class="me-2 flex-shrink-0">${avatarHtml}</span>
          <div class="text-truncate">
            <strong class="text-dark d-block small">${r.userName}</strong>
            ${r.note ? `<small class="text-muted fst-italic text-truncate d-block" style="max-width:200px;" title="${r.note}">"${r.note}"</small>` : ''}
          </div>
        </div>
        <div class="d-flex align-items-center flex-shrink-0">
          <i class="${iconClass} ${iconColor} me-1"></i>
          ${devModControls}
        </div>
      </li>
    `;
  }

  let html = '';
  if (present.length > 0) {
    html += '<h6 class="small text-muted text-uppercase fw-bold mb-2">Aanwezig:</h6><ul class="list-group list-group-flush mb-3">';
    present.forEach(r => { html += renderRegItem(r, 'bi bi-check-circle-fill', 'text-success'); });
    html += '</ul>';
  }

  if (maybe.length > 0) {
    html += '<h6 class="small text-muted text-uppercase fw-bold mb-2">Misschien:</h6><ul class="list-group list-group-flush mb-2">';
    maybe.forEach(r => { html += renderRegItem(r, 'bi bi-question-circle-fill', 'text-warning'); });
    html += '</ul>';
  }

  if (absent.length > 0 && isDev) {
    html += '<h6 class="small text-muted text-uppercase fw-bold mb-2">Afgemeld:</h6><ul class="list-group list-group-flush mb-2">';
    absent.forEach(r => { html += renderRegItem(r, 'bi bi-x-circle-fill', 'text-secondary'); });
    html += '</ul>';
  }

  container.innerHTML = html;
}

// Ontwikkelaars Moderatie: Intekening van een ander account ongedaan maken of aanpassen
function devRemoveRsvp(sessionId, userId) {
  if (!state.currentUser || state.currentUser.role !== 'developer') return;
  const reg = state.registrations.find(r => r.sessionId === sessionId && r.userId === userId);
  if (!reg) return;

  if (!confirm(`Intekening van "${reg.userName}" ongedaan maken en verwijderen?`)) return;

  state.registrations = state.registrations.filter(r => !(r.sessionId === sessionId && r.userId === userId));
  saveRegistrations();
  showToast(`Intekening van ${reg.userName} is ongedaan gemaakt en verwijderd.`, 'info');
  renderAttendeesList(sessionId);
  renderSessionCards();
}

function devEditRsvp(sessionId, userId) {
  if (!state.currentUser || state.currentUser.role !== 'developer') return;
  const reg = state.registrations.find(r => r.sessionId === sessionId && r.userId === userId);
  if (!reg) return;

  const newStatus = prompt(`Status voor ${reg.userName} (kies: present, maybe, of absent):`, reg.status);
  if (newStatus === null) return;
  const cleanStatus = newStatus.trim().toLowerCase();
  if (!['present', 'maybe', 'absent'].includes(cleanStatus)) {
    showToast('Ongeldige status. Kies: present, maybe of absent.', 'danger');
    return;
  }

  const newNote = prompt(`Opmerking voor ${reg.userName} (leeglaten om te wissen):`, reg.note || '');
  if (newNote === null) return;

  reg.status = cleanStatus;
  reg.note = newNote.trim();
  saveRegistrations();
  showToast(`Intekening van ${reg.userName} succesvol gemodereerd.`, 'success');
  renderAttendeesList(sessionId);
  renderSessionCards();
}

// --- SESSIE AANMAKEN & BEWERKEN ---
function openSessionForm(editSessionId = null) {
  if (!state.currentUser) {
    showToast('Log eerst in om een event aan te maken.', 'info');
    return;
  }

  const modalEl = document.getElementById('sessionFormModal');
  const titleEl = document.getElementById('sessionFormModalTitle');
  const idInput = document.getElementById('formSessionId');

  if (editSessionId) {
    const sess = state.sessions.find(s => s.id === editSessionId);
    if (!sess) return;
    titleEl.textContent = 'Event Bewerken';
    idInput.value = sess.id;
    document.getElementById('formTitle').value = sess.title;
    document.getElementById('formSessionType').value = sess.sessionType;
    document.getElementById('formDate').value = sess.date;
    document.getElementById('formStartTime').value = sess.startTime;
    document.getElementById('formLocation').value = sess.location;
    document.getElementById('formDistance').value = sess.distanceKm || '';
    document.getElementById('formPace').value = sess.targetPace || '';
    document.getElementById('formRouteUrl').value = sess.routeUrl || '';
    document.getElementById('formDescription').value = sess.description || '';
  } else {
    titleEl.textContent = 'Nieuw Event Plannen';
    idInput.value = '';
    document.getElementById('sessionForm').reset();
    document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('formStartTime').value = '19:00';
  }

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function editSession(sessionId) {
  bootstrap.Modal.getInstance(document.getElementById('sessionDetailModal')).hide();
  openSessionForm(sessionId);
}

function deleteSession(sessionId) {
  if (!confirm('Weet je zeker dat je dit event wilt verwijderen?')) return;
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  state.registrations = state.registrations.filter(r => r.sessionId !== sessionId);
  saveSessions();
  saveRegistrations();
  bootstrap.Modal.getInstance(document.getElementById('sessionDetailModal')).hide();
  showToast('Event is verwijderd.', 'info');
  renderApp();
}

function handleSessionFormSubmit(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  const id = document.getElementById('formSessionId').value;
  const title = document.getElementById('formTitle').value.trim();
  const sessionType = document.getElementById('formSessionType').value;
  const date = document.getElementById('formDate').value;
  const startTime = document.getElementById('formStartTime').value;
  const location = document.getElementById('formLocation').value.trim();
  const distanceKm = parseFloat(document.getElementById('formDistance').value) || null;
  const targetPace = document.getElementById('formPace').value.trim();
  const routeUrl = document.getElementById('formRouteUrl').value.trim();
  const description = document.getElementById('formDescription').value.trim();

  if (id) {
    // Bewerken (maker, admin of developer)
    const sess = state.sessions.find(s => s.id === id);
    if (sess) {
      sess.title = title;
      sess.sessionType = sessionType;
      sess.date = date;
      sess.startTime = startTime;
      sess.location = location;
      sess.distanceKm = distanceKm;
      sess.targetPace = targetPace;
      sess.routeUrl = routeUrl;
      sess.description = description;
      saveSessions();
      showToast('Event succesvol bijgewerkt!', 'success');
    }
  } else {
    // Nieuw event aanmaken
    const newId = 'sess_' + Date.now();
    const newSess = {
      id: newId,
      title,
      sessionType,
      date,
      startTime,
      location,
      distanceKm,
      targetPace,
      routeUrl,
      description,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      createdAt: new Date().toISOString().split('T')[0]
    };
    state.sessions.push(newSess);

    // Maker automatisch als aanwezig intekenen
    state.registrations.push({
      id: 'reg_' + Date.now(),
      sessionId: newId,
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      status: 'present',
      note: 'Organisator',
      registeredAt: new Date().toISOString()
    });

    saveSessions();
    saveRegistrations();
    showToast('Nieuw event aangemaakt en je bent automatisch ingeschreven!', 'success');
  }

  bootstrap.Modal.getInstance(document.getElementById('sessionFormModal')).hide();
  renderApp();
}

// --- ROLLENBEHEER, GOEDKEURINGEN & GEBRUIKERS VERWIJDEREN (EXCLUSIEF VOOR KENNY) ---
function openDevRolesModal() {
  if (!state.currentUser || state.currentUser.role !== 'developer') {
    showToast('Toegang geweigerd. Deze functie is exclusief voor de app-ontwikkelaar.', 'danger');
    return;
  }

  renderPendingRegistrationsSection();
  renderDevUsersTable();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('devRolesModal')).show();
}

function renderPendingRegistrationsSection() {
  const pendingSection = document.getElementById('pendingRegistrationsSection');
  const container = document.getElementById('pendingRegistrationsContainer');
  if (!pendingSection || !container) return;

  const pendingUsers = state.users.filter(u => u.status === 'pending');
  if (pendingUsers.length === 0) {
    pendingSection.classList.add('d-none');
    return;
  }

  pendingSection.classList.remove('d-none');
  container.innerHTML = `
    <div class="list-group list-group-flush">
      ${pendingUsers.map(u => `
        <div class="list-group-item bg-transparent px-0 py-2 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <div class="d-flex align-items-center">
            <span class="me-2">${renderUserAvatar(u, u.photoUrl, 32)}</span>
            <div>
              <strong class="d-block text-dark">${u.name}</strong>
              <small class="text-muted">${u.email} ${u.phone ? `• ${u.phone}` : ''} • Aangevraagd: ${u.createdAt || 'recent'}</small>
            </div>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-success btn-sm fw-bold" onclick="approveUser('${u.id}')">
              <i class="bi bi-check-lg me-1"></i> Goedkeuren
            </button>
            <button class="btn btn-warning btn-sm fw-bold text-dark" onclick="rejectUser('${u.id}')">
              <i class="bi bi-x-lg me-1"></i> Afkeuren
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteUser('${u.id}')" title="Verwijderen">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function approveUser(userId) {
  const u = state.users.find(user => user.id === userId);
  if (!u) return;
  u.status = 'approved';
  saveUsers();
  showToast(`Account van ${u.name} is goedgekeurd! Deze gebruiker kan nu inloggen.`, 'success');
  renderPendingRegistrationsSection();
  renderDevUsersTable();
  renderNavbar();
}

function rejectUser(userId) {
  const u = state.users.find(user => user.id === userId);
  if (!u) return;
  u.status = 'rejected';
  saveUsers();
  showToast(`Registratie van ${u.name} is afgekeurd.`, 'info');
  renderPendingRegistrationsSection();
  renderDevUsersTable();
  renderNavbar();
}

function deleteUser(userId) {
  const u = state.users.find(user => user.id === userId);
  if (!u) return;
  if (u.role === 'developer' || (state.currentUser && state.currentUser.id === u.id)) {
    showToast('Je kunt je eigen ontwikkelaarsaccount niet verwijderen.', 'danger');
    return;
  }

  if (!confirm(`Weet je zeker dat je het account van "${u.name}" (${u.email}) definitief wilt verwijderen?\nAlle intekeningen en reacties van deze persoon worden ook gewist.`)) {
    return;
  }

  // Verwijder registrations
  state.registrations = state.registrations.filter(r => r.userId !== userId);
  // Verwijder gebruiker
  state.users = state.users.filter(user => user.id !== userId);

  saveUsers();
  saveRegistrations();
  showToast(`Account van ${u.name} is definitief verwijderd.`, 'info');
  renderPendingRegistrationsSection();
  renderDevUsersTable();
  renderNavbar();
  renderSessionCards();
}

function renderDevUsersTable() {
  const container = document.getElementById('devUsersTableBody');
  if (!container) return;
  container.innerHTML = state.users.map(u => {
    const isMe = state.currentUser && state.currentUser.id === u.id;
    const statusLabel = u.status === 'approved' ? '<span class="badge bg-success-subtle text-success">Actief</span>' : u.status === 'pending' ? '<span class="badge bg-warning-subtle text-warning">Wachtend</span>' : '<span class="badge bg-danger-subtle text-danger">Afgekeurd</span>';

    return `
      <tr>
        <td class="ps-3">
          <div class="d-flex align-items-center">
            <span class="me-2">${renderUserAvatar(u, u.photoUrl, 32)}</span>
            <div>
              <strong class="d-block text-dark">${u.name}</strong>
              <small class="text-muted">${u.email}</small>
              ${isMe ? '<span class="badge bg-info-subtle text-info ms-1">Dat ben jij</span>' : ''}
            </div>
          </div>
        </td>
        <td>${statusLabel}</td>
        <td>
          <span class="badge ${u.role === 'developer' ? 'bg-warning text-dark' : u.role === 'admin' ? 'bg-primary text-white' : 'bg-light text-dark border'} px-2 py-1">
            ${u.role.toUpperCase()}
          </span>
        </td>
        <td class="text-end pe-3">
          <div class="d-inline-flex gap-1">
            <select class="form-select form-select-sm" style="width:auto;" onchange="changeUserRole('${u.id}', this.value)" ${isMe ? 'disabled title="Je kunt je eigen rol niet wijzigen"' : ''}>
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>Lid (User)</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option>
              <option value="developer" ${u.role === 'developer' ? 'selected' : ''}>Ontwikkelaar</option>
            </select>
            <button class="btn btn-outline-warning btn-sm" onclick="promptResetPassword('${u.id}')" title="Wachtwoord resetten">
              <i class="bi bi-key-fill"></i>
            </button>
            ${!isMe ? `
              <button class="btn btn-outline-danger btn-sm" onclick="deleteUser('${u.id}')" title="Gebruiker verwijderen">
                <i class="bi bi-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function changeUserRole(userId, newRole) {
  const u = state.users.find(user => user.id === userId);
  if (!u) return;

  u.role = newRole;
  saveUsers();
  showToast(`Rol van ${u.name} gewijzigd naar ${newRole.toUpperCase()}.`, 'success');
  renderDevUsersTable();
  renderApp();
}

async function promptResetPassword(userId) {
  const u = state.users.find(user => user.id === userId);
  if (!u) return;

  const newPass = prompt(`Voer direct een nieuw wachtwoord in voor ${u.name} (${u.email}):`, 'Welkom2026!');
  if (!newPass || newPass.trim().length < 6) {
    if (newPass !== null) showToast('Wachtwoord moet minimaal 6 tekens zijn.', 'danger');
    return;
  }

  u.passwordHash = await hashPassword(newPass.trim());
  saveUsers();
  alert(`✅ Wachtwoord voor ${u.name} is gereset naar: ${newPass.trim()}`);
  showToast(`Wachtwoord gereset voor ${u.name}.`, 'success');
}

// --- PERSOONLIJK ANALYTISCH INZICHT (DASHBOARD PER ACCOUNT) ---
function openMyAnalyticsModal() {
  if (!state.currentUser) return;

  const myAvatarEl = document.getElementById('myAnalyticsAvatar');
  if (myAvatarEl) myAvatarEl.innerHTML = renderUserAvatar(state.currentUser, state.currentUser.photoUrl, 42);

  const myTitle = document.getElementById('myAnalyticsTitle');
  if (myTitle) myTitle.textContent = `Inzichten van ${state.currentUser.name}`;

  // Bereken persoonlijke parameters
  const myRegs = state.registrations.filter(r => r.userId === state.currentUser.id);
  const presentRegs = myRegs.filter(r => r.status === 'present');
  const maybeRegs = myRegs.filter(r => r.status === 'maybe');
  const absentRegs = myRegs.filter(r => r.status === 'absent');

  let totalKm = 0;
  presentRegs.forEach(r => {
    const s = state.sessions.find(sess => sess.id === r.sessionId);
    if (s && s.distanceKm) {
      totalKm += parseFloat(s.distanceKm) || 0;
    }
  });

  document.getElementById('myTotalKm').textContent = `${totalKm.toFixed(1)} km`;
  document.getElementById('myPresentCount').textContent = presentRegs.length;
  document.getElementById('myMaybeCount').textContent = maybeRegs.length;
  document.getElementById('myAbsentCount').textContent = absentRegs.length;

  // Activiteiten tabel vullen
  const tableBody = document.getElementById('myActivitiesTableBody');
  if (tableBody) {
    if (myRegs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Je hebt je nog niet ingeschreven voor events.</td></tr>`;
    } else {
      tableBody.innerHTML = myRegs.map(r => {
        const s = state.sessions.find(sess => sess.id === r.sessionId);
        if (!s) return '';
        const statusBadge = r.status === 'present' ? '<span class="badge bg-success">Aanwezig</span>' : r.status === 'maybe' ? '<span class="badge bg-warning text-dark">Misschien</span>' : '<span class="badge bg-secondary">Afgemeld</span>';
        const typeBadge = s.sessionType === 'event' ? '🎯 Event' : s.sessionType === 'social' ? '🥂 Social' : '🏃 Sport';

        return `
          <tr>
            <td><small class="fw-semibold">${formatDateNL(s.date)}</small></td>
            <td><strong>${s.title}</strong><br><small class="text-muted">${s.location}</small></td>
            <td><span class="badge bg-light text-dark border">${typeBadge}</span></td>
            <td><strong class="text-primary">${s.distanceKm ? `${s.distanceKm} km` : '-'}</strong></td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('');
    }
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById('myAnalyticsModal')).show();
}

// --- ONTWIKKELAARS TEAM ANALYTICS & PARAMETERS DASHBOARD (EXCLUSIEF VOOR KENNY) ---
function openDevAnalyticsModal() {
  if (!state.currentUser || state.currentUser.role !== 'developer') {
    showToast('Toegang geweigerd. Deze functie is exclusief voor de app-ontwikkelaar.', 'danger');
    return;
  }

  // Als er nog geen selectie is, selecteer standaard alle goedgekeurde gebruikers
  if (devAnalyticsSelectedUserIds.size === 0) {
    state.users.forEach(u => devAnalyticsSelectedUserIds.add(u.id));
  }

  renderDevAnalyticsUserChips();
  updateDevAnalyticsDashboard();

  bootstrap.Modal.getOrCreateInstance(document.getElementById('devAnalyticsModal')).show();
}

function renderDevAnalyticsUserChips() {
  const container = document.getElementById('devAnalyticsUserChipsContainer');
  if (!container) return;

  container.innerHTML = state.users.map(u => {
    const isSelected = devAnalyticsSelectedUserIds.has(u.id);
    return `
      <label class="user-filter-chip ${isSelected ? 'active' : ''}" onclick="toggleDevAnalyticsUser('${u.id}')">
        <span class="me-1">${renderUserAvatar(u, u.photoUrl, 20)}</span>
        <span>${u.name}</span>
        <i class="bi ${isSelected ? 'bi-check-circle-fill text-warning ms-1' : 'bi-circle text-muted ms-1'}"></i>
      </label>
    `;
  }).join('');
}

function toggleDevAnalyticsUser(userId) {
  if (devAnalyticsSelectedUserIds.has(userId)) {
    devAnalyticsSelectedUserIds.delete(userId);
  } else {
    devAnalyticsSelectedUserIds.add(userId);
  }
  renderDevAnalyticsUserChips();
  updateDevAnalyticsDashboard();
}

function selectAllDevAnalyticsUsers(select) {
  if (select) {
    state.users.forEach(u => devAnalyticsSelectedUserIds.add(u.id));
  } else {
    devAnalyticsSelectedUserIds.clear();
  }
  renderDevAnalyticsUserChips();
  updateDevAnalyticsDashboard();
}

function updateDevAnalyticsDashboard() {
  const selectedUsers = state.users.filter(u => devAnalyticsSelectedUserIds.has(u.id));

  let totalKmAll = 0;
  let totalPresentAll = 0;

  const userStats = selectedUsers.map(u => {
    const userRegs = state.registrations.filter(r => r.userId === u.id);
    const presentRegs = userRegs.filter(r => r.status === 'present');
    const maybeRegs = userRegs.filter(r => r.status === 'maybe');
    const absentRegs = userRegs.filter(r => r.status === 'absent');

    let userKm = 0;
    presentRegs.forEach(r => {
      const s = state.sessions.find(sess => sess.id === r.sessionId);
      if (s && s.distanceKm) userKm += parseFloat(s.distanceKm) || 0;
    });

    totalKmAll += userKm;
    totalPresentAll += presentRegs.length;

    return {
      user: u,
      totalKm: userKm,
      presentCount: presentRegs.length,
      maybeCount: maybeRegs.length,
      absentCount: absentRegs.length,
      regs: userRegs
    };
  });

  const avgKm = selectedUsers.length > 0 ? (totalKmAll / selectedUsers.length) : 0;

  document.getElementById('devSelectedUserCount').textContent = selectedUsers.length;
  document.getElementById('devSelectedTotalKm').textContent = `${totalKmAll.toFixed(1)} km`;
  document.getElementById('devSelectedTotalPresent').textContent = totalPresentAll;
  document.getElementById('devSelectedAvgKm').textContent = `${avgKm.toFixed(1)} km`;

  // Tabel vullen
  const tableBody = document.getElementById('devAnalyticsTableBody');
  if (tableBody) {
    if (userStats.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Geen gebruikers geselecteerd in het filter. Selecteer gebruikers hierboven.</td></tr>`;
    } else {
      tableBody.innerHTML = userStats.map(stat => {
        const u = stat.user;
        const enrolledEventsNames = stat.regs.map(r => {
          const s = state.sessions.find(sess => sess.id === r.sessionId);
          return s ? `${s.title} (${r.status})` : '';
        }).filter(Boolean).join(', ') || 'Nog geen events';

        return `
          <tr>
            <td class="ps-3">
              <div class="d-flex align-items-center">
                <span class="me-2">${renderUserAvatar(u, u.photoUrl, 32)}</span>
                <div>
                  <strong class="d-block text-dark">${u.name}</strong>
                  <small class="text-muted">${u.email}</small>
                </div>
              </div>
            </td>
            <td><span class="badge ${u.role === 'developer' ? 'bg-warning text-dark' : u.role === 'admin' ? 'bg-primary' : 'bg-light text-dark border'}">${u.role}</span></td>
            <td><strong class="text-primary fs-6">${stat.totalKm.toFixed(1)} km</strong></td>
            <td><span class="badge bg-success-subtle text-success fs-6">${stat.presentCount}</span></td>
            <td><span class="badge bg-warning-subtle text-warning">${stat.maybeCount}</span></td>
            <td><span class="badge bg-secondary-subtle text-secondary">${stat.absentCount}</span></td>
            <td class="text-end pe-3" style="max-width:240px;">
              <small class="text-muted text-truncate d-block" title="${enrolledEventsNames}">
                ${enrolledEventsNames}
              </small>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function exportDevAnalyticsCsv() {
  const selectedUsers = state.users.filter(u => devAnalyticsSelectedUserIds.has(u.id));
  let csv = 'Naam;Email;Rol;Status;Totaal Km;Aanwezig;Misschien;Afgemeld\n';

  selectedUsers.forEach(u => {
    const userRegs = state.registrations.filter(r => r.userId === u.id);
    const presentRegs = userRegs.filter(r => r.status === 'present');
    const maybeRegs = userRegs.filter(r => r.status === 'maybe');
    const absentRegs = userRegs.filter(r => r.status === 'absent');

    let userKm = 0;
    presentRegs.forEach(r => {
      const s = state.sessions.find(sess => sess.id === r.sessionId);
      if (s && s.distanceKm) userKm += parseFloat(s.distanceKm) || 0;
    });

    csv += `"${u.name}";"${u.email}";"${u.role}";"${u.status || 'approved'}";${userKm.toFixed(1)};${presentRegs.length};${maybeRegs.length};${absentRegs.length}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eventapp-team-analytics-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// --- MIJN PROFIEL, FOTO UPLOAD & GDPR EXPORT ---
function openProfileModal() {
  if (!state.currentUser) return;
  document.getElementById('profileName').value = state.currentUser.name;
  document.getElementById('profileEmail').value = state.currentUser.email;
  document.getElementById('profilePhone').value = state.currentUser.phone || '';
  document.getElementById('profileEmergency').value = state.currentUser.emergencyContact || '';

  renderProfileAvatarPreview();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('profileModal')).show();
}

function renderProfileAvatarPreview() {
  const preview = document.getElementById('profilePhotoPreview');
  if (!preview || !state.currentUser) return;
  preview.innerHTML = renderUserAvatar(state.currentUser, state.currentUser.photoUrl, 56);
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Selecteer een geldig afbeeldingsbestand (JPG, PNG).', 'danger');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      // Schaal afbeelding naar compact formaat (max 120px) om cloud en opslag licht te houden
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 120;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      state.currentUser.photoUrl = dataUrl;
      const uIndex = state.users.findIndex(u => u.id === state.currentUser.id);
      if (uIndex >= 0) {
        state.users[uIndex].photoUrl = dataUrl;
        saveUsers();
      }
      saveCurrentUser();
      showToast('Profielfoto succesvol ingesteld!', 'success');
      renderProfileAvatarPreview();
      renderApp();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function removeProfilePhoto() {
  if (!state.currentUser) return;
  state.currentUser.photoUrl = null;
  const uIndex = state.users.findIndex(u => u.id === state.currentUser.id);
  if (uIndex >= 0) {
    state.users[uIndex].photoUrl = null;
    saveUsers();
  }
  saveCurrentUser();
  showToast('Profielfoto verwijderd. Er worden nu 3 initialen getoond.', 'info');
  renderProfileAvatarPreview();
  renderApp();
}

function handleProfileUpdate(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  state.currentUser.name = document.getElementById('profileName').value.trim();
  state.currentUser.phone = document.getElementById('profilePhone').value.trim();
  state.currentUser.emergencyContact = document.getElementById('profileEmergency').value.trim();

  const uIndex = state.users.findIndex(u => u.id === state.currentUser.id);
  if (uIndex >= 0) {
    state.users[uIndex] = { ...state.currentUser };
    saveUsers();
  }
  saveCurrentUser();
  showToast('Profielgegevens bijgewerkt.', 'success');
  renderApp();
}

async function handlePasswordChange(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  const curPass = document.getElementById('profOldPass').value;
  const newPass = document.getElementById('profNewPass').value;
  const newPassConf = document.getElementById('profNewPassConf').value;

  const curHash = await hashPassword(curPass);
  if (curHash !== state.currentUser.passwordHash) {
    showToast('Huidig wachtwoord is onjuist.', 'danger');
    return;
  }
  if (newPass.length < 6) {
    showToast('Nieuw wachtwoord moet minstens 6 tekens zijn.', 'danger');
    return;
  }
  if (newPass !== newPassConf) {
    showToast('Nieuwe wachtwoorden komen niet overeen.', 'danger');
    return;
  }

  state.currentUser.passwordHash = await hashPassword(newPass);
  const uIndex = state.users.findIndex(u => u.id === state.currentUser.id);
  if (uIndex >= 0) {
    state.users[uIndex].passwordHash = state.currentUser.passwordHash;
    saveUsers();
  }
  saveCurrentUser();

  document.getElementById('profOldPass').value = '';
  document.getElementById('profNewPass').value = '';
  document.getElementById('profNewPassConf').value = '';
  showToast('Wachtwoord succesvol gewijzigd! Veilig versleuteld conform GDPR.', 'success');
}

function exportGdprJson() {
  if (!state.currentUser) return;
  const myData = {
    app: "Even'Tapp",
    gdprVerklaring: "Overzicht persoonsgegevens conform Algemene Verordening Gegevensbescherming (AVG/GDPR).",
    gebruiker: {
      id: state.currentUser.id,
      name: state.currentUser.name,
      email: state.currentUser.email,
      role: state.currentUser.role,
      phone: state.currentUser.phone,
      emergencyContact: state.currentUser.emergencyContact
    },
    mijnEvents: state.sessions.filter(s => s.creatorId === state.currentUser.id),
    mijnDeelnames: state.registrations.filter(r => r.userId === state.currentUser.id)
  };

  const blob = new Blob([JSON.stringify(myData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eventapp-gdpr-data-${state.currentUser.name.replace(/\s+/g, '_')}.json`;
  a.click();
}

function downloadFullBackup() {
  const backup = {
    app: "Even'Tapp",
    versie: '3.1',
    timestamp: new Date().toISOString(),
    users: state.users,
    sessions: state.sessions,
    registrations: state.registrations
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `even-tapp-database-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function restoreBackupFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      if (data.sessions && data.users) {
        state.users = data.users;
        state.sessions = data.sessions;
        state.registrations = data.registrations || [];
        saveUsers();
        saveSessions();
        saveRegistrations();
        showToast('Database backup succesvol hersteld!', 'success');
        renderApp();
      } else {
        showToast('Ongeldig backupbestand.', 'danger');
      }
    } catch (err) {
      showToast('Fout bij het lezen van backupbestand.', 'danger');
    }
  };
  reader.readAsText(file);
}

// --- INITIALISATIE ---
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Stille achtergrondsynchronisatie (elke 15s en wanneer tabblad actief wordt)
  window.addEventListener('focus', () => {
    if (state.syncUrl) pullCloudData();
  });
  setInterval(() => {
    if (state.syncUrl) pullCloudData();
  }, 15000);

  // Registreer Service Worker voor PWA / Offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW reg error:', err));
  }
});

// Globale window koppelingen voor gegarandeerde werking van alle onclick handlers
window.openSessionForm = openSessionForm;
window.openMyAnalyticsModal = openMyAnalyticsModal;
window.openDevRolesModal = openDevRolesModal;
window.openDevAnalyticsModal = openDevAnalyticsModal;
window.openProfileModal = openProfileModal;
window.openSessionDetail = openSessionDetail;
window.setFilter = setFilter;
window.setMyRsvp = setMyRsvp;
window.saveRsvpNote = saveRsvpNote;
window.logout = logout;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleSessionFormSubmit = handleSessionFormSubmit;
window.editSession = editSession;
window.deleteSession = deleteSession;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.deleteUser = deleteUser;
window.devEditRsvp = devEditRsvp;
window.devRemoveRsvp = devRemoveRsvp;
window.toggleDevAnalyticsUser = toggleDevAnalyticsUser;
window.selectAllDevAnalyticsUsers = selectAllDevAnalyticsUsers;
window.exportDevAnalyticsCsv = exportDevAnalyticsCsv;
window.handlePhotoUpload = handlePhotoUpload;
window.removeProfilePhoto = removeProfilePhoto;
window.handleProfileUpdate = handleProfileUpdate;
window.handlePasswordChange = handlePasswordChange;
window.exportGdprJson = exportGdprJson;
window.downloadFullBackup = downloadFullBackup;
window.restoreBackupFromFile = restoreBackupFromFile;

