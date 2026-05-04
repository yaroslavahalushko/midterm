# Erasmus Semester Planner — LD4 Backend Version

This version continues the LD3 graphical interface and adds the LD4 server-side functionality.

## Technology stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express
- Database: SQLite
- Authentication: JWT tokens with password hashing using bcryptjs

## Implemented LD4 requirements

### Database integration

The project uses a connected SQLite database stored in `server/data/erasmus_planner.sqlite`.

Tables:

1. `users`
   - `id`
   - `name`
   - `email`
   - `password_hash`
   - `country`
   - `semester`
   - `notes`
   - `created_at`

2. `tasks`
   - `id`
   - `user_id`
   - `title`
   - `deadline`
   - `status`
   - `category`
   - `created_at`
   - `updated_at`

3. `documents`
   - `id`
   - `user_id`
   - `title`
   - `file_name`
   - `description`
   - `created_at`

The `tasks` and `documents` tables are related to `users` through `user_id`.

### CRUD operations

The main CRUD entity is `tasks`.

Authenticated users can:

- Create new tasks
- View their own tasks
- Update/edit their own tasks
- Delete their own tasks
- Search tasks by title, deadline, or category
- Filter tasks by status

A user cannot edit or delete tasks created by another user because all update and delete queries include both the task ID and authenticated `user_id`.

Documents also support create, view, and delete operations.

### Authentication

The system includes:

- User registration
- User login
- JWT-based protected pages and API routes
- Hashed passwords
- Logout

Unauthenticated users can only access the login/register page. Authenticated users can access the home page, planner, profile, and guide pages.

## How to run locally

1. Install Node.js.
2. Open the project folder in a terminal.
3. Install dependencies:

```bash
npm install
```

4. Create the database and demo data:

```bash
npm run init-db
```

5. Start the server:

```bash
npm start
```

6. Open:

```text
http://localhost:3000
```

Demo account:

```text
Email: yaroslava.halushko@vdu.lt
Password: password123
```

## Main API routes

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`

### Profile

- `GET /api/me`
- `PUT /api/me`

### Tasks

- `GET /api/tasks`
- `GET /api/tasks?q=agreement&status=pending`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Documents

- `GET /api/documents`
- `POST /api/documents`
- `DELETE /api/documents/:id`

## Migration and deployment plan

### Files and data to transfer

To migrate the project to another server, transfer:

1. Application code
   - `server/`
   - `public/`
   - `package.json`
   - `package-lock.json`, if generated
   - `.env` or `.env.example`

2. Database
   - `server/data/erasmus_planner.sqlite`

3. Static assets
   - SVG images
   - MP4 demo videos
   - HTML, CSS, JavaScript files

### New server setup steps

1. Install Node.js on the new server.
2. Upload or clone the project folder.
3. Run:

```bash
npm install
```

4. Create a production `.env` file:

```env
PORT=3000
JWT_SECRET=your_secure_secret_here
DB_FILE=./server/data/erasmus_planner.sqlite
```

5. Copy the database file into `server/data/`, or run:

```bash
npm run init-db
```

6. Start the application:

```bash
npm start
```

7. Configure the domain or reverse proxy if the server uses Apache, Nginx, Render, Railway, or another hosting platform.

### Tests after migration

After deployment, test the following:

1. Open the website homepage.
2. Register a new user.
3. Login with the new user.
4. Open the planner dashboard.
5. Create a new task.
6. Search for the task.
7. Edit the task.
8. Mark the task completed.
9. Delete the task.
10. Add and delete a document record.
11. Update the profile page.
12. Logout and verify protected pages cannot be accessed without login.
13. Login with another account and verify it cannot edit or delete the first user’s tasks.
14. Test responsiveness on desktop and mobile widths.

## Notes

The previous GitHub Pages link is static hosting only. A backend version requires a server that can run Node.js, such as Render, Railway, Vercel serverless functions with adaptation, VPS hosting, or university hosting that supports Node.js.

## Midterm third-party API integrations

This version also includes the three required midterm API functionalities integrated directly into the existing planner dashboard (`dashboard.html`). No separate API demonstration page is used.

### 1. Static HTML API — 2 points

- Frontend area: **Planner → Midterm third-party API workspace → Static HTML API**
- Backend route: `GET /api/external/erasmus-static`
- Third-party source: official Erasmus+ website HTML at `https://erasmus-plus.ec.europa.eu/`
- User input: none
- Purpose: loads fixed public Erasmus+ content and renders it as an information card in the existing dashboard.

### 2. Dynamic HTML + JavaScript API — 3 points

- Frontend area: **Planner → Dynamic weather API**
- Frontend code: `script.js` uses `fetch()` directly with the Open-Meteo Geocoding API and Forecast API
- Optional backend helper route: `GET /api/external/weather?city=Madrid`
- Third-party sources: Open-Meteo Geocoding API and Forecast API
- User input: destination city
- Purpose: JavaScript sends the typed city to the third-party service, retrieves live weather data, and dynamically displays temperature, wind and a short forecast.

### 3. Third-party API connected to database — 5 points

- Frontend area: **Planner → Save country API data** and **Saved destination API records**
- Backend routes:
  - `GET /api/destination-checks`
  - `POST /api/destination-checks`
  - `DELETE /api/destination-checks/:id`
- Third-party source: REST Countries API
- User input: destination country
- Database table: `destination_checks`
- Purpose: user submits a country, the backend retrieves official country information from a third-party API, saves it to SQLite, and then displays saved records from the database.
