const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const db = require('./db');
const { teams, byId } = require('./teams');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fc26-super-secret',
  resave: false,
  saveUninitialized: false
}));

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = stored.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

const DEFAULT_FIRST_LOGIN_PASSWORD = 'Fc26Temp!2026';

function ensureDefaultUsers() {
  db.prepare("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''").run();

  const required = ['sergio', 'rol', 'panda', 'dorbecker'];
  const insert = db.prepare("INSERT INTO users (username, password_hash, must_change_password, role) VALUES (?, ?, 1, 'user')");
  for (const username of required) {
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!exists) insert.run(username, hashPassword(DEFAULT_FIRST_LOGIN_PASSWORD));
  }

  const adminUsername = 'admin';
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
  if (!adminExists) {
    db.prepare("INSERT INTO users (username, password_hash, must_change_password, role) VALUES (?, ?, 1, 'admin')")
      .run(adminUsername, hashPassword(DEFAULT_FIRST_LOGIN_PASSWORD));
  } else {
    db.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(adminUsername);
  }
}

ensureDefaultUsers();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'admin') return res.status(403).send('Admin only');
  next();
}

function normalizePlayers(payload) {
  const raw = payload?.players;
  if (!raw) return [];

  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list
    .map((p = {}) => ({
      userId: Number(p.userId),
      teamId: String(p.teamId || '').trim()
    }))
    .filter(p => Number.isInteger(p.userId) && p.userId > 0 && p.teamId);
}

function computeStandings(tournamentId) {
  const players = db.prepare('SELECT * FROM players WHERE tournament_id = ?').all(tournamentId);
  const rows = new Map(players.map(p => [p.id, {
    playerId: p.id,
    playerName: p.name,
    teamId: p.team_id,
    team: byId.get(p.team_id),
    played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0
  }]));

  const matches = db.prepare('SELECT * FROM matches WHERE tournament_id = ? AND home_goals IS NOT NULL AND away_goals IS NOT NULL').all(tournamentId);

  for (const m of matches) {
    const home = rows.get(m.home_player_id);
    const away = rows.get(m.away_player_id);

    home.played += 1; away.played += 1;
    home.goalsFor += m.home_goals; home.goalsAgainst += m.away_goals;
    away.goalsFor += m.away_goals; away.goalsAgainst += m.home_goals;

    if (m.home_goals > m.away_goals) {
      home.wins += 1; away.losses += 1; home.points += 3;
    } else if (m.home_goals < m.away_goals) {
      away.wins += 1; home.losses += 1; away.points += 3;
    } else {
      home.draws += 1; away.draws += 1; home.points += 1; away.points += 1;
    }
  }

  const table = [...rows.values()].map(r => ({ ...r, goalDiff: r.goalsFor - r.goalsAgainst }));
  table.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.playerName.localeCompare(b.playerName));
  return table;
}

function maybeCloseTournament(tournamentId) {
  const pending = db.prepare('SELECT COUNT(*) as c FROM matches WHERE tournament_id = ? AND (home_goals IS NULL OR away_goals IS NULL)').get(tournamentId).c;
  if (pending > 0) return;

  const standings = computeStandings(tournamentId);
  const champion = standings[0];
  db.prepare('UPDATE tournaments SET status = ?, champion_player_id = ? WHERE id = ?').run('completed', champion.playerId, tournamentId);
}

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use((req, res, next) => {
  const user = req.session.user;
  if (!user?.mustChangePassword) return next();

  const allowed = req.path === '/change-password' || req.path === '/logout' || req.path.includes('.');
  if (allowed) return next();
  return res.redirect('/change-password');
});

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render('register', { error: 'Username and password are required.' });
  try {
    const info = db.prepare("INSERT INTO users (username, password_hash, must_change_password, role) VALUES (?, ?, 0, 'user')").run(username.trim(), hashPassword(password));
    req.session.user = { id: info.lastInsertRowid, username: username.trim(), mustChangePassword: false, role: 'user' };
    return res.redirect('/dashboard');
  } catch {
    return res.render('register', { error: 'Username already exists.' });
  }
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username?.trim());
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.render('login', { error: 'Invalid credentials.' });
  }
  req.session.user = { id: user.id, username: user.username, mustChangePassword: !!user.must_change_password, role: user.role || 'user' };
  res.redirect(user.must_change_password ? '/change-password' : '/dashboard');
});

