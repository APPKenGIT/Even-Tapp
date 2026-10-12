/**
 * Dodentocht Teamtraining Planner - GitHub Pages Client Application
 * Bevat authenticatie, GDPR-wachtwoordhashing (SHA-256), sessieplanning, intekeningen,
 * exclusief rollenbeheer voor de ontwikkelaar en optionele Cloud Sync.
 */

// --- STATE MANAGEMENT ---
const STORAGE_KEYS = {
  USERS: 'dodentocht_users_v2',
  SESSIONS: 'dodentocht_sessions_v2',
  REGISTRATIONS: 'dodentocht_registrations_v2',
  CURRENT_USER: 'dodentocht_current_user_v2',
  SYNC_CONFIG: 'dodentocht_sync_config_v2'
};

const PASSWORD_SALT = 'dodentocht_salt_2026_gdpr_veilig';

// --- CLOUD SYNC CONFIGURATIE (GOOGLE FIREBASE REALTIME DATABASE) ---
// Jouw gekoppelde live Firebase Realtime Database:
const DEFAULT_FIREBASE_SYNC_URL = 'https://even-tapp-default-rtdb.europe-west1.firebasedatabase.app';

let state = {
  users: [],
  sessions: [],
  registrations: [],
  currentUser: null,
  activeFilter: 'all',
  syncUrl: DEFAULT_FIREBASE_SYNC_URL
};

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
  const devPass = await hashPassword('KennyDodentocht2026!');
  const coachPass = await hashPassword('Coach2026!');
  const runnerPass = await hashPassword('Loper2026!');

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
      id: 'usr_coach_1',
      name: 'Koen (Team Coach)',
      email: 'coach@dodentocht.be',
      passwordHash: coachPass,
      role: 'admin',
      phone: '0470 12 34 56',
      emergencyContact: 'EHBO Post Bornem',
      createdAt: '2026-10-09'
    },
    {
      id: 'usr_sarah_1',
      name: 'Sarah De Smet',
      email: 'sarah@dodentocht.be',
      passwordHash: runnerPass,
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
  const dEvent = new Date(today.getTime() + 75 * 86400000).toISOString().split('T')[0];

  return [
    {
      id: 'sess_event_1',
      title: '🏆 100km Dodentocht (Het Hoofdevent)',
      sessionType: 'event',
      date: dEvent,
      startTime: '21:00',
      location: 'Startzone Dodentocht, Bornem',
      distanceKm: 100.0,
      targetPace: '5.5 - 6.0 km/u',
      description: 'Het officiële doel! We verzamelen 2 uur voor de start voor de gezamenlijke teamfoto, briefing en rugnummers.',
      routeUrl: 'https://www.dodentocht.be',
      creatorId: 'usr_dev_1',
      creatorName: 'Kenny De Meester',
      createdAt: '2026-10-09'
    },
    {
      id: 'sess_train_1',
      title: 'Eerste Teamtraining: Scheldeland Lus',
      sessionType: 'training',
      date: d1,
      startTime: '08:30',
      location: 'Kerkplein, Bornem (Grote Markt)',
      distanceKm: 21.5,
      targetPace: '5.8 km/u',
      description: 'Opstarttraining langs de Scheldedijken. Zorg voor voldoende water en geteste wandelschoenen. Na afloop koffie!',
      routeUrl: 'https://maps.google.com/?q=Bornem',
      creatorId: 'usr_coach_1',
      creatorName: 'Koen (Team Coach)',
      createdAt: '2026-10-09'
    },
    {
      id: 'sess_train_2',
      title: 'Nachttraining: Test met Hoofdlamp',
      sessionType: 'training',
      date: d2,
      startTime: '22:00',
      location: 'Station Puurs (Parking Voorkant)',
      distanceKm: 35.0,
      targetPace: '5.5 km/u',
      description: 'Voorbereiding op de nachtelijke uren. Breng fluohesje, hoofdlampje en reservebatterijen mee.',
      routeUrl: 'https://maps.google.com/?q=Station+Puurs',
      creatorId: 'usr_sarah_1',
      creatorName: 'Sarah De Smet',
      createdAt: '2026-10-09'
    }
  ];
}

