const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  champion_player_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  user_id INTEGER,
  name TEXT NOT NULL,
  team_id TEXT NOT NULL,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  round_no INTEGER NOT NULL,
  home_player_id INTEGER NOT NULL,
  away_player_id INTEGER NOT NULL,
  home_goals INTEGER,
  away_goals INTEGER,
  played_at TEXT,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY(home_player_id) REFERENCES players(id),
  FOREIGN KEY(away_player_id) REFERENCES players(id)
);
`);

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn('users', 'must_change_password', 'must_change_password INTEGER NOT NULL DEFAULT 0');
ensureColumn('players', 'user_id', 'user_id INTEGER');

module.exports = db;
