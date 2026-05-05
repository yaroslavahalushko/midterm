const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { run, get, all } = require('./server/db');
require('./server/initDb');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_change_me';

app.use(cors());
app.use(express.json());

// Correct public path for local + Render
app.use(express.static(path.join(__dirname, 'public')));

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

// Correct fallback path for frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Erasmus Planner backend running on http://localhost:${PORT}`);
});
// ===== API 3: Exchange Rates — DB-connected =====
// Migration: add this table by running: npm run init-db (updated initDb handles it)

(async () => {
  try {
    const { run: dbRun } = require('./server/db');
    await dbRun(`CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      rate REAL NOT NULL,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  } catch (e) { console.error('exchange_rates table init error:', e.message); }
})();

app.get('/api/exchange-rates', auth, async (req, res) => {
  const rates = await all(
    'SELECT id, currency, rate, fetched_at FROM exchange_rates WHERE user_id = ? ORDER BY id DESC LIMIT 20',
    [req.user.id]
  );
  res.json({ rates });
});

// POST /api/exchange-rates — server fetches rate from frankfurter.app,
// saves it to DB, and returns the result. Browser never calls external API directly.
app.post('/api/exchange-rates', auth, async (req, res) => {
  const { currency } = req.body;
  if (!currency) return res.status(400).json({ error: 'Currency is required.' });

  try {
    // Node 18+ has built-in fetch; for older Node use the https module
    let rate;
    if (typeof fetch !== 'undefined') {
      const ext = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(currency)}`);
      if (!ext.ok) throw new Error('External rate service error');
      const data = await ext.json();
      rate = data.rates?.[currency];
    } else {
      // Fallback: https module for Node < 18
      rate = await new Promise((resolve, reject) => {
        const https = require('https');
        https.get(`https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(currency)}`, (r) => {
          let body = '';
          r.on('data', chunk => body += chunk);
          r.on('end', () => {
            try { resolve(JSON.parse(body).rates?.[currency]); }
            catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
    }

    if (!rate) throw new Error(`Rate for ${currency} not returned`);

    const result = await run(
      'INSERT INTO exchange_rates (user_id, currency, rate) VALUES (?, ?, ?)',
      [req.user.id, currency, rate]
    );
    const saved = await get(
      'SELECT id, currency, rate, fetched_at FROM exchange_rates WHERE id = ?',
      [result.id]
    );
    res.status(201).json({ rate: saved });
  } catch (err) {
    res.status(502).json({ error: `Could not fetch rate: ${err.message}` });
  }
});