function getInitialRegistrations() {
  return [
    {
      id: 'reg_1',
      sessionId: 'sess_event_1',
      userId: 'usr_dev_1',
      userName: 'Kenny De Meester',
      status: 'present',
      note: 'Ticket binnen! Klaar voor de 100km.',
      registeredAt: new Date().toISOString()
    },
    {
      id: 'reg_2',
      sessionId: 'sess_event_1',
      userId: 'usr_coach_1',
      userName: 'Koen (Team Coach)',
      status: 'present',
      note: 'Startvak 1 - Neemt EHBO kit mee.',
      registeredAt: new Date().toISOString()
    },
    {
      id: 'reg_3',
      sessionId: 'sess_train_1',
      userId: 'usr_coach_1',
      userName: 'Koen (Team Coach)',
      status: 'present',
      note: 'Verzamelen om 08:15',
      registeredAt: new Date().toISOString()
    },
    {
      id: 'reg_4',
      sessionId: 'sess_train_1',
      userId: 'usr_sarah_1',
      userName: 'Sarah De Smet',
      status: 'present',
      note: 'Kan 2 mensen meenemen vanaf Sint-Niklaas.',
      registeredAt: new Date().toISOString()
    }
  ];
}

// --- OPSLAG & SYNCHRONISATIE ---
async function loadState() {
  const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  const storedRegs = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
  const storedCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  const storedSync = localStorage.getItem(STORAGE_KEYS.SYNC_CONFIG);

  if (!storedUsers) {
    state.users = await getInitialUsers();
    saveUsers();
  } else {
    state.users = JSON.parse(storedUsers);
  }

  if (!storedSessions) {
    state.sessions = getInitialSessions();
    saveSessions();
  } else {
    state.sessions = JSON.parse(storedSessions);
  }

  if (!storedRegs) {
    state.registrations = getInitialRegistrations();
    saveRegistrations();
  } else {
    state.registrations = JSON.parse(storedRegs);
  }

  if (storedCurrent) {
    state.currentUser = JSON.parse(storedCurrent);
  }

  if (storedSync) {
    state.syncUrl = storedSync;
  } else if (DEFAULT_FIREBASE_SYNC_URL) {
    state.syncUrl = DEFAULT_FIREBASE_SYNC_URL;
  }

  // Voer optionele Cloud Sync uit indien ingesteld
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

// --- OPTIONELE REALTIME CLOUD SYNC (voor GitHub Pages) ---
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
        updateSyncBadge(true);
      } else if (data === null) {
        // Firebase database is nog maagdelijk leeg: initialiseer meteen met onze data!
        await pushCloudData();
        updateSyncBadge(true);
      }
    }
  } catch (err) {
    console.warn("Cloud sync fetch error:", err);
    updateSyncBadge(false);
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
    updateSyncBadge(true);
  } catch (err) {
    console.warn("Cloud sync push error:", err);
    updateSyncBadge(false);
  }
}

function updateSyncBadge(isOnline) {
  const badge = document.getElementById('syncIndicator');
  if (!badge) return;
  if (state.syncUrl && isOnline) {
    badge.className = 'badge bg-success-subtle text-success border border-success-subtle px-2 py-1';
    badge.innerHTML = '<span class="sync-dot sync-online"></span> Cloud Gesynchroniseerd';
  } else if (state.syncUrl && !isOnline) {
    badge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1';
    badge.innerHTML = '<span class="sync-dot sync-local"></span> Sync Offline';
  } else {
    badge.className = 'badge bg-warning-subtle text-dark border border-warning-subtle px-2 py-1';
    badge.innerHTML = '<span class="sync-dot sync-local"></span> Lokale Opslag';
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
  }, 4500);
}

// --- RENDER HOOFDAPPLICATIE ---
function renderApp() {
  renderNavbar();
  renderStats();
  renderSessionCards();
}

