const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { run, get, all } = require('./db');
require('./initDb');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_change_me';


const ERASMUS_OFFICIAL_URL = 'https://erasmus-plus.ec.europa.eu/';

async function fetchExternalText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'ErasmusSemesterPlannerMidterm/1.0'
    }
  });
  if (!response.ok) throw new Error(`External request failed with status ${response.status}`);
  return response.text();
}

async function fetchExternalJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ErasmusSemesterPlannerMidterm/1.0'
    }
  });
  if (!response.ok) throw new Error(`External request failed with status ${response.status}`);
  return response.json();
}

function cleanText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[ch]));
}

function weatherDescription(code) {
  const labels = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Slight rain showers',
    81: 'Moderate rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm'
  };
  return labels[code] || 'Weather data available';
}

async function getCountryInfo(country) {
  const requestedCountry = String(country || '').trim();
  if (!requestedCountry) throw new Error('Country name is required.');

  const encodedCountry = encodeURIComponent(requestedCountry);
  let countryData;

  try {
    countryData = await fetchExternalJson(`https://restcountries.com/v3.1/name/${encodedCountry}?fullText=true`);
  } catch {
    countryData = await fetchExternalJson(`https://restcountries.com/v3.1/name/${encodedCountry}`);
  }

  if (!Array.isArray(countryData) || !countryData.length) {
    throw new Error('Country was not found in the external API.');
  }

  const countryRow = countryData[0];
  const currencies = countryRow.currencies
    ? Object.values(countryRow.currencies).map((currency) => currency.name || currency.code).filter(Boolean)
    : [];
  const languages = countryRow.languages ? Object.values(countryRow.languages) : [];

  return {
    requestedCountry,
    commonName: countryRow.name?.common || requestedCountry,
    officialName: countryRow.name?.official || countryRow.name?.common || requestedCountry,
    capital: Array.isArray(countryRow.capital) ? countryRow.capital.join(', ') : 'Not listed',
    region: [countryRow.region, countryRow.subregion].filter(Boolean).join(' / ') || 'Not listed',
    currency: currencies.join(', ') || 'Not listed',
    languages: languages.join(', ') || 'Not listed',
    population: countryRow.population || null,
    flag: countryRow.flags?.svg || countryRow.flags?.png || '',
    mapUrl: countryRow.maps?.googleMaps || '',
    sourceUrl: `https://restcountries.com/v3.1/name/${encodedCountry}`
  };
}

app.use(cors());
app.use(express.json());

