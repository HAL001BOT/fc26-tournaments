const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
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
  name TEXT NOT NULL,
  team_id TEXT NOT NULL,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id)
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

module.exports = db;
