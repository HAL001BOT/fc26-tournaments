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

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function normalizePlayers(payload) {
  const raw = payload?.players;
  if (!raw) return [];

  // Handles qs output from inputs named like players[][name] + players[][teamId]
  // which arrives as: [{ name: ['A','B'], teamId: ['x','y'] }]
  if (Array.isArray(raw) && raw.length === 1) {
    const first = raw[0] || {};
    if (Array.isArray(first.name) && Array.isArray(first.teamId)) {
      return first.name
        .map((name, i) => ({
          name: String(name || '').trim(),
          teamId: String(first.teamId[i] || '').trim()
        }))
        .filter(p => p.name && p.teamId);
    }
  }

  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list
    .map((p = {}) => ({
      name: String(p.name || '').trim(),
      teamId: String(p.teamId || '').trim()
    }))
    .filter(p => p.name && p.teamId);
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

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render('register', { error: 'Username and password are required.' });
  try {
    const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username.trim(), hashPassword(password));
    req.session.user = { id: info.lastInsertRowid, username: username.trim() };
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
  req.session.user = { id: user.id, username: user.username };
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  const tournaments = db.prepare(`
    SELECT t.*, p.name AS champion_name
    FROM tournaments t
    LEFT JOIN players p ON p.id = t.champion_player_id
    WHERE t.owner_id = ?
    ORDER BY t.created_at DESC
  `).all(req.session.user.id);

  const currentChampion = db.prepare(`
    SELECT t.id AS tournament_id, t.name AS tournament_name, p.name AS champion_name, p.team_id
    FROM tournaments t
    JOIN players p ON p.id = t.champion_player_id
    WHERE t.owner_id = ?
    ORDER BY t.created_at DESC
    LIMIT 1
  `).get(req.session.user.id);

  res.render('dashboard', {
    tournaments,
    currentChampion: currentChampion ? { ...currentChampion, team: byId.get(currentChampion.team_id) } : null
  });
});

app.get('/tournaments/new', requireAuth, (req, res) => {
  const grouped = teams.reduce((acc, t) => {
    acc[t.league] ||= [];
    acc[t.league].push(t);
    return acc;
  }, {});
  res.render('new-tournament', { grouped, error: null });
});

app.post('/tournaments', requireAuth, (req, res) => {
  const { name } = req.body;
  const players = normalizePlayers(req.body);

  if (!name?.trim()) return res.status(400).send('Tournament name is required');
  if (players.length < 2 || players.length > 10) return res.status(400).send('Tournament requires 2 to 10 valid players');

  const invalidTeam = players.find(p => !byId.has(p.teamId));
  if (invalidTeam) return res.status(400).send(`Invalid team selected: ${invalidTeam.teamId}`);

  try {
    const tx = db.transaction(() => {
      const tInfo = db.prepare('INSERT INTO tournaments (name, owner_id) VALUES (?, ?)').run(name.trim(), req.session.user.id);
      const tournamentId = tInfo.lastInsertRowid;

      const insertPlayer = db.prepare('INSERT INTO players (tournament_id, name, team_id) VALUES (?, ?, ?)');
      const playerIds = players.map(p => {
        const info = insertPlayer.run(tournamentId, p.name, p.teamId);
        return info.lastInsertRowid;
      });

      const insertMatch = db.prepare('INSERT INTO matches (tournament_id, round_no, home_player_id, away_player_id) VALUES (?, ?, ?, ?)');
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          // round 1
          insertMatch.run(tournamentId, 1, playerIds[i], playerIds[j]);
          // round 2 (reverse home/away)
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
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ? AND owner_id = ?').get(req.params.id, req.session.user.id);
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

  if (!match || match.owner_id !== req.session.user.id) return res.status(404).send('Match not found');

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