// Serve frontend files from /public when the project is deployed with a public folder.
// If files are in the project root during local testing, fall back to the root folder.
const publicPath = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname;
app.use(express.static(publicPath));

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
}

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await get(
      'SELECT id, name, email, country, semester, notes FROM users WHERE id = ?',
      [payload.id]
    );

    if (!user) return res.status(401).json({ error: 'User not found.' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, country, semester, notes } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const existing = await get('SELECT id FROM users WHERE email = ?', [email]);

    if (existing) {
      return res.status(409).json({ error: 'This email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await run(
      `INSERT INTO users (name, email, password_hash, country, semester, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        passwordHash,
        country || 'Spain',
        semester || 'Fall 2026',
        notes || 'Profile created. Add your semester notes on the profile page.'
      ]
    );

    const user = await get(
      'SELECT id, name, email, country, semester, notes FROM users WHERE id = ?',
      [result.id]
    );

    res.status(201).json({ token: createToken(user), user });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const row = await get('SELECT * FROM users WHERE email = ?', [email]);

  if (!row) return res.status(401).json({ error: 'Incorrect email or password.' });

  const ok = await bcrypt.compare(password, row.password_hash);

  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });

  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    country: row.country,
    semester: row.semester,
    notes: row.notes
  };

  res.json({ token: createToken(user), user });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/me', auth, async (req, res) => {
  const { name, email, country, semester, notes } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  try {
    await run(
      `UPDATE users
       SET name = ?, email = ?, country = ?, semester = ?, notes = ?
       WHERE id = ?`,
      [name, email, country || '', semester || '', notes || '', req.user.id]
    );

    const user = await get(
      'SELECT id, name, email, country, semester, notes FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ user });
  } catch (error) {
    res.status(409).json({ error: 'Could not update profile. Email may already be used.' });
  }
});

app.get('/api/tasks', auth, async (req, res) => {
  const { q = '', status = 'all' } = req.query;
  const params = [req.user.id];

  let sql = `
    SELECT id, title, deadline, status, category, created_at, updated_at
    FROM tasks
    WHERE user_id = ?
  `;

  if (status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (q.trim()) {
    sql += ' AND (title LIKE ? OR category LIKE ? OR deadline LIKE ?)';
    params.push(`%${q.trim()}%`, `%${q.trim()}%`, `%${q.trim()}%`);
  }

  sql += ' ORDER BY deadline ASC, id DESC';

  const tasks = await all(sql, params);

  res.json({
    tasks,
    message: tasks.length ? undefined : 'No tasks were found.'
  });
});

app.post('/api/tasks', auth, async (req, res) => {
  const { title, deadline, status = 'pending', category = 'General' } = req.body;

  if (!title || !deadline) {
    return res.status(400).json({ error: 'Task title and deadline are required.' });
  }

  if (!['pending', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid task status.' });
  }

  const result = await run(
    `INSERT INTO tasks (user_id, title, deadline, status, category)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, title, deadline, status, category]
  );

  const task = await get(
    `SELECT id, title, deadline, status, category, created_at, updated_at
     FROM tasks
     WHERE id = ? AND user_id = ?`,
    [result.id, req.user.id]
  );

  res.status(201).json({ task });
});

