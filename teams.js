const teams = [
  // Premier League
  { id: 'arsenal', name: 'Arsenal', league: 'Premier League', logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg' },
  { id: 'chelsea', name: 'Chelsea', league: 'Premier League', logo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg' },
  { id: 'liverpool', name: 'Liverpool', league: 'Premier League', logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg' },
  { id: 'mancity', name: 'Manchester City', league: 'Premier League', logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg' },
  { id: 'manutd', name: 'Manchester United', league: 'Premier League', logo: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg' },
  { id: 'tottenham', name: 'Tottenham', league: 'Premier League', logo: 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg' },

  // La Liga
  { id: 'realmadrid', name: 'Real Madrid', league: 'La Liga', logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg' },
  { id: 'barcelona', name: 'Barcelona', league: 'La Liga', logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg' },
  { id: 'atletico', name: 'Atletico Madrid', league: 'La Liga', logo: 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg' },
  { id: 'sevilla', name: 'Sevilla', league: 'La Liga', logo: 'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg' },

  // Serie A
  { id: 'juventus', name: 'Juventus', league: 'Serie A', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg' },
  { id: 'milan', name: 'AC Milan', league: 'Serie A', logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg' },
  { id: 'inter', name: 'Inter', league: 'Serie A', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg' },
  { id: 'napoli', name: 'Napoli', league: 'Serie A', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2d/SSC_Napoli.svg' },

  // Bundesliga
  { id: 'bayern', name: 'Bayern Munich', league: 'Bundesliga', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg' },
  { id: 'dortmund', name: 'Borussia Dortmund', league: 'Bundesliga', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg' },
  { id: 'leverkusen', name: 'Bayer Leverkusen', league: 'Bundesliga', logo: 'https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg' },
  { id: 'leipzig', name: 'RB Leipzig', league: 'Bundesliga', logo: 'https://upload.wikimedia.org/wikipedia/en/0/04/RB_Leipzig_2014_logo.svg' },

  // Ligue 1
  { id: 'psg', name: 'PSG', league: 'Ligue 1', logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg' },
  { id: 'marseille', name: 'Marseille', league: 'Ligue 1', logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Olympique_Marseille_logo.svg' },
  { id: 'lyon', name: 'Lyon', league: 'Ligue 1', logo: 'https://upload.wikimedia.org/wikipedia/en/c/c6/Olympique_Lyonnais.svg' },

  // Portugal
  { id: 'benfica', name: 'Benfica', league: 'Primeira Liga', logo: 'https://upload.wikimedia.org/wikipedia/en/a/a2/SL_Benfica_logo.svg' },
  { id: 'porto', name: 'Porto', league: 'Primeira Liga', logo: 'https://upload.wikimedia.org/wikipedia/en/f/f1/FC_Porto.svg' },
  { id: 'sporting', name: 'Sporting CP', league: 'Primeira Liga', logo: 'https://upload.wikimedia.org/wikipedia/en/3/3e/Sporting_Clube_de_Portugal.svg' },

  // Netherlands
  { id: 'ajax', name: 'Ajax', league: 'Eredivisie', logo: 'https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg' },
  { id: 'psv', name: 'PSV', league: 'Eredivisie', logo: 'https://upload.wikimedia.org/wikipedia/en/e/e3/PSV_Eindhoven.svg' },

  // Brazil
  { id: 'flamengo', name: 'Flamengo', league: 'Brasileirao', logo: 'https://upload.wikimedia.org/wikipedia/en/9/93/Clube_de_Regatas_do_Flamengo_logo.svg' },
  { id: 'palmeiras', name: 'Palmeiras', league: 'Brasileirao', logo: 'https://upload.wikimedia.org/wikipedia/en/1/10/Palmeiras_logo.svg' },

  // Argentina
  { id: 'bocajuniors', name: 'Boca Juniors', league: 'Liga Profesional', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Boca_Juniors_logo18.svg' },
  { id: 'riverplate', name: 'River Plate', league: 'Liga Profesional', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Escudo_del_C_A_River_Plate.svg' },

  // MLS
  { id: 'intermiami', name: 'Inter Miami', league: 'MLS', logo: 'https://upload.wikimedia.org/wikipedia/en/7/78/Inter_Miami_CF_logo.svg' },
  { id: 'lafc', name: 'LAFC', league: 'MLS', logo: 'https://upload.wikimedia.org/wikipedia/en/a/a6/Los_Angeles_FC_logo.svg' }
];

const byId = new Map(teams.map(t => [t.id, t]));

module.exports = { teams, byId };