app.get('/change-password', requireAuth, (req, res) => {
  res.render('change-password', { error: null, success: null });
});

app.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

  if (!user || !verifyPassword(currentPassword || '', user.password_hash)) {
    return res.render('change-password', { error: 'Current password is incorrect.', success: null });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.render('change-password', { error: 'New password must be at least 6 characters.', success: null });
  }
  if (newPassword !== confirmPassword) {
    return res.render('change-password', { error: 'New passwords do not match.', success: null });
  }

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(newPassword), user.id);
  req.session.user.mustChangePassword = false;
  return res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  const isAdmin = req.session.user.role === 'admin';
  const tournaments = isAdmin
    ? db.prepare(`
        SELECT t.*, p.name AS champion_name
        FROM tournaments t
        LEFT JOIN players p ON p.id = t.champion_player_id
        ORDER BY t.created_at DESC
      `).all()
    : db.prepare(`
        SELECT DISTINCT t.*, p.name AS champion_name
        FROM tournaments t
        LEFT JOIN players p ON p.id = t.champion_player_id
        LEFT JOIN players me ON me.tournament_id = t.id
        WHERE t.owner_id = ? OR me.user_id = ?
        ORDER BY t.created_at DESC
      `).all(req.session.user.id, req.session.user.id);

  const currentChampion = isAdmin
    ? db.prepare(`
        SELECT t.id AS tournament_id, t.name AS tournament_name, p.name AS champion_name, p.team_id
        FROM tournaments t
        JOIN players p ON p.id = t.champion_player_id
        ORDER BY t.created_at DESC
        LIMIT 1
      `).get()
    : db.prepare(`
        SELECT DISTINCT t.id AS tournament_id, t.name AS tournament_name, p.name AS champion_name, p.team_id
        FROM tournaments t
        JOIN players p ON p.id = t.champion_player_id
        LEFT JOIN players me ON me.tournament_id = t.id
        WHERE t.owner_id = ? OR me.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT 1
      `).get(req.session.user.id, req.session.user.id);

  res.render('dashboard', {
    tournaments,
    currentChampion: currentChampion ? { ...currentChampion, team: byId.get(currentChampion.team_id) } : null
  });
});

app.get('/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, must_change_password, created_at FROM users ORDER BY username').all();
  res.render('admin-users', { users, error: null });
});

app.post('/admin/users/:id/role', requireAdmin, (req, res) => {
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.redirect('/admin/users');
});

app.post('/tournaments/:id/update', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).send('Tournament not found');
  const canEdit = req.session.user.role === 'admin' || t.owner_id === req.session.user.id;
  if (!canEdit) return res.status(403).send('Not allowed');

  const newName = String(req.body.name || '').trim();
  if (!newName) return res.status(400).send('Tournament name is required');
  db.prepare('UPDATE tournaments SET name = ? WHERE id = ?').run(newName, t.id);
  res.redirect(`/tournaments/${t.id}`);
});

app.post('/tournaments/:id/delete', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).send('Tournament not found');
  const canEdit = req.session.user.role === 'admin' || t.owner_id === req.session.user.id;
  if (!canEdit) return res.status(403).send('Not allowed');

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(t.id);
    db.prepare('DELETE FROM players WHERE tournament_id = ?').run(t.id);
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(t.id);
  });
  tx();
  res.redirect('/dashboard');
});

app.get('/tournaments/new', requireAuth, (req, res) => {
  const grouped = teams.reduce((acc, t) => {
    acc[t.league] ||= [];
    acc[t.league].push(t);
    return acc;
  }, {});
  const users = db.prepare('SELECT id, username FROM users ORDER BY username').all();
  res.render('new-tournament', { grouped, users, error: null });
});

