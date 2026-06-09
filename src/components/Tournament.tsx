'use client';

import { useRef, useState } from 'react';
import { Trophy, BellRing, Share2, Activity, X, Crown, FileText, Play } from 'lucide-react';
import { useTeamStore, MentalityType } from '@/store/useTeamStore';
import { toPng } from 'html-to-image';
import Pitch from './Pitch';
import { getCaptainRole } from '@/lib/captain';
import { saveTeamSnapshot } from '@/lib/localStats';
import type { CaptainRole } from '@/lib/captain';
import type { Player } from '@/types';

interface Team {
  id: string;
  name: string;
  rating: number;
  isUser?: boolean;
  mentality?: MentalityType | null;
  scorers: string[];
  attack: number;
  control: number;
  defense: number;
  goalkeeper: number;
  tempo: number;
  risk: number;
  discipline: number;
}

interface Match {
  id: string;
  matchday: number;
  team1: Team;
  team2: Team;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  finalStats?: LiveStats;
}

interface LiveStats {
  possession: number;
  shots1: number;
  onTarget1: number;
  shots2: number;
  onTarget2: number;
  xg1: number;
  xg2: number;
  corners1: number;
  corners2: number;
  yellow1: number;
  yellow2: number;
  red1: number;
  red2: number;
  momentum: number;
}

interface MatchEvent {
  minute: number;
  team: 1 | 2;
  type: 'goal' | 'shot' | 'save' | 'corner' | 'card' | 'momentum' | 'info';
  text: string;
  score?: string;
  scorer?: string;
  xg?: number;
  card?: 'yellow' | 'red';
}

interface FullMatchResult {
  s1: number;
  s2: number;
  winnerId: string | null;
  events: MatchEvent[];
  finalStats: LiveStats;
}

interface MatchReport {
  id: string;
  result: 'Galibiyet' | 'Beraberlik' | 'Maglubiyet';
  opponent: string;
  score: string;
  points: number;
  motm: string;
  captainImpact: string;
  notes: string[];
}

interface SeriesRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('G' | 'B' | 'M')[];
}

type SimSpeed = 'normal' | 'fast' | 'hyper';

const SERIES_LENGTH = 5;
const TROPHY_TARGET_POINTS = 10;

