# LD4 Defense Text — Erasmus Semester Planner Backend

For LD4 I continued the Erasmus Semester Planner project by adding a real server-side part to the frontend developed in LD3. The purpose of the system is to help Erasmus students manage their preparation process, including tasks, documents, profile information and deadlines.

The backend is implemented with Node.js and Express. The project uses an SQLite database, which is suitable for this academic MVP because it is easy to configure, portable and stores real data in a database file. The backend exposes API routes that are used by the existing HTML, CSS and JavaScript interface.

The database contains several related tables. The `users` table stores registered users, profile information and hashed passwords. The `tasks` table stores each task with fields such as title, deadline, status, category and owner user ID. The `documents` table stores document records connected to a user. This satisfies the requirement for a database structure with several fields and related entities.

The project implements user registration and login. Passwords are not stored as plain text; they are hashed before saving to the database. After successful login, the server returns a JWT token. This token is used by the frontend when sending requests to protected API routes. Unauthenticated users can only access the login and registration page. Authenticated users can access the planner, profile and guide pages.

The main CRUD functionality is implemented for Erasmus tasks. A logged-in user can create a task, view existing tasks, edit a selected task and delete a task. The user can also mark tasks as completed or pending. The backend checks the authenticated user ID before updating or deleting a record, so a user can only modify tasks that belong to their own account.

A search feature is also implemented. In the planner, the user can search tasks by title, category or deadline, and can filter tasks by status. If no records are found, the interface displays a clear message instead of showing an empty result without explanation.

The profile page is also connected to the backend. A user can update personal Erasmus information such as name, email, destination country, semester and notes. Document records can also be added and deleted, which demonstrates additional data management.

For migration, the project documentation explains which files must be transferred to another server: application code, frontend files, configuration files and the SQLite database file. The plan also describes deployment steps, including installing Node.js, running npm install, creating the environment configuration, preparing the database and starting the server. After migration, I would test registration, login, task CRUD, search, profile update, logout, permissions and responsive layout to confirm that the new environment works the same way as the original one.

In conclusion, LD4 transforms the static LD3 interface into a working full-stack MVP. The system now has a database, authentication, protected user-specific data, CRUD operations, search and a clear deployment and migration plan.