app.post('/tournaments', requireAuth, (req, res) => {
  const { name } = req.body;
  const players = normalizePlayers(req.body);

  if (!name?.trim()) return res.status(400).send('Tournament name is required');
  if (players.length < 2 || players.length > 10) return res.status(400).send('Tournament requires 2 to 10 valid players');

  const invalidTeam = players.find(p => !byId.has(p.teamId));
  if (invalidTeam) return res.status(400).send(`Invalid team selected: ${invalidTeam.teamId}`);

  const uniqueUserIds = new Set(players.map(p => p.userId));
  if (uniqueUserIds.size !== players.length) return res.status(400).send('Each player must be a different user.');

  const userRows = db.prepare(`SELECT id, username FROM users WHERE id IN (${players.map(() => '?').join(',')})`).all(...players.map(p => p.userId));
  if (userRows.length !== players.length) return res.status(400).send('One or more selected users do not exist.');
  const userById = new Map(userRows.map(u => [u.id, u]));

  try {
    const tx = db.transaction(() => {
      const tInfo = db.prepare('INSERT INTO tournaments (name, owner_id) VALUES (?, ?)').run(name.trim(), req.session.user.id);
      const tournamentId = tInfo.lastInsertRowid;

      const insertPlayer = db.prepare('INSERT INTO players (tournament_id, user_id, name, team_id) VALUES (?, ?, ?, ?)');
      const playerIds = players.map(p => {
        const info = insertPlayer.run(tournamentId, p.userId, userById.get(p.userId).username, p.teamId);
        return info.lastInsertRowid;
      });

      const insertMatch = db.prepare('INSERT INTO matches (tournament_id, round_no, home_player_id, away_player_id) VALUES (?, ?, ?, ?)');
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          insertMatch.run(tournamentId, 1, playerIds[i], playerIds[j]);
          insertMatch.run(tournamentId, 2, playerIds[j], playerIds[i]);
        }
      }

      return tournamentId;
    });

    const tournamentId = tx();
    return res.redirect(`/tournaments/${tournamentId}`);
  } catch (error) {
    console.error('Failed creating tournament:', error);
    return res.status(500).send('Could not create tournament. Please try again.');
  }
});

app.get('/tournaments/:id', requireAuth, (req, res) => {
  const isAdmin = req.session.user.role === 'admin';
  const t = isAdmin
    ? db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id)
    : db.prepare(`
        SELECT DISTINCT t.*
        FROM tournaments t
        LEFT JOIN players me ON me.tournament_id = t.id
        WHERE t.id = ? AND (t.owner_id = ? OR me.user_id = ?)
      `).get(req.params.id, req.session.user.id, req.session.user.id);
  if (!t) return res.status(404).send('Tournament not found');

  const standings = computeStandings(t.id);
  const matches = db.prepare(`
    SELECT m.*, hp.name AS home_name, hp.team_id AS home_team_id, ap.name AS away_name, ap.team_id AS away_team_id
    FROM matches m
    JOIN players hp ON hp.id = m.home_player_id
    JOIN players ap ON ap.id = m.away_player_id
    WHERE m.tournament_id = ?
    ORDER BY m.round_no, m.id
  `).all(t.id).map(m => ({
    ...m,
    home_team: byId.get(m.home_team_id),
    away_team: byId.get(m.away_team_id)
  }));

  const played = matches.filter(m => m.home_goals !== null && m.away_goals !== null);
  const totalGoals = played.reduce((sum, m) => sum + m.home_goals + m.away_goals, 0);
  const avgGoals = played.length ? (totalGoals / played.length).toFixed(2) : '0.00';

  const topAttack = [...standings].sort((a, b) => b.goalsFor - a.goalsFor)[0] || null;
  const bestDefense = [...standings].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0] || null;

  res.render('tournament', {
    tournament: t,
    standings,
    matches,
    canEdit: req.session.user.role === 'admin' || t.owner_id === req.session.user.id,
    isAdmin: req.session.user.role === 'admin',
    stats: {
      matchesPlayed: played.length,
      totalMatches: matches.length,
      totalGoals,
      avgGoals,
      topAttack,
      bestDefense
    }
  });
});

app.post('/matches/:id/result', requireAuth, (req, res) => {
  const match = db.prepare(`
    SELECT m.*, t.owner_id
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!match) return res.status(404).send('Match not found');
  const canEdit = req.session.user.role === 'admin' || match.owner_id === req.session.user.id;
  if (!canEdit) return res.status(403).send('Not allowed');

  const homeGoals = Number(req.body.home_goals);
  const awayGoals = Number(req.body.away_goals);

  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) {
    return res.status(400).send('Goals must be non-negative integers');
  }

  db.prepare('UPDATE matches SET home_goals = ?, away_goals = ?, played_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(homeGoals, awayGoals, match.id);

  maybeCloseTournament(match.tournament_id);
  res.redirect(`/tournaments/${match.tournament_id}`);
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).send('Unexpected server error.');
});

app.listen(PORT, () => {
  console.log(`FC26 app running on http://localhost:${PORT}`);
});
