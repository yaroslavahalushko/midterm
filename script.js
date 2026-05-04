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

// =============================
// Midterm: third-party API functionality integrated into planner page
// =============================
const loadErasmusStaticBtn = document.getElementById('loadErasmusStaticBtn');
const erasmusStaticCard = document.getElementById('erasmusStaticCard');
const weatherForm = document.getElementById('weatherForm');
const weatherResult = document.getElementById('weatherResult');
const destinationCheckForm = document.getElementById('destinationCheckForm');
const destinationCountryInput = document.getElementById('destinationCountryInput');
const destinationCheckStatus = document.getElementById('destinationCheckStatus');
const destinationCheckList = document.getElementById('destinationCheckList');

function renderApiError(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="api-alert">${escapeHtml(message)}</div>`;
}

async function loadStaticErasmusApi() {
  if (!erasmusStaticCard) return;
  erasmusStaticCard.textContent = 'Loading fixed content from the official Erasmus+ server...';
  try {
    const data = await api('/external/erasmus-static');
    erasmusStaticCard.innerHTML = data.html;
  } catch (error) {
    renderApiError(erasmusStaticCard, error.message);
  }
}

loadErasmusStaticBtn?.addEventListener('click', loadStaticErasmusApi);
if (erasmusStaticCard) loadStaticErasmusApi();

function describeWeatherCode(code) {
  const labels = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Slight rain showers',
    81: 'Moderate rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm'
  };
  return labels[code] || 'Weather data available';
}

async function fetchThirdPartyJson(url, errorMessage) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(errorMessage);
  return response.json();
}

weatherForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!weatherResult) return;
  const city = document.getElementById('weatherCity')?.value.trim();
  weatherResult.textContent = 'JavaScript is sending your city request directly to Open-Meteo...';

  try {
    const encodedCity = encodeURIComponent(city);
    const locationData = await fetchThirdPartyJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodedCity}&count=1&language=en&format=json`,
      'Could not find the city in the third-party geocoding API.'
    );
    const location = locationData.results?.[0];
    if (!location) throw new Error('City was not found by the external geocoding API.');

    const forecast = await fetchThirdPartyJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,
      'Could not load forecast data from Open-Meteo.'
    );
    const current = forecast.current || {};
    const dailyRows = (forecast.daily?.time || []).map((date, index) => `
      <tr>
        <td>${escapeHtml(date)}</td>
        <td>${forecast.daily.temperature_2m_min?.[index] ?? '–'}°C</td>
        <td>${forecast.daily.temperature_2m_max?.[index] ?? '–'}°C</td>
      </tr>`).join('');

    weatherResult.innerHTML = `
      <div class="external-result-card">
        <span class="api-pill">Dynamic JS API</span>
        <h3>${escapeHtml(location.name)}, ${escapeHtml(location.country || '')}</h3>
        <p><strong>Current weather:</strong> ${escapeHtml(describeWeatherCode(current.weather_code))}.</p>
        <p><strong>Temperature:</strong> ${current.temperature_2m ?? '–'}°C &nbsp; <strong>Wind:</strong> ${current.wind_speed_10m ?? '–'} km/h</p>
        <div class="table-wrap mini-table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>${dailyRows}</tbody>
          </table>
        </div>
        <p class="meta">Source: Open-Meteo Geocoding API and Forecast API. Coordinates: ${location.latitude}, ${location.longitude}</p>
      </div>`;
  } catch (error) {
    renderApiError(weatherResult, error.message);
  }
});

function renderDestinationChecks(records) {
  if (!destinationCheckList) return;

  if (!records.length) {
    destinationCheckList.innerHTML = '<li class="meta">No saved destination API records yet.</li>';
    return;
  }

  destinationCheckList.innerHTML = records.map(record => `
    <li data-id="${record.id}">
      <div class="destination-check-row">
        ${record.flag ? `<img class="country-flag" src="${record.flag}" alt="Flag of ${escapeHtml(record.common_name)}" />` : ''}
        <div>
          <strong>${escapeHtml(record.common_name)}</strong>
          <div class="doc-meta">${escapeHtml(record.official_name)}</div>
          <div class="doc-meta">Capital: ${escapeHtml(record.capital || 'Not listed')} • Currency: ${escapeHtml(record.currency || 'Not listed')}</div>
          <div class="doc-meta">Languages: ${escapeHtml(record.languages || 'Not listed')}</div>
          <div class="doc-meta">Saved from third-party API on ${escapeHtml(record.created_at || '')}</div>
        </div>
        <button type="button" class="small-btn danger delete-destination-check-btn">Delete</button>
      </div>
    </li>`).join('');
}

async function loadDestinationChecks() {
  if (!destinationCheckList) return;
  try {
    const data = await api('/destination-checks');
    renderDestinationChecks(data.checks || []);
  } catch (error) {
    renderApiError(destinationCheckList, error.message);
  }
}

destinationCheckForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const country = destinationCountryInput?.value.trim();
  if (!country) return;

  if (destinationCheckStatus) destinationCheckStatus.textContent = 'Retrieving country data from REST Countries and saving it to SQLite...';

  try {
    const data = await api('/destination-checks', {
      method: 'POST',
      body: JSON.stringify({ country })
    });
    if (destinationCheckStatus) {
      destinationCheckStatus.textContent = `${data.check.common_name} was saved to the database from the third-party API.`;
    }
    await loadDestinationChecks();
  } catch (error) {
    if (destinationCheckStatus) destinationCheckStatus.textContent = error.message;
  }
});

destinationCheckList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains('delete-destination-check-btn')) return;
  const id = target.closest('li')?.dataset.id;
  if (!id) return;

  try {
    await api(`/destination-checks/${id}`, { method: 'DELETE' });
    if (destinationCheckStatus) destinationCheckStatus.textContent = 'Saved API record deleted from the database.';
    await loadDestinationChecks();
  } catch (error) {
    if (destinationCheckStatus) destinationCheckStatus.textContent = error.message;
  }
});

loadDestinationChecks();
