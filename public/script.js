const API = '/api';
const tokenKey = 'erasmus-token';
const profileKey = 'erasmus-profile';
const themeKey = 'erasmus-theme';
const fontKey = 'erasmus-font-size';
const accentKey = 'erasmus-accent';

const navToggle = document.querySelector('[data-menu-toggle]');
const navList = document.querySelector('[data-nav-list]');
navToggle?.addEventListener('click', () => navList?.classList.toggle('open'));

function token() { return localStorage.getItem(tokenKey); }
function saveProfile(profile) { localStorage.setItem(profileKey, JSON.stringify(profile)); }
function loadProfile() { try { return JSON.parse(localStorage.getItem(profileKey) || '{}'); } catch { return {}; } }
function setAuth(data) { localStorage.setItem(tokenKey, data.token); saveProfile(data.user); }
function isAuthenticated() { return Boolean(token()); }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function requireAuthForPage() {
  const needsAuth = document.body.dataset.requiresAuth === 'true';
  if (needsAuth && !isAuthenticated()) window.location.href = 'index.html';
}
requireAuthForPage();

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(profileKey);
    window.location.href = 'index.html';
  });
});

const showLogin = document.getElementById('showLogin');
const showRegister = document.getElementById('showRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authStatus = document.getElementById('authStatus');

function activateTab(mode) {
  if (!showLogin || !showRegister || !loginForm || !registerForm) return;
  showLogin.classList.toggle('active', mode === 'login');
  showRegister.classList.toggle('active', mode === 'register');
  loginForm.classList.toggle('hidden', mode !== 'login');
  registerForm.classList.toggle('hidden', mode !== 'register');
}
showLogin?.addEventListener('click', () => activateTab('login'));
showRegister?.addEventListener('click', () => activateTab('register'));

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
      }),
    });
    setAuth(data);
    if (authStatus) authStatus.textContent = `Welcome back, ${data.user.name}. Redirecting to your planner...`;
    window.location.href = 'home.html';
  } catch (error) {
    if (authStatus) authStatus.textContent = error.message;
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('registerName').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        country: document.getElementById('registerCountry').value.trim(),
        semester: document.getElementById('registerSemester').value.trim(),
        password: document.getElementById('registerPassword').value,
      }),
    });
    setAuth(data);
    if (authStatus) authStatus.textContent = `Account created for ${data.user.name}. Redirecting...`;
    window.location.href = 'home.html';
  } catch (error) {
    if (authStatus) authStatus.textContent = error.message;
  }
});

const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileCountry = document.getElementById('profileCountry');
const profileSemester = document.getElementById('profileSemester');
const profileNotesPreview = document.getElementById('profileNotesPreview');
const summaryCountry = document.getElementById('summaryCountry');
const summarySemester = document.getElementById('summarySemester');
const summaryName = document.getElementById('summaryName');
const profileForm = document.getElementById('profileForm');
const profileStatus = document.getElementById('profileStatus');

function applyProfile(profile) {
  if (profile.name && profileName) profileName.textContent = profile.name;
  if (profile.email && profileEmail) profileEmail.textContent = profile.email;
  if (profile.country && profileCountry) profileCountry.textContent = profile.country;
  if (profile.semester && profileSemester) profileSemester.textContent = profile.semester;
  if (profile.country && summaryCountry) summaryCountry.textContent = profile.country;
  if (profile.semester && summarySemester) summarySemester.textContent = profile.semester;
  if (profile.name && summaryName) summaryName.textContent = profile.name;
  if (profile.notes && profileNotesPreview) profileNotesPreview.textContent = profile.notes;
}
applyProfile(loadProfile());

async function loadMe() {
  if (!isAuthenticated()) return;
  try {
    const data = await api('/me');
    saveProfile(data.user);
    applyProfile(data.user);
  } catch { localStorage.removeItem(tokenKey); }
}
loadMe();

profileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const current = loadProfile();
  const updated = {
    name: document.getElementById('profileNameInput')?.value.trim() || current.name || 'Student',
    email: document.getElementById('profileEmailInput')?.value.trim() || current.email || 'student@vdu.lt',
    country: document.getElementById('profileCountryInput')?.value.trim() || current.country || 'Spain',
    semester: document.getElementById('profileSemesterInput')?.value.trim() || current.semester || 'Fall 2026',
    notes: document.getElementById('profileNotes')?.value.trim() || current.notes || 'Need host university course approval and accommodation search.',
  };
  try {
    const data = await api('/me', { method: 'PUT', body: JSON.stringify(updated) });
    saveProfile(data.user);
    applyProfile(data.user);
    if (profileStatus) profileStatus.textContent = 'Profile information saved in the database.';
    profileForm.reset();
  } catch (error) {
    if (profileStatus) profileStatus.textContent = error.message;
  }
});

