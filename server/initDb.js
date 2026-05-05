const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { run, get } = require('./db');

async function init() {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    country TEXT DEFAULT 'Spain',
    semester TEXT DEFAULT 'Fall 2026',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','completed')) DEFAULT 'pending',
    category TEXT DEFAULT 'General',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  const demo = await get('SELECT id FROM users WHERE email = ?', ['yaroslava.halushko@vdu.lt']);
  if (!demo) {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await run(
      `INSERT INTO users (name, email, password_hash, country, semester, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Yaroslava Halushko', 'yaroslava.halushko@vdu.lt', passwordHash, 'Spain', 'Fall 2026', 'Need host university course approval and accommodation search.']
    );

    await run(`INSERT INTO tasks (user_id, title, deadline, status, category) VALUES (?, ?, ?, ?, ?)`, [user.id, 'Submit Erasmus application', '2026-05-01', 'pending', 'Application']);
    await run(`INSERT INTO tasks (user_id, title, deadline, status, category) VALUES (?, ?, ?, ?, ?)`, [user.id, 'Complete Learning Agreement', '2026-05-05', 'pending', 'Documents']);
    await run(`INSERT INTO tasks (user_id, title, deadline, status, category) VALUES (?, ?, ?, ?, ?)`, [user.id, 'Upload passport copy', '2026-04-15', 'completed', 'Documents']);
    await run(`INSERT INTO documents (user_id, title, file_name, description) VALUES (?, ?, ?, ?)`, [user.id, 'Learning Agreement', 'learning-agreement.pdf', 'Signed by home university']);
    await run(`INSERT INTO documents (user_id, title, file_name, description) VALUES (?, ?, ?, ?)`, [user.id, 'Insurance confirmation', 'insurance-confirmation.pdf', 'Valid for exchange semester']);
  }

  console.log('Database initialized successfully. Demo login: yaroslava.halushko@vdu.lt / password123');
}

init().catch((error) => {
  console.error(error);
  process.exit(1);
});