function renderNavbar() {
  const userNav = document.getElementById('userNavContainer');
  const devNav = document.getElementById('devNavContainer');

  if (state.currentUser) {
    const isDev = state.currentUser.role === 'developer';
    const roleLabel = isDev ? '👑 Ontwikkelaar' : state.currentUser.role === 'admin' ? '⭐ Administrator' : '🏃 Deelnemer';

    if (devNav) {
      devNav.innerHTML = isDev ? `
        <button class="btn btn-outline-warning text-warning btn-sm fw-semibold me-2" onclick="openDevRolesModal()">
          <i class="bi bi-shield-lock-fill me-1"></i> Rollenbeheer (Dev)
        </button>
      ` : '';
    }

    userNav.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-dark text-white dropdown-toggle d-flex align-items-center p-1 px-2 rounded-pill border-0" type="button" data-bs-toggle="dropdown">
          <span class="avatar-chip bg-forest text-white me-2">${state.currentUser.name[0].toUpperCase()}</span>
          <div class="text-start me-2 d-none d-sm-block">
            <span class="d-block fw-bold lh-1" style="font-size:0.88rem;">${state.currentUser.name}</span>
            <small class="text-white-50" style="font-size:0.7rem;">${roleLabel}</small>
          </div>
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow border-0">
          <li><a class="dropdown-item" href="#" onclick="openProfileModal()"><i class="bi bi-person me-2"></i> Mijn Profiel & GDPR</a></li>
          ${isDev ? '<li><a class="dropdown-item text-warning" href="#" onclick="openDevRolesModal()"><i class="bi bi-sliders me-2"></i> Rollen Toekennen</a></li>' : ''}
          <li><a class="dropdown-item" href="#" onclick="openSyncModal()"><i class="bi bi-cloud-arrow-up me-2"></i> Cloud Synchronisatie</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" onclick="logout()"><i class="bi bi-box-arrow-right me-2"></i> Uitloggen</a></li>
        </ul>
      </div>
    `;
  } else {
    if (devNav) devNav.innerHTML = '';
    userNav.innerHTML = `
      <button class="btn btn-outline-light btn-sm px-3 me-2" onclick="openAuthModal('login')">
        <i class="bi bi-box-arrow-in-right me-1"></i> Inloggen
      </button>
      <button class="btn btn-accent btn-sm px-3 fw-bold text-dark" onclick="openAuthModal('register')">
        <i class="bi bi-person-plus me-1"></i> Registreren
      </button>
    `;
  }

  updateSyncBadge(true);
}

function renderStats() {
  const trainCount = state.sessions.filter(s => s.sessionType === 'training').length;
  const eventCount = state.sessions.filter(s => s.sessionType === 'event').length;
  const totalKm = state.sessions.reduce((acc, s) => acc + (parseFloat(s.distanceKm) || 0), 0);

  document.getElementById('statTrainings').textContent = trainCount;
  document.getElementById('statEvents').textContent = eventCount;
  document.getElementById('statKm').textContent = `${totalKm.toFixed(1)} km`;
}

function renderSessionCards() {
  const container = document.getElementById('sessionsContainer');
  let list = [...state.sessions];

  // Sorteren op datum
  list.sort((a, b) => new Date(a.date + 'T' + a.startTime) - new Date(b.date + 'T' + b.startTime));

  // Filters
  if (state.activeFilter === 'training') {
    list = list.filter(s => s.sessionType === 'training');
  } else if (state.activeFilter === 'event') {
    list = list.filter(s => s.sessionType === 'event');
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
          <h4 class="fw-bold">Geen sessies gevonden</h4>
          <p class="text-muted">Er zijn momenteel geen trainingssessies gepland binnen deze categorie.</p>
          <div>
            <button class="btn btn-forest fw-semibold" onclick="${state.currentUser ? 'openSessionForm()' : 'openAuthModal(\"login\")'}">
              <i class="bi bi-plus-lg me-1"></i> Plan een nieuwe training
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(s => {
    const isEvent = s.sessionType === 'event';
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
          myStatusBadge = `<span class="badge bg-secondary text-white px-2 py-1 rounded-pill">Afwezig</span>`;
        }
      } else {
        myStatusBadge = `<span class="badge bg-light text-muted border px-2 py-1 rounded-pill">Nog niet gereageerd</span>`;
      }
    }

    // Mag bewerken: maker OF admin OF developer
    const canEdit = state.currentUser && (
      state.currentUser.id === s.creatorId ||
      ['admin', 'developer'].includes(state.currentUser.role)
    );

    return `
      <div class="col-lg-6 mb-4">
        <div class="card h-100 session-card border-0 shadow-sm ${isEvent ? 'border-start border-warning border-5' : 'border-start border-success border-5'}">
          <div class="card-body p-4 d-flex flex-column">

            <!-- Type badge + mijn status -->
            <div class="d-flex justify-content-between align-items-start mb-3">
              <span class="badge ${isEvent ? 'bg-warning text-dark' : 'bg-success-subtle text-success border border-success-subtle'} px-3 py-2 rounded-pill fw-bold">
                ${isEvent ? '🏆 Uiteindelijk Event' : '🏃 Training'}
              </span>
              <div>${myStatusBadge}</div>
            </div>

            <!-- Titel -->
            <h4 class="card-title fw-bold text-dark mb-3 cursor-pointer" onclick="openSessionDetail('${s.id}')">
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
                  <strong class="d-block small text-muted">Afstand</strong>
                  <span>${s.distanceKm ? `<strong>${s.distanceKm} km</strong>` : '<em class="text-muted">Vrij te kiezen</em>'}</span>
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
                <div class="participant-avatars-icon bg-forest-subtle text-forest rounded-circle me-2 p-2">
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

// --- AUTHENTICATIE & REGISTRATIE (DIRECT ACTIEF) ---
function openAuthModal(mode = 'login') {
  document.getElementById('authLoginTab').className = mode === 'login' ? 'nav-link active fw-bold text-forest' : 'nav-link text-muted';
  document.getElementById('authRegisterTab').className = mode === 'register' ? 'nav-link active fw-bold text-forest' : 'nav-link text-muted';
  document.getElementById('loginPane').className = mode === 'login' ? 'tab-pane fade show active' : 'tab-pane fade';
  document.getElementById('registerPane').className = mode === 'register' ? 'tab-pane fade show active' : 'tab-pane fade';

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('authModal'));
  modal.show();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  const user = state.users.find(u => u.email.toLowerCase() === email);
  if (!user) {
    showToast('Geen account gevonden met dit e-mailadres.', 'danger');
    return;
  }

  const hash = await hashPassword(password);
  if (user.passwordHash !== hash) {
    showToast('Ongeldig wachtwoord.', 'danger');
    return;
  }

  state.currentUser = user;
  saveCurrentUser();
  bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
  showToast(`Welkom terug, ${user.name}! Je bent ingelogd.`, 'success');
  renderApp();
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
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

  bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
  showToast(`Welkom ${name}! Je account is direct geactiveerd en je bent nu ingelogd.`, 'success');
  renderApp();
}

function logout() {
  state.currentUser = null;
  saveCurrentUser();
  showToast('Je bent succesvol uitgelogd.', 'info');
  renderApp();
}

// --- SESSIE DETAIL & INTEKENEN ---
function openSessionDetail(sessionId) {
  const sess = state.sessions.find(s => s.id === sessionId);
  if (!sess) return;

  const modalEl = document.getElementById('sessionDetailModal');
  const isEvent = sess.sessionType === 'event';

  // Header
  document.getElementById('detailTitle').textContent = sess.title;
  document.getElementById('detailBadge').className = `badge ${isEvent ? 'bg-warning text-dark' : 'bg-success-subtle text-success'} px-3 py-1 rounded-pill`;
  document.getElementById('detailBadge').textContent = isEvent ? '🏆 Uiteindelijk Sportevent' : '🏃 Teamtrainingssessie';

  // Details
  document.getElementById('detailDate').textContent = formatDateNL(sess.date);
  document.getElementById('detailTime').textContent = `${sess.startTime} uur`;
  document.getElementById('detailLocation').textContent = sess.location;
  document.getElementById('detailMapsLink').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sess.location)}`;
  document.getElementById('detailDistance').textContent = sess.distanceKm ? `${sess.distanceKm} km` : 'Vrij te kiezen';
  document.getElementById('detailPace').textContent = sess.targetPace || 'Vrij / Regulier tempo';
  document.getElementById('detailDescription').textContent = sess.description || 'Geen extra toelichting.';
  document.getElementById('detailCreator').textContent = sess.creatorName;

  // Route link
  const routeBox = document.getElementById('detailRouteContainer');
  if (sess.routeUrl) {
    routeBox.innerHTML = `<a href="${sess.routeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-forest btn-sm"><i class="bi bi-link-45deg me-1"></i> Open Route / GPX / Kaart</a>`;
    routeBox.style.display = 'block';
  } else {
    routeBox.style.display = 'none';
  }

  // WhatsApp Deelknop
  const shareText = encodeURIComponent(`🥾 *Dodentocht Teamtraining: ${sess.title}*\n📅 Datum: ${formatDateNL(sess.date)}\n⏰ Tijd: ${sess.startTime}u\n📍 Start: ${sess.location}\n📏 Afstand: ${sess.distanceKm ? sess.distanceKm + ' km' : 'Variabel'}\n\n👉 Teken hier in: ${window.location.href}`);
  document.getElementById('detailShareWhatsApp').href = `https://api.whatsapp.com/send?text=${shareText}`;

  // Knoppen bewerken / verwijderen
  const canEdit = state.currentUser && (
    state.currentUser.id === sess.creatorId ||
    ['admin', 'developer'].includes(state.currentUser.role)
  );

  const editContainer = document.getElementById('detailEditControls');
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

  // Intekenen formulier
  renderRsvpForm(sess.id);
  renderAttendeesList(sess.id);

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function renderRsvpForm(sessionId) {
  const container = document.getElementById('detailRsvpContainer');
  if (!state.currentUser) {
    container.innerHTML = `
      <div class="alert alert-info d-flex align-items-center mb-0">
        <i class="bi bi-info-circle fs-4 me-2"></i>
        <div>
          <strong>Meld je aan om in te tekenen:</strong>
          Log in of maak een account om onder jouw naam aanwezig te melden.
          <div class="mt-2">
            <button class="btn btn-forest btn-sm me-2" onclick="bootstrap.Modal.getInstance(document.getElementById('sessionDetailModal')).hide(); openAuthModal('login');">Inloggen</button>
            <button class="btn btn-accent btn-sm text-dark fw-bold" onclick="bootstrap.Modal.getInstance(document.getElementById('sessionDetailModal')).hide(); openAuthModal('register');">Registreren</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const myReg = state.registrations.find(r => r.sessionId === sessionId && r.userId === state.currentUser.id);
  const curStatus = myReg ? myReg.status : 'present';
  const curNote = myReg ? myReg.note || '' : '';

  container.innerHTML = `
    <form onsubmit="handleRsvpSubmit(event, '${sessionId}')">
      <div class="mb-3">
        <label class="form-label small text-muted text-uppercase fw-bold">Jouw Aanwezigheid</label>
        <div class="d-grid gap-2">
          <input type="radio" class="btn-check" name="rsvpStatus" id="rsvp_present" value="present" ${curStatus === 'present' ? 'checked' : ''}>
          <label class="btn btn-outline-success text-start p-2" for="rsvp_present">
            <i class="bi bi-check-circle-fill fs-5 me-2"></i> <strong>Aanwezig</strong> (Ik doe mee!)
          </label>

          <input type="radio" class="btn-check" name="rsvpStatus" id="rsvp_maybe" value="maybe" ${curStatus === 'maybe' ? 'checked' : ''}>
          <label class="btn btn-outline-warning text-start p-2" for="rsvp_maybe">
            <i class="bi bi-question-circle-fill fs-5 me-2"></i> <strong>Misschien</strong> (Nog onzeker)
          </label>

          <input type="radio" class="btn-check" name="rsvpStatus" id="rsvp_absent" value="absent" ${curStatus === 'absent' ? 'checked' : ''}>
          <label class="btn btn-outline-secondary text-start p-2" for="rsvp_absent">
            <i class="bi bi-x-circle-fill fs-5 me-2"></i> <strong>Afwezig</strong> (Kan helaas niet)
          </label>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label small text-muted text-uppercase fw-bold">Opmerking (optioneel)</label>
        <input type="text" class="form-control" id="rsvpNote" placeholder="Bv. Carpool vanuit Antwerpen, loop 20km mee..." value="${curNote}">
      </div>

      <button type="submit" class="btn btn-forest w-100 py-2 fw-bold">
        <i class="bi bi-check2-circle me-1"></i> Keuze Opslaan
      </button>

      ${myReg ? `
        <button type="button" class="btn btn-link text-muted btn-sm w-100 mt-2 text-decoration-none" onclick="cancelRsvp('${sessionId}')">
          <i class="bi bi-dash-circle me-1"></i> Inschrijving intrekken
        </button>
      ` : ''}
    </form>
  `;
}

function renderAttendeesList(sessionId) {
  const container = document.getElementById('detailAttendeesContainer');
  const regs = state.registrations.filter(r => r.sessionId === sessionId);
  const present = regs.filter(r => r.status === 'present');
  const maybe = regs.filter(r => r.status === 'maybe');

  document.getElementById('detailAttendeesCount').textContent = `${present.length} aanwezig`;

  if (present.length === 0 && maybe.length === 0) {
    container.innerHTML = '<p class="text-muted small fst-italic mb-0">Nog geen inschrijvingen voor deze sessie.</p>';
    return;
  }

  let html = '';
  if (present.length > 0) {
    html += '<h6 class="small text-muted text-uppercase fw-bold mb-2">Aanwezig:</h6><ul class="list-group list-group-flush mb-3">';
    present.forEach(r => {
      html += `
        <li class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center">
            <span class="avatar-chip bg-forest text-white me-2" style="width:30px;height:30px;font-size:0.8rem;">${r.userName[0].toUpperCase()}</span>
            <div>
              <strong class="text-dark d-block">${r.userName}</strong>
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
            <span class="avatar-chip bg-warning text-dark me-2" style="width:30px;height:30px;font-size:0.8rem;">${r.userName[0].toUpperCase()}</span>
            <div>
              <span class="text-dark d-block">${r.userName}</span>
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

function handleRsvpSubmit(e, sessionId) {
  e.preventDefault();
  if (!state.currentUser) return;

  const selectedStatus = document.querySelector('input[name="rsvpStatus"]:checked').value;
  const note = document.getElementById('rsvpNote').value.trim();

  const existingIndex = state.registrations.findIndex(r => r.sessionId === sessionId && r.userId === state.currentUser.id);
  if (existingIndex >= 0) {
    state.registrations[existingIndex].status = selectedStatus;
    state.registrations[existingIndex].note = note;
    state.registrations[existingIndex].registeredAt = new Date().toISOString();
  } else {
    state.registrations.push({
      id: 'reg_' + Date.now(),
      sessionId,
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      status: selectedStatus,
      note,
      registeredAt: new Date().toISOString()
    });
  }

  saveRegistrations();
  showToast('Je aanwezigheid is bijgewerkt!', 'success');
  renderRsvpForm(sessionId);
  renderAttendeesList(sessionId);
  renderSessionCards();
}

function cancelRsvp(sessionId) {
  if (!state.currentUser) return;
  state.registrations = state.registrations.filter(r => !(r.sessionId === sessionId && r.userId === state.currentUser.id));
  saveRegistrations();
  showToast('Je inschrijving is ingetrokken.', 'info');
  renderRsvpForm(sessionId);
  renderAttendeesList(sessionId);
  renderSessionCards();
}

// --- SESSIE AANMAKEN & BEWERKEN ---
function openSessionForm(editSessionId = null) {
  if (!state.currentUser) {
    openAuthModal('login');
    return;
  }

  const modalEl = document.getElementById('sessionFormModal');
  const titleEl = document.getElementById('sessionFormModalTitle');
  const idInput = document.getElementById('formSessionId');

  if (editSessionId) {
    const sess = state.sessions.find(s => s.id === editSessionId);
    if (!sess) return;
    titleEl.textContent = 'Sessie Bewerken';
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
    titleEl.textContent = 'Nieuwe Trainingssessie Plannen';
    idInput.value = '';
    document.getElementById('sessionForm').reset();
    document.getElementById('formDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('formStartTime').value = '09:00';
  }

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function editSession(sessionId) {
  bootstrap.Modal.getInstance(document.getElementById('sessionDetailModal')).hide();
  openSessionForm(sessionId);
}

function deleteSession(sessionId) {
  if (!confirm('Weet je zeker dat je deze sessie wilt verwijderen?')) return;
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  state.registrations = state.registrations.filter(r => r.sessionId !== sessionId);
  saveSessions();
  saveRegistrations();
  bootstrap.Modal.getInstance(document.getElementById('sessionDetailModal')).hide();
  showToast('Sessie is verwijderd.', 'info');
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
      showToast('Sessie succesvol bijgewerkt!', 'success');
    }
  } else {
    // Nieuwe sessie aanmaken
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
    showToast('Nieuwe sessie aangemaakt en je bent automatisch ingetekend!', 'success');
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
  container.innerHTML = state.users.map(u => {
    const isMe = state.currentUser && state.currentUser.id === u.id;
    return `
      <tr>
        <td class="ps-3">
          <div class="d-flex align-items-center">
            <span class="avatar-chip ${u.role === 'developer' ? 'bg-warning text-dark' : u.role === 'admin' ? 'bg-primary text-white' : 'bg-secondary text-white'} me-2">
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
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>Deelnemer (User)</option>
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
    gdprVerklaring: "Overzicht persoonsgegevens conform Algemene Verordening Gegevensbescherming (AVG/GDPR).",
    gebruiker: {
      id: state.currentUser.id,
      name: state.currentUser.name,
      email: state.currentUser.email,
      role: state.currentUser.role,
      phone: state.currentUser.phone,
      emergencyContact: state.currentUser.emergencyContact
    },
    mijnSessies: state.sessions.filter(s => s.creatorId === state.currentUser.id),
    mijnIntekeningen: state.registrations.filter(r => r.userId === state.currentUser.id)
  };

  const blob = new Blob([JSON.stringify(myData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gdpr-data-${state.currentUser.name.replace(/\s+/g, '_')}.json`;
  a.click();
}

// --- BACKUP & CLOUD SYNC MODAL ---
function openSyncModal() {
  document.getElementById('syncUrlInput').value = state.syncUrl || '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('syncModal')).show();
}

function saveSyncUrl() {
  const val = document.getElementById('syncUrlInput').value.trim();
  state.syncUrl = val;
  localStorage.setItem(STORAGE_KEYS.SYNC_CONFIG, val);
  if (val) {
    pullCloudData();
    showToast('Cloud Sync URL opgeslagen en gesynchroniseerd!', 'success');
  } else {
    updateSyncBadge(false);
    showToast('Cloud Sync uitgeschakeld. Data wordt lokaal bewaard.', 'info');
  }
}

function downloadFullBackup() {
  const backup = {
    versie: '2.0',
    timestamp: new Date().toISOString(),
    users: state.users,
    sessions: state.sessions,
    registrations: state.registrations
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dodentocht-database-backup-${new Date().toISOString().split('T')[0]}.json`;
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

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Automatische achtergrondsynchronisatie (elke 15s en wanneer tabblad actief wordt)
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