const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const taskPreviewList = document.getElementById('taskPreviewList');
const openTaskCount = document.getElementById('openTaskCount');
const statusFilter = document.getElementById('statusFilter');
const taskSearch = document.getElementById('taskSearch');
const taskSearchBtn = document.getElementById('taskSearchBtn');
const taskSearchStatus = document.getElementById('taskSearchStatus');
const taskSubmitBtn = document.getElementById('taskSubmitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let tasks = [];

function renderTasks() {
  if (!taskList) return;
  taskList.innerHTML = tasks.map(task => `
    <li data-id="${task.id}" data-status="${task.status}" class="${task.status === 'completed' ? 'done' : ''}">
      <div class="task-row">
        <div>
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">${task.status === 'completed' ? 'Completed' : task.deadline} • ${escapeHtml(task.category || 'General')}</div>
        </div>
        <div class="task-actions">
          <button type="button" class="small-btn edit-btn">Edit</button>
          <button type="button" class="small-btn complete-btn">${task.status === 'completed' ? 'Undo' : 'Complete'}</button>
          <button type="button" class="small-btn danger delete-btn">Delete</button>
        </div>
      </div>
    </li>`).join('');
  countOpenTasks();
  syncPreview();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function countOpenTasks() {
  if (openTaskCount) openTaskCount.textContent = String(tasks.filter(t => t.status === 'pending').length);
}
function syncPreview() {
  if (!taskPreviewList) return;
  taskPreviewList.innerHTML = tasks.slice(0, 3).map(t => `<li><div class="task-row"><div><div class="task-title">${escapeHtml(t.title)}</div><div class="task-meta">${t.status === 'completed' ? 'Completed' : t.deadline}</div></div></div></li>`).join('');
}
async function loadTasks() {
  if (!taskList) return;
  try {
    const status = statusFilter?.value || 'all';
    const q = taskSearch?.value || '';
    const data = await api(`/tasks?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
    tasks = data.tasks;
    renderTasks();
    if (taskSearchStatus) taskSearchStatus.textContent = data.message || `${tasks.length} task(s) found.`;
  } catch (error) {
    if (taskSearchStatus) taskSearchStatus.textContent = error.message;
  }
}

function resetTaskForm() {
  document.getElementById('taskId').value = '';
  taskForm?.reset();
  if (taskSubmitBtn) taskSubmitBtn.textContent = 'Add task';
}

taskForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('taskId').value;
  const payload = {
    title: document.getElementById('taskTitle').value.trim(),
    deadline: document.getElementById('taskDeadline').value,
    category: document.getElementById('taskCategory')?.value.trim() || 'General',
    status: document.getElementById('taskStatus').value,
  };
  try {
    await api(id ? `/tasks/${id}` : '/tasks', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    resetTaskForm();
    await loadTasks();
  } catch (error) { if (taskSearchStatus) taskSearchStatus.textContent = error.message; }
});

cancelEditBtn?.addEventListener('click', resetTaskForm);
statusFilter?.addEventListener('change', loadTasks);
taskSearchBtn?.addEventListener('click', loadTasks);
taskSearch?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); loadTasks(); } });

taskList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const item = target.closest('li');
  if (!item) return;
  const id = item.dataset.id;
  const task = tasks.find(t => String(t.id) === String(id));
  if (!task) return;
  try {
    if (target.classList.contains('delete-btn')) await api(`/tasks/${id}`, { method: 'DELETE' });
    if (target.classList.contains('complete-btn')) await api(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ ...task, status: task.status === 'completed' ? 'pending' : 'completed' }) });
    if (target.classList.contains('edit-btn')) {
      document.getElementById('taskId').value = task.id;
      document.getElementById('taskTitle').value = task.title;
      document.getElementById('taskDeadline').value = task.deadline;
      document.getElementById('taskCategory').value = task.category || 'General';
      document.getElementById('taskStatus').value = task.status;
      if (taskSubmitBtn) taskSubmitBtn.textContent = 'Save changes';
      return;
    }
    await loadTasks();
  } catch (error) { if (taskSearchStatus) taskSearchStatus.textContent = error.message; }
});
loadTasks();

const documentForm = document.getElementById('documentForm');
const documentList = document.getElementById('documentList');
const docCount = document.getElementById('docCount');
let documents = [];
function renderDocuments() {
  if (!documentList) return;
  documentList.innerHTML = documents.map(d => `<li data-id="${d.id}"><div class="doc-row"><div><strong>${escapeHtml(d.file_name)}</strong><div class="doc-meta">${escapeHtml(d.title)} ${d.description ? '— ' + escapeHtml(d.description) : ''}</div></div><button type="button" class="small-btn danger delete-doc-btn">Delete</button></div></li>`).join('');
  if (docCount) docCount.textContent = String(documents.length);
}
async function loadDocuments() {
  if (!documentList) return;
  const data = await api('/documents');
  documents = data.documents;
  renderDocuments();
}
documentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = document.getElementById('documentTitle').value.trim();
  const fileInput = document.getElementById('documentFile');
  const fileName = fileInput.files[0]?.name || `${title || 'document'}.pdf`;
  await api('/documents', { method: 'POST', body: JSON.stringify({ title, fileName, description: 'Added to planner' }) });
  documentForm.reset();
  await loadDocuments();
});
documentList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains('delete-doc-btn')) return;
  const id = target.closest('li')?.dataset.id;
  if (id) { await api(`/documents/${id}`, { method: 'DELETE' }); await loadDocuments(); }
});
loadDocuments();

const themeToggle = document.getElementById('themeToggle');
const fontSlider = document.getElementById('fontSlider');
const fontValue = document.getElementById('fontValue');
const colorPicker = document.getElementById('colorPicker');
const messageBtn = document.getElementById('messageBtn');
const announcementText = document.getElementById('announcementText');
const toggleDocsBtn = document.getElementById('toggleDocsBtn');
const documentsBlock = document.getElementById('documentsBlock');
const reminderOptions = [
  'Remember to confirm the final course list before the Learning Agreement is signed.',
  'Accommodation search should start early because popular student housing fills quickly.',
  'Check whether insurance coverage dates match your whole mobility period.'
];
let reminderIndex = 0;

if (localStorage.getItem(themeKey) === 'dark') { document.body.classList.add('dark'); if (themeToggle) themeToggle.checked = true; }
const savedFontSize = localStorage.getItem(fontKey);
if (savedFontSize) { document.documentElement.style.setProperty('--base-font', savedFontSize); if (fontSlider) fontSlider.value = parseInt(savedFontSize, 10); if (fontValue) fontValue.textContent = savedFontSize; }
const savedAccent = localStorage.getItem(accentKey);
if (savedAccent) { document.documentElement.style.setProperty('--accent', savedAccent); if (colorPicker) colorPicker.value = savedAccent; }

themeToggle?.addEventListener('change', () => { document.body.classList.toggle('dark'); localStorage.setItem(themeKey, document.body.classList.contains('dark') ? 'dark' : 'light'); });
fontSlider?.addEventListener('input', event => { const size = `${event.target.value}px`; document.documentElement.style.setProperty('--base-font', size); localStorage.setItem(fontKey, size); if (fontValue) fontValue.textContent = size; });
colorPicker?.addEventListener('input', event => { document.documentElement.style.setProperty('--accent', event.target.value); localStorage.setItem(accentKey, event.target.value); });
messageBtn?.addEventListener('click', () => { reminderIndex = (reminderIndex + 1) % reminderOptions.length; if (announcementText) announcementText.textContent = reminderOptions[reminderIndex]; });
toggleDocsBtn?.addEventListener('click', () => documentsBlock?.classList.toggle('hidden'));

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const closeLightbox = document.getElementById('closeLightbox');
document.querySelectorAll('[data-lightbox-item]').forEach(item => {
  item.addEventListener('click', () => {
    const image = item.querySelector('img');
    if (!image || !lightbox || !lightboxImage) return;
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightbox.showModal();
  });
});
closeLightbox?.addEventListener('click', () => lightbox?.close());
lightbox?.addEventListener('click', (event) => {
  const rect = lightbox.getBoundingClientRect();
  const inside = rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width;
  if (!inside) lightbox.close();
});

/* ============================================================
   API 1 — STATIC HTML API: REST Countries destination widget
   Fetches fixed country data for the student's saved destination.
   No user input required — renders automatically on home.html.
   ============================================================ */
async function loadCountryInfo() {
  const widget = document.getElementById('countryInfoWidget');
  if (!widget) return;

  const profile = loadProfile();
  const country = (profile.country || 'Spain').trim();

  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=name,flags,capital,currencies,languages,population,region`
    );
    if (!res.ok) throw new Error('Country not found');
    const data = await res.json();
    const c = data[0];

    const currencies = Object.values(c.currencies || {})
      .map(cur => `${cur.name} (${cur.symbol || '—'})`).join(', ') || '—';
    const languages = Object.values(c.languages || {}).join(', ') || '—';
    const capital = (c.capital || ['—'])[0];
    const population = c.population
      ? Number(c.population).toLocaleString('en-US')
      : '—';
    const flagUrl = c.flags?.svg || c.flags?.png || '';
    const officialName = c.name?.official || c.name?.common || country;

    widget.innerHTML = `
      <div class="country-card-inner">
        <div class="country-flag-panel">
          ${flagUrl ? `<img src="${flagUrl}" alt="Flag of ${officialName}" />` : ''}
          <div class="country-name-big">${officialName}</div>
        </div>
        <div class="country-details-panel">
          <div class="country-detail-item">
            <div class="country-detail-label">Capital</div>
            <div class="country-detail-value">${capital}</div>
          </div>
          <div class="country-detail-item">
            <div class="country-detail-label">Region</div>
            <div class="country-detail-value">${c.region || '—'}</div>
          </div>
          <div class="country-detail-item">
            <div class="country-detail-label">Population</div>
            <div class="country-detail-value">${population}</div>
          </div>
          <div class="country-detail-item">
            <div class="country-detail-label">Currency</div>
            <div class="country-detail-value">${currencies}</div>
          </div>
          <div class="country-detail-item">
            <div class="country-detail-label">Languages</div>
            <div class="country-detail-value">${languages}</div>
          </div>
          <div class="country-detail-item">
            <div class="country-detail-label">Source</div>
            <div class="country-detail-value" style="font-size:0.82rem;color:var(--muted)">restcountries.com</div>
          </div>
        </div>
      </div>`;
  } catch (err) {
    widget.innerHTML = `<p class="country-error">Could not load data for "${country}". Check your profile destination or try again.</p>`;
  }
}
loadCountryInfo();


/* ============================================================
   API 2 — DYNAMIC HTML + JS API: wttr.in weather search
   User types a city → JS fetches live weather from wttr.in JSON API
   → response rendered dynamically without page reload.
   ============================================================ */
const weatherCityInput = document.getElementById('weatherCityInput');
const weatherSearchBtn = document.getElementById('weatherSearchBtn');
const weatherStatus    = document.getElementById('weatherStatus');
const weatherResult    = document.getElementById('weatherResult');

function weatherEmoji(code) {
  if (code <= 113) return '☀️';
  if (code <= 176) return '⛅';
  if (code <= 260) return '🌫️';
  if (code <= 299) return '🌦️';
  if (code <= 374) return '🌧️';
  if (code <= 395) return '❄️';
  return '🌩️';
}

async function fetchWeather() {
  if (!weatherSearchBtn) return;
  const city = weatherCityInput?.value.trim();
  if (!city) { if (weatherStatus) weatherStatus.textContent = 'Please enter a city name.'; return; }

  if (weatherStatus) weatherStatus.textContent = 'Fetching weather…';
  if (weatherResult) weatherResult.classList.add('hidden');
  weatherSearchBtn.disabled = true;

  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    if (!res.ok) throw new Error('City not found');
    const data = await res.json();

    const current = data.current_condition?.[0];
    const area    = data.nearest_area?.[0];
    if (!current) throw new Error('No weather data returned');

    const tempC    = current.temp_C;
    const feelsC   = current.FeelsLikeC;
    const desc     = current.weatherDesc?.[0]?.value || '—';
    const humidity = current.humidity;
    const windKmph = current.windspeedKmph;
    const visibility = current.visibility;
    const code     = Number(current.weatherCode || 113);
    const cityName = area?.areaName?.[0]?.value || city;
    const country  = area?.country?.[0]?.value || '';

    if (weatherResult) {
      weatherResult.innerHTML = `
        <div class="weather-grid">
          <div class="weather-main">
            <span class="weather-emoji">${weatherEmoji(code)}</span>
            <span class="weather-temp">${tempC}°C</span>
            <span class="weather-desc">${desc}</span>
            <span class="weather-city-name">${cityName}${country ? ', ' + country : ''}</span>
          </div>
          <div class="weather-stats">
            <div class="weather-stat"><span>Feels like</span><strong>${feelsC}°C</strong></div>
            <div class="weather-stat"><span>Humidity</span><strong>${humidity}%</strong></div>
            <div class="weather-stat"><span>Wind</span><strong>${windKmph} km/h</strong></div>
            <div class="weather-stat"><span>Visibility</span><strong>${visibility} km</strong></div>
            <div class="weather-stat" style="color:var(--muted);font-size:0.82rem;border:none;padding:0.3rem 0"><span>Source: wttr.in</span></div>
          </div>
        </div>`;
      weatherResult.classList.remove('hidden');
    }
    if (weatherStatus) weatherStatus.textContent = '';
  } catch (err) {
    if (weatherStatus) weatherStatus.textContent = `Could not load weather: ${err.message}`;
  } finally {
    weatherSearchBtn.disabled = false;
  }
}

weatherSearchBtn?.addEventListener('click', fetchWeather);
weatherCityInput?.addEventListener('keydown', e => { if (e.key === 'Enter') fetchWeather(); });

// Auto-fill weather with profile country on load
(function prefillWeatherCity() {
  if (!weatherCityInput) return;
  const profile = loadProfile();
  if (profile.country) weatherCityInput.value = profile.country;
})();


/* ============================================================
   API 3 — DATABASE-CONNECTED API: EUR Exchange Rate Tracker
   Fetches live EUR→target currency rate from exchangerate.host
   (free, no API key needed) → saves to server DB via /api/exchange-rates
   → loads saved history from DB and displays it on profile page.
   ============================================================ */
const fetchRateBtn     = document.getElementById('fetchRateBtn');
const currencySelect   = document.getElementById('currencySelect');
const rateStatus       = document.getElementById('rateStatus');
const rateResultBox    = document.getElementById('rateResultBox');
const rateValue        = document.getElementById('rateValue');
const rateCurrency     = document.getElementById('rateCurrency');
const savedRatesList   = document.getElementById('savedRatesList');

async function loadSavedRates() {
  if (!savedRatesList) return;
  try {
    const data = await api('/exchange-rates');
    const rates = data.rates || [];
    if (!rates.length) {
      savedRatesList.innerHTML = '<li class="meta" style="border:none;padding:0.4rem 0">No rates saved yet.</li>';
      return;
    }
    savedRatesList.innerHTML = rates.map(r => `
      <li>
        <div class="saved-rate-entry">
          <span>1 EUR → <span class="saved-rate-amount">${Number(r.rate).toFixed(4)} ${r.currency}</span></span>
          <span class="saved-rate-date">${r.fetched_at?.slice(0, 10) || '—'}</span>
        </div>
      </li>`).join('');
  } catch {
    // silently ignore if route not yet set up
  }
}

async function fetchAndSaveRate() {
  if (!fetchRateBtn) return;
  const currency = currencySelect?.value || 'PLN';
  if (rateStatus) rateStatus.textContent = 'Fetching live rate…';
  fetchRateBtn.disabled = true;

  try {
    // POST to our own backend — server fetches from frankfurter.app and saves to DB
    // This avoids browser CORS issues with the external API
    const data = await api('/exchange-rates', {
      method: 'POST',
      body: JSON.stringify({ currency })
    });

    const rate = data.rate?.rate;
    if (!rate) throw new Error('Rate not returned from server');

    // Display result
    if (rateValue) rateValue.textContent = Number(rate).toFixed(4);
    if (rateCurrency) rateCurrency.textContent = currency;
    if (rateResultBox) rateResultBox.classList.remove('hidden');

    if (rateStatus) rateStatus.textContent = `Rate saved: 1 EUR = ${Number(rate).toFixed(4)} ${currency}`;
    await loadSavedRates();
  } catch (err) {
    if (rateStatus) rateStatus.textContent = `Error: ${err.message}`;
  } finally {
    fetchRateBtn.disabled = false;
  }
}

fetchRateBtn?.addEventListener('click', fetchAndSaveRate);
loadSavedRates();
