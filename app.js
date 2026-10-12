/**
 * Even'Tapp - Event & Activiteiten Planner
 * Client-Side Webapplicatie voor GitHub Pages met stille Firebase Cloud Sync.
 * Bevat authenticatie, GDPR-wachtwoordhashing (SHA-256), eventplanning, intekeningen,
 * en exclusief rollenbeheer voor de ontwikkelaar (kennydm94@gmail.com).
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

// --- GDPR CRYPTOGRAFISCHE WACHTWOORD HASHING (Web Crypto API) ---
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password + PASSWORD_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
      phone: '',
      emergencyContact: '',
      createdAt: '2026-10-09'
    },
    {
      id: 'usr_admin_1',
      name: 'Koen Demeester',
      email: 'koen@eventapp.be',
      passwordHash: adminPass,
      role: 'admin',
      phone: '0470 12 34 56',
      emergencyContact: 'Familie Demeester',
      createdAt: '2026-10-09'
    },
    {
      id: 'usr_user_1',
      name: 'Sarah De Smet',
      email: 'sarah@eventapp.be',
      passwordHash: memberPass,
      role: 'user',
      phone: '',
      emergencyContact: '',
      createdAt: '2026-10-09'
    }
  ];
}

function getInitialSessions() {
  const today = new Date();
  const d1 = new Date(today.getTime() + 5 * 86400000).toISOString().split('T')[0];
  const d2 = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0];
  const dEvent = new Date(today.getTime() + 35 * 86400000).toISOString().split('T')[0];

  return [
    {
      id: 'sess_1',
      title: '🎯 Jaarlijkse Teambijeenkomst & Kick-off',
      sessionType: 'event',
      date: dEvent,
      startTime: '19:00',
      location: 'Congrescentrum / Zaal De Ark, Gent',
      distanceKm: null,
      targetPace: '',
      description: 'Gezamenlijke kick-off voor het nieuwe seizoen! Presentatie van de planning en doelen, aansluitend receptie en netwerken.',
      routeUrl: '',
      creatorId: 'usr_dev_1',
      creatorName: 'Kenny De Meester',
      createdAt: '2026-10-09'
    },
    {
      id: 'sess_2',
      title: '🏃 Sportieve Buitenactiviteit & Teambuilding',
      sessionType: 'training',
      date: d1,
      startTime: '09:30',
      location: 'Domein Puyenbroeck (Parking 1, Wachtebeke)',
      distanceKm: 15.0,
      targetPace: 'Recreatief / Gezellig samen',
      description: 'Ontspannen sport- en wandelactiviteit in het groen. Iedereen kan aansluiten op eigen tempo! Na afloop drinken we iets samen in de cafetaria.',
      routeUrl: 'https://maps.google.com/?q=Puyenbroeck',
      creatorId: 'usr_admin_1',
      creatorName: 'Koen Demeester',
      createdAt: '2026-10-09'
    },
    {
      id: 'sess_3',
      title: '🥂 Zomer Drink & Netwerk BBQ',
      sessionType: 'social',
      date: d2,
      startTime: '18:00',
      location: 'Parkkaffee, Mariakerke (Gent)',
      distanceKm: null,
      targetPace: '',
      description: 'Gezellig napraten en ontspannen met het voltallige team. Graag vooraf intekenen voor een vlotte planning van de catering!',
      routeUrl: '',
      creatorId: 'usr_user_1',
      creatorName: 'Sarah De Smet',
      createdAt: '2026-10-09'
    }
  ];
}

function getInitialRegistrations() {
  return [
    {
      id: 'reg_1',
      sessionId: 'sess_1',
      userId: 'usr_dev_1',
      userName: 'Kenny De Meester',
      status: 'present',
      note: 'Aanwezig voor de opening.',
      registeredAt: new Date().toISOString()
    },
    {
      id: 'reg_2',
      sessionId: 'sess_1',
      userId: 'usr_admin_1',
      userName: 'Koen Demeester',
      status: 'present',
      note: 'Zorgt voor de verwelkoming.',
      registeredAt: new Date().toISOString()
    },
    {
      id: 'reg_3',
      sessionId: 'sess_2',
      userId: 'usr_admin_1',
      userName: 'Koen Demeester',
      status: 'present',
      note: 'Wandelschoenen aangeraden.',
      registeredAt: new Date().toISOString()
    },
    {
      id: 'reg_4',
      sessionId: 'sess_2',
      userId: 'usr_user_1',
      userName: 'Sarah De Smet',
      status: 'present',
      note: 'Kan 2 personen meenemen met de wagen.',
      registeredAt: new Date().toISOString()
    }
  ];
}

// --- OPSLAG EN STILLE ACHTERGRONDSYNC ---
async function loadState() {
  const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  const storedRegs = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
  const storedCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);

  if (!storedUsers) {
    state.users = await getInitialUsers();
    saveUsers();
  } else {
    try { state.users = JSON.parse(storedUsers); } catch(e) { state.users = []; }
  }

  if (!storedSessions) {
    state.sessions = getInitialSessions();
    saveSessions();
  } else {
    try { state.sessions = JSON.parse(storedSessions); } catch(e) { state.sessions = []; }
  }

  if (!storedRegs) {
    state.registrations = getInitialRegistrations();
    saveRegistrations();
  } else {
    try { state.registrations = JSON.parse(storedRegs); } catch(e) { state.registrations = []; }
  }

  if (storedCurrent) {
    try { state.currentUser = JSON.parse(storedCurrent); } catch(e) { state.currentUser = null; }
  } else {
    state.currentUser = null;
  }

  state.syncUrl = DEFAULT_FIREBASE_SYNC_URL;

  // Stille cloud sync op de achtergrond
  if (state.syncUrl) {
    pullCloudData();
  }

  renderApp();
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

// --- STILLE FIREBASE CLOUD SYNC (GEEN UI INDICATIE OF STATUS) ---
async function pullCloudData() {
  if (!state.syncUrl) return;
  try {
    const url = state.syncUrl.endsWith('.json') ? state.syncUrl : `${state.syncUrl}/data.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.sessions) {
        state.sessions = data.sessions;
        state.registrations = data.registrations || state.registrations;
        if (data.users) state.users = data.users;
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(state.sessions));
        localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(state.registrations));
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
        renderApp();
      } else if (data === null) {
        // Firebase is nog leeg: initialiseer stil met de huidige data
        await pushCloudData();
      }
    }
  } catch (err) {
    // Stille foutafhandeling
    console.warn("Background sync pull:", err);
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
    // Stille foutafhandeling
    console.warn("Background sync push:", err);
  }
}

function updateSyncBadge() {
  // Bewust leeg: geen UI-indicatoren conform wens
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
    <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2 fs-5"></i>
    <div class="flex-grow-1">${message}</div>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  container.appendChild(toastEl);
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 250);
  }, 4000);
}

// --- RENDER APPLICATIE & LOGIN WALL GATE ---
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

    if (devNav) {
      devNav.innerHTML = isDev ? `
        <button class="btn btn-outline-warning text-warning btn-sm fw-semibold me-2" onclick="openDevRolesModal()">
          <i class="bi bi-shield-lock-fill me-1"></i> Rollenbeheer
        </button>
      ` : '';
    }

    if (userNav) {
      userNav.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-dark text-white dropdown-toggle d-flex align-items-center p-1 px-2 rounded-pill border-0" type="button" data-bs-toggle="dropdown">
            <span class="avatar-chip bg-forest text-white me-2" style="width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;">${state.currentUser.name[0].toUpperCase()}</span>
            <div class="text-start me-2 d-none d-sm-block">
              <span class="d-block fw-bold lh-1" style="font-size:0.88rem;">${state.currentUser.name}</span>
              <small class="text-white-50" style="font-size:0.7rem;">${roleLabel}</small>
            </div>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow border-0">
            <li><a class="dropdown-item" href="#" onclick="openProfileModal(); return false;"><i class="bi bi-person me-2"></i> Mijn Profiel & Privacy</a></li>
            ${isDev ? '<li><a class="dropdown-item text-warning" href="#" onclick="openDevRolesModal(); return false;"><i class="bi bi-sliders me-2"></i> Rollen Toekennen</a></li>' : ''}
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
      <div class="col-12 text-center py-5">
        <div class="card border-0 shadow-sm p-5">
          <i class="bi bi-calendar-x fs-1 text-muted mb-3"></i>
          <h4 class="fw-bold">Geen events gevonden</h4>
          <p class="text-muted">Er zijn momenteel geen activiteiten gepland binnen deze categorie.</p>
          <div>
            <button class="btn btn-forest fw-semibold" onclick="openSessionForm()">
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

    let typeBadgeHtml = '<span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill fw-bold">🏃 Sport & Training</span>';
    if (isEvent) {
      typeBadgeHtml = '<span class="badge bg-warning text-dark px-3 py-2 rounded-pill fw-bold">🎯 Evenement</span>';
    } else if (isSocial) {
      typeBadgeHtml = '<span class="badge bg-info-subtle text-info border border-info-subtle px-3 py-2 rounded-pill fw-bold">🥂 Social / Bijeenkomst</span>';
    }

    return `
      <div class="col-lg-6 mb-4">
        <div class="card h-100 session-card border-0 shadow-sm ${isEvent ? 'border-start border-warning border-5' : isSocial ? 'border-start border-info border-5' : 'border-start border-success border-5'}">
          <div class="card-body p-4 d-flex flex-column">

            <!-- Type badge + status -->
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>${typeBadgeHtml}</div>
              <div>${myStatusBadge}</div>
            </div>

            <!-- Titel -->
            <h4 class="card-title fw-bold text-dark mb-3 cursor-pointer" onclick="openSessionDetail('${s.id}')" style="cursor: pointer;">
              ${s.title}
            </h4>

            <!-- Parameters Grid -->
            <div class="session-meta-grid mb-3">
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
            <div class="p-2 bg-light rounded-3 mb-3 d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center">
                <i class="bi bi-person-fill text-muted me-2"></i>
                <small class="text-muted">Aangemaakt door: <strong class="text-dark">${s.creatorName}</strong></small>
              </div>
              ${canEdit ? '<span class="badge bg-success-subtle text-success small">Beheerbaar</span>' : ''}
            </div>

            <!-- Footer: Deelnemers en knoppen -->
            <div class="d-flex align-items-center justify-content-between pt-3 border-top mt-auto">
              <div class="d-flex align-items-center">
                <div class="bg-forest-subtle text-forest rounded-circle me-2 p-2 d-flex align-items-center justify-content-center" style="width:36px;height:36px;">
                  <i class="bi bi-people-fill"></i>
                </div>
                <div>
                  <span class="fw-bold fs-6 text-dark">${presentRegs.length}</span>
                  <small class="text-muted">aanwezigen</small>
                  ${maybeRegs.length > 0 ? `<small class="text-warning">(${maybeRegs.length} misschien)</small>` : ''}
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
    btn.className = btn.dataset.filter === filterType ? 'btn btn-forest text-white fw-semibold' : 'btn btn-outline-secondary bg-white fw-semibold';
  });
  renderSessionCards();
}

// --- AUTHENTICATIE & REGISTRATIE ---
async function handleLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  if (!emailInput || !passInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passInput.value;

  const user = state.users.find(u => u.email.toLowerCase() === email);
  if (!user) {
    showToast('Geen account gevonden met dit e-mailadres. Maak gerust een nieuw account aan!', 'danger');
    return;
  }

  const hash = await hashPassword(password);
  let isValid = (user.passwordHash === hash);

  // Ondersteun voor het ontwikkelaarsaccount beide bekende wachtwoorden
  if (!isValid && email === 'kennydm94@gmail.com') {
    const devHash1 = await hashPassword('KennyEvenTapp2026!');
    const devHash2 = await hashPassword('KennyDodentocht2026!');
    if (hash === devHash1 || hash === devHash2) {
      isValid = true;
      user.passwordHash = hash;
      saveUsers();
    }
  }

  if (!isValid) {
    showToast('Ongeldig wachtwoord. Vraag de beheerder (Kenny) om een reset als je het vergeten bent.', 'danger');
    return;
  }

  state.currentUser = user;
  saveCurrentUser();
  showToast(`Welkom terug, ${user.name}! Je bent ingelogd.`, 'success');
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
  const isDev = email === 'kennydm94@gmail.com' || state.users.length === 0;

  const newUser = {
    id: 'usr_' + Date.now(),
    name,
    email,
    passwordHash: hash,
    role: isDev ? 'developer' : 'user',
    phone,
    emergencyContact: '',
    createdAt: new Date().toISOString().split('T')[0]
  };

  state.users.push(newUser);
  saveUsers();

  state.currentUser = newUser;
  saveCurrentUser();

  showToast(`Account aangemaakt! Welkom bij Even'Tapp, ${name}.`, 'success');
  renderApp();
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
        <button class="btn btn-outline-primary btn-sm me-2" onclick="editSession('${sess.id}')">
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
    // Registreer als aanwezig met de opmerking
    setMyRsvp('present');
  }
}

function renderAttendeesList(sessionId) {
  const container = document.getElementById('detailAttendeesList');
  const countBadge = document.getElementById('detailAttendeeCountBadge');
  const regs = state.registrations.filter(r => r.sessionId === sessionId);
  const present = regs.filter(r => r.status === 'present');
  const maybe = regs.filter(r => r.status === 'maybe');

  if (countBadge) countBadge.textContent = `${present.length} aanwezig`;
  if (!container) return;

  if (present.length === 0 && maybe.length === 0) {
    container.innerHTML = '<p class="text-muted small fst-italic p-2 mb-0">Nog geen inschrijvingen voor dit event.</p>';
    return;
  }

  let html = '';
  if (present.length > 0) {
    html += '<h6 class="small text-muted text-uppercase fw-bold mb-2">Aanwezig:</h6><ul class="list-group list-group-flush mb-3">';
    present.forEach(r => {
      html += `
        <li class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            <span class="avatar-chip bg-forest text-white me-2" style="width:28px;height:28px;font-size:0.8rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">${(r.userName || 'U')[0].toUpperCase()}</span>
            <div>
              <strong class="text-dark d-block small">${r.userName}</strong>
              ${r.note ? `<small class="text-muted fst-italic">"${r.note}"</small>` : ''}
            </div>
          </div>
          <i class="bi bi-check-circle-fill text-success"></i>
        </li>
      `;
    });
    html += '</ul>';
  }

  if (maybe.length > 0) {
    html += '<h6 class="small text-muted text-uppercase fw-bold mb-2">Misschien:</h6><ul class="list-group list-group-flush mb-2">';
    maybe.forEach(r => {
      html += `
        <li class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            <span class="avatar-chip bg-warning text-dark me-2" style="width:28px;height:28px;font-size:0.8rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">${(r.userName || 'U')[0].toUpperCase()}</span>
            <div>
              <span class="text-dark d-block small">${r.userName}</span>
              ${r.note ? `<small class="text-muted fst-italic">"${r.note}"</small>` : ''}
            </div>
          </div>
          <i class="bi bi-question-circle-fill text-warning"></i>
        </li>
      `;
    });
    html += '</ul>';
  }

  container.innerHTML = html;
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
    // Bewerken
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

// --- ROLLENBEHEER (EXCLUSIEF VOOR ONTWIKKELAAR KENNY) ---
function openDevRolesModal() {
  if (!state.currentUser || state.currentUser.role !== 'developer') {
    showToast('Toegang geweigerd. Deze functie is exclusief voor de app-ontwikkelaar.', 'danger');
    return;
  }

  renderDevUsersTable();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('devRolesModal')).show();
}

function renderDevUsersTable() {
  const container = document.getElementById('devUsersTableBody');
  if (!container) return;
  container.innerHTML = state.users.map(u => {
    const isMe = state.currentUser && state.currentUser.id === u.id;
    return `
      <tr>
        <td class="ps-3">
          <div class="d-flex align-items-center">
            <span class="avatar-chip ${u.role === 'developer' ? 'bg-warning text-dark' : u.role === 'admin' ? 'bg-primary text-white' : 'bg-secondary text-white'} me-2" style="width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;">
              ${u.name[0].toUpperCase()}
            </span>
            <div>
              <strong class="d-block text-dark">${u.name}</strong>
              <small class="text-muted">${u.email}</small>
              ${isMe ? '<span class="badge bg-info-subtle text-info ms-1">Dat ben jij</span>' : ''}
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${u.role === 'developer' ? 'bg-warning text-dark' : u.role === 'admin' ? 'bg-primary text-white' : 'bg-light text-dark border'} px-2 py-1">
            ${u.role.toUpperCase()}
          </span>
        </td>
        <td class="text-end pe-3">
          <div class="d-inline-flex gap-2">
            <select class="form-select form-select-sm" style="width:auto;" onchange="changeUserRole('${u.id}', this.value)" ${isMe ? 'disabled title="Je kunt je eigen rol niet wijzigen"' : ''}>
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>Lid (User)</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator (Admin)</option>
              <option value="developer" ${u.role === 'developer' ? 'selected' : ''}>Ontwikkelaar (Dev)</option>
            </select>
            <button class="btn btn-outline-warning btn-sm" onclick="promptResetPassword('${u.id}')" title="Wachtwoord resetten">
              <i class="bi bi-key-fill"></i>
            </button>
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

// --- MIJN PROFIEL & GDPR EXPORT ---
function openProfileModal() {
  if (!state.currentUser) return;
  document.getElementById('profileName').value = state.currentUser.name;
  document.getElementById('profileEmail').value = state.currentUser.email;
  document.getElementById('profilePhone').value = state.currentUser.phone || '';
  document.getElementById('profileEmergency').value = state.currentUser.emergencyContact || '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('profileModal')).show();
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
    versie: '3.0',
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