const SIM_SPEED_CONFIG: Record<SimSpeed, { minuteDelay: number; goalPause: number; postMatchPause: number }> = {
  normal: { minuteDelay: 95, goalPause: 620, postMatchPause: 520 },
  fast: { minuteDelay: 24, goalPause: 180, postMatchPause: 220 },
  hyper: { minuteDelay: 2, goalPause: 24, postMatchPause: 80 },
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rounded = (value: number) => Math.round(value * 100) / 100;

const emptyLiveStats = (): LiveStats => ({
  possession: 50,
  shots1: 0,
  onTarget1: 0,
  shots2: 0,
  onTarget2: 0,
  xg1: 0,
  xg2: 0,
  corners1: 0,
  corners2: 0,
  yellow1: 0,
  yellow2: 0,
  red1: 0,
  red2: 0,
  momentum: 50,
});

const getAverageRating = (players: Player[], fallback: number) => {
  if (players.length === 0) return fallback;
  return players.reduce((total, player) => total + player.overall_rating, 0) / players.length;
};

const getUserGroups = (players: (Player | null)[]) => {
  const validPlayers = players.filter((player): player is Player => player !== null);

  return {
    validPlayers,
    keepers: validPlayers.filter((player) => player.position === 'KL'),
    defenders: validPlayers.filter((player) => {
      const position = String(player.position);
      return position === 'STP' || position === 'SLB' || position.endsWith('B');
    }),
    midfielders: validPlayers.filter((player) => player.position === 'MO'),
    attackers: validPlayers.filter((player) => {
      const position = String(player.position);
      return position === 'SF' || position === 'SLK' || (position.endsWith('K') && position !== 'KL');
    }),
  };
};

const mentalityBoosts = (mentality: MentalityType | null | undefined) => {
  if (mentality === 'Gegenpress') {
    return { attack: 5, control: 2, defense: -2, tempo: 12, risk: 12, discipline: -6 };
  }

  if (mentality === 'ParkTheBus') {
    return { attack: -3, control: -4, defense: 6, tempo: -8, risk: -9, discipline: 5 };
  }

  return { attack: 1, control: 2, defense: 1, tempo: 0, risk: 0, discipline: 1 };
};

const buildTeam = (input: {
  id: string;
  name: string;
  rating: number;
  mentality: MentalityType | null;
  scorers: string[];
  isUser?: boolean;
  players?: (Player | null)[];
}): Team => {
  const boosts = mentalityBoosts(input.mentality);
  let attackBase = input.rating;
  let controlBase = input.rating;
  let defenseBase = input.rating;
  let goalkeeperBase = input.rating;

  if (input.players) {
    const groups = getUserGroups(input.players);
    attackBase = getAverageRating(groups.attackers, input.rating);
    controlBase = getAverageRating(groups.midfielders, input.rating);
    defenseBase = getAverageRating(groups.defenders, input.rating);
    goalkeeperBase = getAverageRating(groups.keepers, input.rating);
  }

  return {
    id: input.id,
    name: input.name,
    rating: input.rating,
    isUser: input.isUser,
    mentality: input.mentality,
    scorers: input.scorers.length > 0 ? input.scorers : [input.name],
    attack: Math.round(clamp(attackBase + boosts.attack, 55, 99)),
    control: Math.round(clamp(controlBase + boosts.control, 55, 99)),
    defense: Math.round(clamp(defenseBase + boosts.defense, 55, 99)),
    goalkeeper: Math.round(clamp(goalkeeperBase, 55, 99)),
    tempo: Math.round(clamp(70 + boosts.tempo + input.rating * 0.12, 45, 96)),
    risk: Math.round(clamp(45 + boosts.risk + (input.rating - 80) * 0.8, 18, 85)),
    discipline: Math.round(clamp(72 + boosts.discipline - boosts.risk * 0.25, 38, 94)),
  };
};

const pickScorer = (team: Team) => team.scorers[Math.floor(Math.random() * team.scorers.length)] ?? team.name;

const buildSeriesMatches = (
  userRating: number,
  userMentality: MentalityType | null,
  userPlayers: (Player | null)[],
  userTeamName: string
): Match[] => {
  const userScorers = userPlayers
    .filter((player): player is Player => player !== null && player.position !== 'KL')
    .sort((a, b) => b.overall_rating - a.overall_rating)
    .slice(0, 7)
    .map((player) => player.name);

  const userTeam = buildTeam({
    id: 'user',
    name: userTeamName || 'Efsane 11',
    rating: userRating,
    isUser: true,
    mentality: userMentality,
    scorers: userScorers,
    players: userPlayers,
  });

  const opponents = [
    buildTeam({ id: 'bot1', name: 'Bursaspor 2010', rating: 80, mentality: 'ParkTheBus', scorers: ['Sercan', 'Batalla', 'Ozan'] }),
    buildTeam({ id: 'bot2', name: 'Trabzonspor 2011', rating: 81, mentality: 'ParkTheBus', scorers: ['Burak', 'Selcuk', 'Colman'] }),
    buildTeam({ id: 'bot3', name: 'Fenerbahce 2008', rating: 82, mentality: 'Gegenpress', scorers: ['Alex', 'Semih', 'Deivid'] }),
    buildTeam({ id: 'bot4', name: 'Besiktas 2017', rating: 83, mentality: 'Balanced', scorers: ['Talisca', 'Cenk', 'Quaresma'] }),
    buildTeam({ id: 'bot5', name: 'Galatasaray 2000', rating: 84, mentality: 'Balanced', scorers: ['Hagi', 'Jardel', 'Hakan Sukur'] }),
  ];

  return opponents.map((opponent, index) => {
    const userIsHome = index % 2 === 0;

    return {
      id: `series-${index + 1}`,
      matchday: index + 1,
      team1: userIsHome ? userTeam : opponent,
      team2: userIsHome ? opponent : userTeam,
      score1: null,
      score2: null,
      winnerId: null,
    };
  });
};

const getSeriesRecord = (matches: Match[]): SeriesRecord => {
  return matches.reduce<SeriesRecord>((record, match) => {
    if (match.score1 === null || match.score2 === null) return record;

    const userSide = match.team1.isUser ? 1 : 2;
    const userScore = userSide === 1 ? match.score1 : match.score2;
    const opponentScore = userSide === 1 ? match.score2 : match.score1;
    const nextRecord = {
      ...record,
      played: record.played + 1,
      goalsFor: record.goalsFor + userScore,
      goalsAgainst: record.goalsAgainst + opponentScore,
    };

    if (userScore > opponentScore) {
      nextRecord.wins += 1;
      nextRecord.points += 3;
      nextRecord.form = [...nextRecord.form, 'G'];
    } else if (userScore === opponentScore) {
      nextRecord.draws += 1;
      nextRecord.points += 1;
      nextRecord.form = [...nextRecord.form, 'B'];
    } else {
      nextRecord.losses += 1;
      nextRecord.form = [...nextRecord.form, 'M'];
    }

    nextRecord.goalDifference = nextRecord.goalsFor - nextRecord.goalsAgainst;
    return nextRecord;
  }, {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  });
};

const calculateFullMatch = (team1: Team, team2: Team, userFormBonus: number): FullMatchResult => {
  const events: MatchEvent[] = [
    { minute: 1, team: 1, type: 'info', text: 'Baslama vurusu geldi. Iki teknik plan da sahada.' },
    { minute: 45, team: 1, type: 'info', text: 'Devre. Soyunma odasinda ayar cekiliyor.' },
    { minute: 60, team: 1, type: 'momentum', text: 'Tempo tekrar yukseldi, orta saha savasi sertlesiyor.' },
    { minute: 75, team: 1, type: 'momentum', text: 'Son bolum. Risk alan taraf maci koparabilir.' },
  ];
  const stats = emptyLiveStats();
  const form1 = team1.isUser ? userFormBonus : 0;
  const form2 = team2.isUser ? userFormBonus : 0;
  let momentum = clamp(50 + (team1.control + form1 - team2.control - form2) * 0.6 + (Math.random() * 12 - 6), 35, 65);
  let score1 = 0;
  let score2 = 0;

  const possessionBase = clamp(50 + (team1.control + form1 - team2.control - form2) * 0.5, 30, 70);

  const addChance = (minute: number, side: 1 | 2) => {
    const attackingTeam = side === 1 ? team1 : team2;
    const defendingTeam = side === 1 ? team2 : team1;
    const attackForm = attackingTeam.isUser ? userFormBonus : 0;
    const defenseForm = defendingTeam.isUser ? userFormBonus : 0;
    const redPenalty = side === 1 ? stats.red1 * 9 : stats.red2 * 9;
    const opponentRedPenalty = side === 1 ? stats.red2 * 7 : stats.red1 * 7;
    const attackEdge = attackingTeam.attack + attackForm - redPenalty - (defendingTeam.defense + defenseForm - opponentRedPenalty);
    const keeperEdge = attackingTeam.attack + attackForm - defendingTeam.goalkeeper;
    const lateRisk = minute > 78 ? 0.025 : 0;
    const bigChance = Math.random() < 0.16 ? 0.13 + Math.random() * 0.08 : 0;
    const xg = rounded(clamp(0.05 + Math.random() * 0.18 + attackEdge * 0.0045 + lateRisk + bigChance, 0.03, 0.58));
    const onTargetChance = clamp(0.33 + xg * 0.85 + keeperEdge * 0.004, 0.24, 0.78);
    const isGoal = Math.random() < xg;
    const isOnTarget = isGoal || Math.random() < onTargetChance;
    const scorer = isGoal ? pickScorer(attackingTeam) : undefined;

    if (side === 1) {
      stats.shots1 += 1;
      stats.xg1 = rounded(stats.xg1 + xg);
      if (isOnTarget) stats.onTarget1 += 1;
      if (isGoal) score1 += 1;
    } else {
      stats.shots2 += 1;
      stats.xg2 = rounded(stats.xg2 + xg);
      if (isOnTarget) stats.onTarget2 += 1;
      if (isGoal) score2 += 1;
    }

    if (isGoal) {
      momentum = clamp(momentum + (side === 1 ? 9 : -9), 8, 92);
      events.push({
        minute,
        team: side,
        type: 'goal',
        scorer,
        xg,
        score: `${score1} - ${score2}`,
        text: `GOL! ${scorer} bitirdi. xG ${xg.toFixed(2)}.`,
      });
      return;
    }

    if (isOnTarget) {
      momentum = clamp(momentum + (side === 1 ? 2 : -2), 8, 92);
      events.push({
        minute,
        team: side,
        type: 'save',
        xg,
        text: `${attackingTeam.name} kaleyi buldu, kaleci cikardi. xG ${xg.toFixed(2)}.`,
      });
      return;
    }

    if (Math.random() < 0.42) {
      if (side === 1) stats.corners1 += 1;
      else stats.corners2 += 1;
      events.push({
        minute,
        team: side,
        type: 'corner',
        xg,
        text: `${attackingTeam.name} korner kazandi, baski suruyor.`,
      });
      return;
    }

    events.push({
      minute,
      team: side,
      type: 'shot',
      xg,
      text: `${attackingTeam.name} sut denedi, top disarida. xG ${xg.toFixed(2)}.`,
    });
  };

  const addCard = (minute: number, side: 1 | 2) => {
    const team = side === 1 ? team1 : team2;
    const isRed = Math.random() < clamp(0.025 + team.risk * 0.0007 - team.discipline * 0.00025, 0.012, 0.09);

    if (side === 1) {
      if (isRed) stats.red1 += 1;
      else stats.yellow1 += 1;
    } else {
      if (isRed) stats.red2 += 1;
      else stats.yellow2 += 1;
    }

    momentum = clamp(momentum + (side === 1 ? -5 : 5) * (isRed ? 2 : 1), 8, 92);
    events.push({
      minute,
      team: side,
      type: 'card',
      card: isRed ? 'red' : 'yellow',
      text: `${team.name} icin ${isRed ? 'kirmizi' : 'sari'} kart. Denge degisti.`,
    });
  };

  for (let minute = 2; minute <= 90; minute += 1) {
    const tempo = (team1.tempo + team2.tempo) / 190;
    const possessionLean = (possessionBase - 50) / 100;
    const chance1 = clamp(0.046 + tempo * 0.046 + (team1.attack + form1 - team2.defense - form2) * 0.0025 + possessionLean * 0.09 + (momentum - 50) * 0.001, 0.02, 0.22);
    const chance2 = clamp(0.046 + tempo * 0.046 + (team2.attack + form2 - team1.defense - form1) * 0.0025 - possessionLean * 0.09 + (50 - momentum) * 0.001, 0.02, 0.22);
    const foulChance1 = clamp(0.005 + team1.risk * 0.00018 + team2.tempo * 0.00008 - team1.discipline * 0.00005, 0.004, 0.026);
    const foulChance2 = clamp(0.005 + team2.risk * 0.00018 + team1.tempo * 0.00008 - team2.discipline * 0.00005, 0.004, 0.026);

    if (Math.random() < chance1) addChance(minute, 1);
    if (Math.random() < chance2) addChance(minute, 2);
    if (Math.random() < foulChance1) addCard(minute, 1);
    if (Math.random() < foulChance2) addCard(minute, 2);
  }

  stats.possession = Math.round(clamp(possessionBase + (stats.red2 - stats.red1) * 5 + (Math.random() * 5 - 2.5), 26, 74));
  stats.momentum = Math.round(clamp(momentum, 0, 100));
  events.sort((a, b) => a.minute - b.minute || (a.type === 'goal' ? -1 : 1));

  return {
    s1: score1,
    s2: score2,
    winnerId: score1 > score2 ? team1.id : score2 > score1 ? team2.id : null,
    events,
    finalStats: stats,
  };
};

const buildUserMatchReport = ({
  match,
  result,
  userPlayers,
  captain,
  captainRole,
  userMentality,
}: {
  match: Match;
  result: FullMatchResult;
  userPlayers: (Player | null)[];
  captain: Player | null;
  captainRole: CaptainRole | null;
  userMentality: MentalityType | null;
}): MatchReport => {
  const userSide = match.team1.isUser ? 1 : 2;
  const opponent = match.team1.isUser ? match.team2 : match.team1;
  const userScore = userSide === 1 ? result.s1 : result.s2;
  const opponentScore = userSide === 1 ? result.s2 : result.s1;
  const userGoals = result.events.filter((event) => event.type === 'goal' && event.team === userSide);
  const topRatedPlayer = userPlayers
    .filter((player): player is Player => player !== null)
    .sort((a, b) => b.overall_rating - a.overall_rating)[0];
  const firstScorer = userGoals.find((event) => event.scorer)?.scorer;
  const points = userScore > opponentScore ? 3 : userScore === opponentScore ? 1 : 0;
  const resultText = points === 3 ? 'Galibiyet' : points === 1 ? 'Beraberlik' : 'Maglubiyet';
  const motm = points === 3
    ? (captain?.name ?? firstScorer ?? topRatedPlayer?.name ?? 'Efsane')
    : points === 1
      ? (topRatedPlayer?.name ?? captain?.name ?? 'Direnc')
      : (firstScorer ?? topRatedPlayer?.name ?? captain?.name ?? 'Mucadele');
  const captainImpact = captain
    ? `${captain.name} (${captainRole?.title}) takima +${captainRole?.bonus ?? 0} liderlik etkisi verdi.`
    : 'Kaptan secilmedi; takim ekstra liderlik etkisi almadi.';
  const userStats = userSide === 1
    ? { shots: result.finalStats.shots1, onTarget: result.finalStats.onTarget1, xg: result.finalStats.xg1, possession: result.finalStats.possession }
    : { shots: result.finalStats.shots2, onTarget: result.finalStats.onTarget2, xg: result.finalStats.xg2, possession: 100 - result.finalStats.possession };
  const cardNote = (userSide === 1 ? result.finalStats.red1 : result.finalStats.red2) > 0
    ? 'Kirmizi kart mac planini bozdu ve son bolumde risk yaratti.'
    : (userSide === 1 ? result.finalStats.yellow1 : result.finalStats.yellow2) >= 3
      ? 'Sari kart yukunden dolayi temas gucu ikinci yarida dustu.'
      : 'Disiplin seviyesi mac boyunca kontrol altinda kaldi.';
  const mentalityNote = userMentality === 'Gegenpress'
    ? 'Gegenpress daha cok sut ve daha fazla gecis riski uretmeye calisti.'
    : userMentality === 'ParkTheBus'
      ? 'Savunma plani xG kalitesini dusurmeye odaklandi.'
      : 'Dengeli plan topu ve mesafeyi birlikte kontrol etmeye calisti.';

  return {
    id: `${match.id}-${result.s1}-${result.s2}-${result.events.length}`,
    result: resultText,
    opponent: opponent.name,
    score: `${userScore}-${opponentScore}`,
    points,
    motm,
    captainImpact,
    notes: [
      `${userStats.shots} sut, ${userStats.onTarget} isabet, ${userStats.xg.toFixed(2)} xG ve %${userStats.possession} topa sahip olma.`,
      mentalityNote,
      cardNote,
    ],
  };
};

const buildReplaySnapshot = (events: MatchEvent[], minute: number, finalStats: LiveStats) => {
  const stats = emptyLiveStats();
  let score1 = 0;
  let score2 = 0;

  events.forEach((event) => {
    if (event.minute > minute) return;

    if (event.type === 'goal') {
      if (event.team === 1) {
        score1 += 1;
        stats.shots1 += 1;
        stats.onTarget1 += 1;
        stats.xg1 = rounded(stats.xg1 + (event.xg ?? 0));
      } else {
        score2 += 1;
        stats.shots2 += 1;
        stats.onTarget2 += 1;
        stats.xg2 = rounded(stats.xg2 + (event.xg ?? 0));
      }
    }

    if (event.type === 'save' || event.type === 'shot') {
      if (event.team === 1) {
        stats.shots1 += 1;
        stats.xg1 = rounded(stats.xg1 + (event.xg ?? 0));
        if (event.type === 'save') stats.onTarget1 += 1;
      } else {
        stats.shots2 += 1;
        stats.xg2 = rounded(stats.xg2 + (event.xg ?? 0));
        if (event.type === 'save') stats.onTarget2 += 1;
      }
    }

    if (event.type === 'corner') {
      if (event.team === 1) stats.corners1 += 1;
      else stats.corners2 += 1;
    }

    if (event.type === 'card') {
      if (event.team === 1) {
        if (event.card === 'red') stats.red1 += 1;
        else stats.yellow1 += 1;
      } else if (event.card === 'red') {
        stats.red2 += 1;
      } else {
        stats.yellow2 += 1;
      }
    }
  });

  return {
    score: { s1: score1, s2: score2 },
    stats: {
      ...stats,
      possession: Math.round(clamp(finalStats.possession + Math.sin(minute / 5) * 2.8, 24, 76)),
      momentum: Math.round(clamp(finalStats.momentum + Math.sin(minute / 6) * 8, 0, 100)),
    },
  };
};

export default function Tournament({ userRating }: { userRating: number }) {
  const theme = useTeamStore((state) => state.theme);
  const userMentality = useTeamStore((state) => state.mentality);
  const userPlayers = useTeamStore((state) => state.selectedPlayers);
  const formationId = useTeamStore((state) => state.formation);
  const captainId = useTeamStore((state) => state.captainId);
  const squadName = useTeamStore((state) => state.squadName);
  const isDark = theme === 'dark';
  const captain = userPlayers.find((player) => player?.id === captainId) ?? null;
  const captainRole = getCaptainRole(captain);

  const [matches, setMatches] = useState<Match[]>(() => buildSeriesMatches(userRating, userMentality, userPlayers, squadName || 'Efsane 11'));
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<SimSpeed>('normal');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [currentMatchMinute, setCurrentMatchMinute] = useState<number | null>(null);
  const [liveScore, setLiveScore] = useState<{ s1: number; s2: number }>({ s1: 0, s2: 0 });
  const [matchLogs, setMatchLog] = useState<MatchEvent[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats>(emptyLiveStats);
  const [champion, setChampion] = useState<Team | null>(null);
  const [headline, setHeadline] = useState<{ title: string; sub: string } | null>(null);
  const [showHeadlineOverlay, setShowHeadlineOverlay] = useState(false);
  const [showPitchPreview, setShowPitchPreview] = useState(false);
  const [isEliminated, setIsEliminated] = useState(false);
  const [matchReports, setMatchReports] = useState<MatchReport[]>([]);

  const headlineRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const completedMatches = matches.filter((match) => match.score1 !== null && match.score2 !== null);
  const nextMatch = matches.find((match) => match.score1 === null || match.score2 === null) ?? null;
  const seriesRecord = getSeriesRecord(matches);
  const latestPlayedMatch = completedMatches[completedMatches.length - 1] ?? null;
  const focusedMatch = matches.find((match) => match.id === activeMatchId) ?? latestPlayedMatch ?? nextMatch;
  const seriesFinished = seriesRecord.played === SERIES_LENGTH;

  const saveTournamentOutcome = (outcome: 'champion' | 'eliminated', headlineText: string) => {
    if (!formationId) return;

    saveTeamSnapshot({
      formation: formationId,
      rating: userRating,
      captainId,
      playerIds: userPlayers.map((player) => player?.id ?? null),
      outcome,
      headline: headlineText,
    });
  };

  const finishSeriesIfNeeded = (nextMatches: Match[]) => {
    const finalRecord = getSeriesRecord(nextMatches);
    if (finalRecord.played < SERIES_LENGTH) return;

    const finalOpponent = nextMatches[nextMatches.length - 1]?.team1.isUser
      ? nextMatches[nextMatches.length - 1]?.team2.name
      : nextMatches[nextMatches.length - 1]?.team1.name;
    const pointLine = `${finalRecord.points}/15 puan, ${finalRecord.goalsFor}-${finalRecord.goalsAgainst} skor, ${finalRecord.goalDifference >= 0 ? '+' : ''}${finalRecord.goalDifference} averaj`;
    const userTeam = nextMatches.find((match) => match.team1.isUser)?.team1 ?? nextMatches.find((match) => match.team2.isUser)?.team2 ?? null;

    if (finalRecord.points >= TROPHY_TARGET_POINTS) {
      const headlineText = `${squadName || 'Efsane 11'}, 5 maclik seriyi ${pointLine} ile tamamladi ve kupaya uzandi. Son rakip: ${finalOpponent}.`;
      setHeadline({ title: 'TARIH YAZILDI!', sub: headlineText });
      setChampion(userTeam);
      saveTournamentOutcome('champion', headlineText);
    } else {
      const missing = TROPHY_TARGET_POINTS - finalRecord.points;
      const headlineText = `${squadName || 'Efsane 11'}, 5 maclik seriyi ${pointLine} ile bitirdi. Kupa icin ${missing} puan daha gerekiyordu.`;
      setHeadline({ title: 'SERI YETMEDI', sub: headlineText });
      setIsEliminated(true);
      saveTournamentOutcome('eliminated', headlineText);
    }

    setShowHeadlineOverlay(true);
  };

  const playNextMatch = async () => {
    if (isSimulating || !nextMatch) return;

    setIsSimulating(true);
    setActiveMatchId(nextMatch.id);
    setMatchLog([]);
    setLiveScore({ s1: 0, s2: 0 });
    setLiveStats(emptyLiveStats());

    const recordBefore = getSeriesRecord(matches);
    const userFormBonus = clamp(recordBefore.wins * 1.35 + recordBefore.draws * 0.45 - recordBefore.losses * 1.25, -4, 5);
    const result = calculateFullMatch(nextMatch.team1, nextMatch.team2, userFormBonus);
    const speedConfig = SIM_SPEED_CONFIG[simSpeed];

    for (let minute = 1; minute <= 90; minute += 1) {
      setCurrentMatchMinute(minute);
      const replay = buildReplaySnapshot(result.events, minute, result.finalStats);
      setLiveScore(replay.score);
      setLiveStats(replay.stats);
      const currentEvents = result.events.filter((event) => event.minute === minute);
      if (currentEvents.length > 0) {
        setMatchLog((previous) => [...previous, ...currentEvents].slice(-70));
      }

      if (currentEvents.some((event) => event.type === 'goal')) {
        await wait(speedConfig.goalPause);
      }

      await wait(speedConfig.minuteDelay);
    }

    setLiveStats({ ...result.finalStats });
    setLiveScore({ s1: result.s1, s2: result.s2 });
    await wait(speedConfig.postMatchPause);

    const playedMatch: Match = {
      ...nextMatch,
      score1: result.s1,
      score2: result.s2,
      winnerId: result.winnerId,
      finalStats: result.finalStats,
    };
    const nextMatches = matches.map((match) => (match.id === nextMatch.id ? playedMatch : match));
    const report = buildUserMatchReport({
      match: nextMatch,
      result,
      userPlayers,
      captain,
      captainRole,
      userMentality,
    });

    setMatches(nextMatches);
    setMatchReports((previous) => [report, ...previous].slice(0, SERIES_LENGTH));
    setCurrentMatchMinute(null);
    setIsSimulating(false);
    finishSeriesIfNeeded(nextMatches);
  };

  const downloadHeadline = async () => {
    if (!headlineRef.current) return;

    const dataUrl = await toPng(headlineRef.current, { quality: 1, pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = 'manset.png';
    link.href = dataUrl;
    link.click();
  };

  const downloadTeamPitch = async () => {
    if (!pitchRef.current) return;

    const dataUrl = await toPng(pitchRef.current, { quality: 1, pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = 'kadrom.png';
    link.href = dataUrl;
    link.click();
  };

  const getMatchResultLabel = (match: Match) => {
    if (match.score1 === null || match.score2 === null) return 'SIRADA';
    const userSide = match.team1.isUser ? 1 : 2;
    const userScore = userSide === 1 ? match.score1 : match.score2;
    const opponentScore = userSide === 1 ? match.score2 : match.score1;

    if (userScore > opponentScore) return '+3 PUAN';
    if (userScore === opponentScore) return '+1 PUAN';
    return '0 PUAN';
  };

  const getFocusedScore = (side: 1 | 2) => {
    if (currentMatchMinute) return side === 1 ? liveScore.s1 : liveScore.s2;
    if (!focusedMatch) return '-';
    return side === 1 ? focusedMatch.score1 ?? '-' : focusedMatch.score2 ?? '-';
  };

  return (
    <div className={`w-full max-w-7xl mx-auto rounded-none p-4 sm:p-10 transition-colors duration-300 ${isDark ? 'bg-zinc-950 text-white' : 'bg-white text-black'} border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col xl:flex-row gap-8`}>
      {showHeadlineOverlay && headline && (
        <div className="absolute inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
          <button onClick={() => setShowHeadlineOverlay(false)} className="game-button absolute top-8 right-8 p-4 bg-red-600 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-white hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
            <X size={40} />
          </button>
          <div ref={headlineRef} className="bg-white text-black p-10 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-3xl mb-10 font-serif">
            <p className="text-right text-xs font-black border-b-2 border-black pb-2 mb-6 uppercase tracking-widest">EFSANE 11 GAZETESI - 5 MAC OZEL</p>
            <h1 className="text-5xl sm:text-6xl font-black mb-6 leading-none tracking-tighter uppercase italic">{headline.title}</h1>
            <div className="h-1.5 bg-black w-full mb-6" />
            <p className="text-xl sm:text-2xl font-bold leading-tight">{headline.sub}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <button onClick={downloadHeadline} className="game-button px-8 sm:px-10 py-4 bg-red-600 text-white font-black text-lg sm:text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">
              <Share2 size={24} className="inline mr-2" /> MANSETI INDIR
            </button>
            <button onClick={() => setShowHeadlineOverlay(false)} className="game-button px-8 sm:px-10 py-4 bg-zinc-700 text-white font-black text-lg sm:text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">INCELE</button>
          </div>
        </div>
      )}

      {showPitchPreview && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col items-center justify-center p-4">
          <button onClick={() => setShowPitchPreview(false)} className="game-button absolute top-6 right-6 p-3 bg-red-600 border-2 border-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <X size={32} />
          </button>
          <div className="w-full max-w-5xl h-[85vh] flex items-center justify-center">
            <div className="scale-[0.4] sm:scale-[0.6] md:scale-[0.75] lg:scale-[0.85] xl:scale-95 transition-transform duration-500 overflow-visible">
              <div ref={pitchRef} className="p-10 bg-[#2d4d3a] border-4 border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]">
                <Pitch />
              </div>
            </div>
          </div>
          <button onClick={downloadTeamPitch} className="game-button game-button-major mt-8 px-14 py-5 bg-green-600 text-white font-black text-3xl border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">RESMI INDIR</button>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-center border-b-2 border-black pb-8 gap-6">
          <div className="flex items-center gap-4">
            <Trophy className="text-yellow-500" size={40} />
            <div>
              <span className="block text-3xl sm:text-4xl font-black italic tracking-tighter uppercase">5 Mac Serisi</span>
              <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.22em] opacity-55">{seriesRecord.points}/15 puan - hedef {TROPHY_TARGET_POINTS}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-black/20 p-2 rounded-none border-2 border-black">
            <button onClick={() => setSimSpeed('normal')} disabled={isSimulating} className={`game-button px-4 sm:px-5 py-3 text-xs font-black transition-all ${simSpeed === 'normal' ? 'game-button-selected bg-black text-white' : 'text-gray-500 hover:text-white'}`}>NORMAL</button>
            <button onClick={() => setSimSpeed('fast')} disabled={isSimulating} className={`game-button px-4 sm:px-5 py-3 text-xs font-black transition-all ${simSpeed === 'fast' ? 'game-button-selected bg-black text-white' : 'text-gray-500 hover:text-white'}`}>HIZLI</button>
            <button onClick={() => setSimSpeed('hyper')} disabled={isSimulating} className={`game-button px-4 sm:px-5 py-3 text-xs font-black transition-all ${simSpeed === 'hyper' ? 'game-button-selected bg-black text-white' : 'text-gray-500 hover:text-white'}`}>HIPER</button>
          </div>

          {currentMatchMinute && <div className="bg-red-600 px-8 py-3 border-2 border-black shadow-[5px_5px_0px_0px_#000] font-mono font-black text-3xl">{currentMatchMinute}&apos;</div>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['O', seriesRecord.played],
            ['G', seriesRecord.wins],
            ['B', seriesRecord.draws],
            ['M', seriesRecord.losses],
          ].map(([label, value]) => (
            <div key={label} className="border-2 border-black bg-black/5 p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">{label}</p>
              <p className="mt-1 text-3xl font-black font-mono">{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {matches.map((match) => {
            const isActive = activeMatchId === match.id && currentMatchMinute !== null;
            const played = match.score1 !== null && match.score2 !== null;

            return (
              <div key={match.id} className={`relative p-5 lg:p-6 border-4 border-black shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] ${isActive ? 'bg-yellow-500 text-black' : played ? 'bg-black/10' : 'bg-black/5'}`}>
                <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-black/10 pb-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] opacity-65">{match.matchday}. mac / {SERIES_LENGTH}</span>
                  <span className="border-2 border-black px-3 py-1 text-[10px] font-black uppercase">{isActive ? `${currentMatchMinute}'` : getMatchResultLabel(match)}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 lg:gap-7">
                  <div className="min-w-0 text-left">
                    <span className="block text-lg lg:text-2xl font-black uppercase tracking-tighter italic leading-tight break-words">{match.team1.name}</span>
                    <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.16em] opacity-45">R{match.team1.rating} / {match.team1.mentality}</span>
                  </div>
                  <div className="min-w-[7.5rem] lg:min-w-[9rem] text-center">
                    <span className="block whitespace-nowrap font-mono text-5xl lg:text-6xl font-black leading-none tracking-tighter">
                      {played ? match.score1 : isActive ? liveScore.s1 : '-'}
                      <span className="mx-2 text-red-600">:</span>
                      {played ? match.score2 : isActive ? liveScore.s2 : '-'}
                    </span>
                  </div>
                  <div className="min-w-0 text-right">
                    <span className="block text-lg lg:text-2xl font-black uppercase tracking-tighter italic leading-tight break-words">{match.team2.name}</span>
                    <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.16em] opacity-45">R{match.team2.rating} / {match.team2.mentality}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!champion && !isEliminated && (
          <button
            onClick={playNextMatch}
            disabled={isSimulating || !nextMatch}
            className="game-button game-button-major w-full border-4 border-black bg-yellow-500 px-6 py-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:bg-yellow-400 disabled:opacity-60 disabled:grayscale"
          >
            <span className="flex items-center justify-center gap-3 text-2xl sm:text-4xl font-black italic tracking-tighter">
              <Play size={32} fill="currentColor" />
              {isSimulating ? 'SIMULASYON...' : nextMatch ? `${nextMatch.matchday}. MACI BASLAT` : 'SERI BITTI'}
            </span>
            <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.25em] opacity-55">
              {simSpeed === 'hyper' ? 'Hiper akis' : simSpeed === 'fast' ? 'Hizli akis' : 'Normal akis'} / xG, kart, momentum ve puan hesabi
            </span>
          </button>
        )}

        {(champion || isEliminated || seriesFinished) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
            <button onClick={() => setShowHeadlineOverlay(true)} className="game-button game-button-major py-6 bg-red-600 text-white font-black text-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">MANSETLERI AC</button>
            <button onClick={() => setShowPitchPreview(true)} className="game-button game-button-major py-6 bg-blue-600 text-white font-black text-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all uppercase">Kadroyu Gor</button>
          </div>
        )}
      </div>

      <div className="w-full xl:w-96 flex flex-col gap-8">
        <div className="p-6 lg:p-8 border-4 border-black bg-black/10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="font-black uppercase text-xs tracking-[0.2em] opacity-60 mb-6 flex items-center gap-3"><Activity size={20} /> MAC MOTORU</h3>

          <div className="mb-8 border-b-2 border-black/10 pb-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <p className="truncate text-left text-xs font-black uppercase opacity-60">{focusedMatch?.team1.name ?? '-'}</p>
              <p className="text-xs font-black uppercase tracking-widest opacity-45">SKOR</p>
              <p className="truncate text-right text-xs font-black uppercase opacity-60">{focusedMatch?.team2.name ?? '-'}</p>
            </div>
            <div className="mt-2 flex justify-between items-center">
              <div className="text-4xl font-black font-mono">{getFocusedScore(1)}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-45">{currentMatchMinute ? 'canli' : 'son mac'}</div>
              <div className="text-4xl font-black font-mono">{getFocusedScore(2)}</div>
            </div>
          </div>

          <div className="space-y-7">
            <div>
              <div className="flex justify-between text-xs font-black uppercase mb-2"><span>{liveStats.possession}%</span><span>TOPLA OYNAMA</span><span>{100 - liveStats.possession}%</span></div>
              <div className="w-full h-3 bg-black/20 border-2 border-black flex">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${liveStats.possession}%` }} />
                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${100 - liveStats.possession}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="border-2 border-black/10 p-2"><div className="text-2xl font-black">{liveStats.shots1}</div><div className="text-[9px] font-black opacity-50">SUT</div></div>
              <div className="border-2 border-black/10 p-2"><div className="text-2xl font-black text-blue-500">{liveStats.onTarget1}</div><div className="text-[9px] font-black opacity-50">ISABET</div></div>
              <div className="border-2 border-black/10 p-2"><div className="text-2xl font-black text-red-500">{liveStats.onTarget2}</div><div className="text-[9px] font-black opacity-50">ISABET</div></div>
              <div className="border-2 border-black/10 p-2"><div className="text-2xl font-black">{liveStats.shots2}</div><div className="text-[9px] font-black opacity-50">SUT</div></div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="border-2 border-black/10 p-3"><div className="text-xl font-black">{liveStats.xg1.toFixed(2)} / {liveStats.xg2.toFixed(2)}</div><div className="text-[9px] font-black opacity-50">xG</div></div>
              <div className="border-2 border-black/10 p-3"><div className="text-xl font-black">{liveStats.corners1} / {liveStats.corners2}</div><div className="text-[9px] font-black opacity-50">KORNER</div></div>
              <div className="border-2 border-black/10 p-3"><div className="text-xl font-black">{liveStats.yellow1 + liveStats.red1} / {liveStats.yellow2 + liveStats.red2}</div><div className="text-[9px] font-black opacity-50">KART</div></div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-xs font-black uppercase"><span>Momentum</span><span>{liveStats.momentum}</span></div>
              <div className="h-3 border-2 border-black bg-black/20">
                <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${liveStats.momentum}%` }} />
              </div>
            </div>
          </div>
        </div>

        {matchReports[0] && (
          <div className="p-6 border-4 border-black bg-yellow-500 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-black uppercase text-xs tracking-[0.2em] opacity-70 mb-5 flex items-center gap-3">
              <FileText size={18} /> MAC RAPORU
            </h3>
            <div className="flex items-end justify-between gap-3 border-b-2 border-black/20 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{matchReports[0].result} / +{matchReports[0].points}</p>
                <p className="text-2xl font-black italic leading-none mt-1">{matchReports[0].score}</p>
                <p className="text-xs font-black opacity-70 mt-2">vs {matchReports[0].opponent}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">Macin Adami</p>
                <p className="text-lg font-black">{matchReports[0].motm}</p>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 border-b-2 border-black/20 pb-4">
              <Crown size={18} className="mt-0.5 shrink-0" />
              <p className="text-xs font-black leading-relaxed">{matchReports[0].captainImpact}</p>
            </div>
            <div className="mt-4 space-y-2">
              {matchReports[0].notes.map((note) => (
                <p key={note} className="text-[11px] font-black leading-relaxed opacity-75">- {note}</p>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-[450px] border-4 border-black bg-black/5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 lg:p-8 flex flex-col">
          <h3 className="font-black uppercase text-xs tracking-[0.2em] opacity-60 mb-6 border-b-2 border-black/10 pb-4 flex items-center gap-3">
            <BellRing size={20} className="text-blue-500" /> CANLI ANLATIM
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
            {matchLogs.length === 0 ? <p className="text-center text-xs font-black opacity-20 mt-20 italic uppercase tracking-widest">Baslama vurusu bekleniyor...</p> :
              matchLogs.map((log, i) => (
                <div key={`${log.minute}-${log.type}-${i}`} className={`p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-right duration-300 ${log.type === 'goal' ? 'bg-yellow-400 text-black' : log.type === 'card' ? 'bg-red-600 text-white' : 'bg-white text-black'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black bg-black text-white px-3 py-1">{log.minute}&apos;</span>
                    {log.score && <span className="text-xs font-black border-2 border-black px-3 py-0.5">{log.score}</span>}
                  </div>
                  <p className="text-xs font-black leading-tight uppercase italic">{log.text}</p>
                </div>
              )).reverse()}
          </div>
        </div>
      </div>
    </div>
  );
}