app.put('/api/tasks/:id', auth, async (req, res) => {
  const { title, deadline, status, category = 'General' } = req.body;

  if (!title || !deadline || !status) {
    return res.status(400).json({ error: 'Title, deadline and status are required.' });
  }

  if (!['pending', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid task status.' });
  }

  const result = await run(
    `UPDATE tasks
     SET title = ?, deadline = ?, status = ?, category = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [title, deadline, status, category, req.params.id, req.user.id]
  );

  if (!result.changes) {
    return res.status(404).json({ error: 'Task not found or you do not have permission.' });
  }

  const task = await get(
    `SELECT id, title, deadline, status, category, created_at, updated_at
     FROM tasks
     WHERE id = ? AND user_id = ?`,
    [req.params.id, req.user.id]
  );

  res.json({ task });
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  const result = await run(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!result.changes) {
    return res.status(404).json({ error: 'Task not found or you do not have permission.' });
  }

  res.json({ success: true });
});

app.get('/api/documents', auth, async (req, res) => {
  const documents = await all(
    'SELECT id, title, file_name, description, created_at FROM documents WHERE user_id = ? ORDER BY id DESC',
    [req.user.id]
  );

  res.json({ documents });
});

app.post('/api/documents', auth, async (req, res) => {
  const { title, fileName, description = '' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Document title is required.' });
  }

  const result = await run(
    'INSERT INTO documents (user_id, title, file_name, description) VALUES (?, ?, ?, ?)',
    [req.user.id, title, fileName || `${title}.pdf`, description]
  );

  const document = await get(
    'SELECT id, title, file_name, description, created_at FROM documents WHERE id = ? AND user_id = ?',
    [result.id, req.user.id]
  );

  res.status(201).json({ document });
});

app.delete('/api/documents/:id', auth, async (req, res) => {
  const result = await run(
    'DELETE FROM documents WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!result.changes) {
    return res.status(404).json({ error: 'Document not found or you do not have permission.' });
  }

  res.json({ success: true });
});


// MIDTERM API 1: Static HTML API from a third-party server.
// This route does not use user input. It loads fixed public HTML content from the official Erasmus+ website
// and returns a safe card that the integrated dashboard can render.
app.get('/api/external/erasmus-static', auth, async (req, res) => {
  try {
    const html = await fetchExternalText(ERASMUS_OFFICIAL_URL);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

    const title = cleanText(h1Match?.[1] || titleMatch?.[1] || 'Erasmus+ official information');
    const description = cleanText(descriptionMatch?.[1] || 'Official Erasmus+ information loaded from a third-party server.');

    res.json({
      source: 'European Commission Erasmus+ website',
      sourceUrl: ERASMUS_OFFICIAL_URL,
      html: `
        <div class="external-result-card">
          <span class="api-pill">Static HTML API</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(description)}</p>
          <a href="${ERASMUS_OFFICIAL_URL}" target="_blank" rel="noopener">Open official Erasmus+ source</a>
        </div>
      `
    });
  } catch (error) {
    res.status(502).json({ error: 'Could not load the official Erasmus+ HTML page right now.' });
  }
});

// MIDTERM API 2: Dynamic HTML + JavaScript API.
// The frontend sends a city typed by the user; the server calls Open-Meteo geocoding and forecast services.
app.get('/api/external/weather', auth, async (req, res) => {
  const city = String(req.query.city || '').trim();
  if (!city) return res.status(400).json({ error: 'City is required.' });

  try {
    const encodedCity = encodeURIComponent(city);
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodedCity}&count=1&language=en&format=json`;
    const locationData = await fetchExternalJson(geocodingUrl);
    const location = locationData.results?.[0];

    if (!location) {
      return res.status(404).json({ error: 'City was not found by the external geocoding API.' });
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
    const forecast = await fetchExternalJson(forecastUrl);
    const current = forecast.current || {};

    res.json({
      city: location.name,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
      source: 'Open-Meteo Geocoding API and Forecast API',
      current: {
        temperature: current.temperature_2m,
        windSpeed: current.wind_speed_10m,
        code: current.weather_code,
        description: weatherDescription(current.weather_code)
      },
      daily: (forecast.daily?.time || []).map((date, index) => ({
        date,
        max: forecast.daily.temperature_2m_max?.[index],
        min: forecast.daily.temperature_2m_min?.[index]
      }))
    });
  } catch (error) {
    res.status(502).json({ error: 'Could not load weather data from the third-party API.' });
  }
});

// MIDTERM API 3: Third-party API connected to the database.
// The user submits a country name. The server retrieves country data from REST Countries and saves it in SQLite.
app.get('/api/destination-checks', auth, async (req, res) => {
  const checks = await all(
    `SELECT id, requested_country, common_name, official_name, capital, region, currency, languages,
            population, flag, map_url, source_url, created_at
     FROM destination_checks
     WHERE user_id = ?
     ORDER BY id DESC`,
    [req.user.id]
  );

  res.json({ checks });
});

app.post('/api/destination-checks', auth, async (req, res) => {
  try {
    const country = await getCountryInfo(req.body.country);

    const result = await run(
      `INSERT INTO destination_checks
       (user_id, requested_country, common_name, official_name, capital, region, currency, languages,
        population, flag, map_url, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        country.requestedCountry,
        country.commonName,
        country.officialName,
        country.capital,
        country.region,
        country.currency,
        country.languages,
        country.population,
        country.flag,
        country.mapUrl,
        country.sourceUrl
      ]
    );

    const check = await get(
      `SELECT id, requested_country, common_name, official_name, capital, region, currency, languages,
              population, flag, map_url, source_url, created_at
       FROM destination_checks
       WHERE id = ? AND user_id = ?`,
      [result.id, req.user.id]
    );

    res.status(201).json({ check });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Could not save country data from the third-party API.' });
  }
});

app.delete('/api/destination-checks/:id', auth, async (req, res) => {
  const result = await run(
    'DELETE FROM destination_checks WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!result.changes) {
    return res.status(404).json({ error: 'Saved API result not found or you do not have permission.' });
  }

  res.json({ success: true });
});

// Correct fallback path for frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Erasmus Planner backend running on http://localhost:${PORT}`);
});