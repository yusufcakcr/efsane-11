'use client';

import { useState, useRef } from 'react';
import { Trophy, BellRing, Share2, Activity, X, Crown, FileText, Play } from 'lucide-react';
import { useTeamStore, MentalityType } from '@/store/useTeamStore';
import { toPng } from 'html-to-image';
import Pitch from './Pitch';
import { getCaptainRole } from '@/lib/captain';
import { saveTeamSnapshot } from '@/lib/localStats';

interface Team {
  id: string;
  name: string;
  rating: number;
  isUser?: boolean;
  mentality?: MentalityType | null;
  scorers: string[];
}

interface Match {
  id: string;
  team1: Team;
  team2: Team;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
}

interface LiveStats {
  possession: number;
  shots1: number;
  onTarget1: number;
  shots2: number;
  onTarget2: number;
}

interface MatchReport {
  id: string;
  result: 'Galibiyet' | 'Mağlubiyet';
  opponent: string;
  score: string;
  motm: string;
  captainImpact: string;
  notes: string[];
}

type SimSpeed = 'normal' | 'fast' | 'hyper';

const SIM_SPEED_CONFIG: Record<SimSpeed, { minuteDelay: number; goalPause: number; postMatchPause: number }> = {
  normal: { minuteDelay: 260, goalPause: 1100, postMatchPause: 800 },
  fast: { minuteDelay: 55, goalPause: 320, postMatchPause: 450 },
  hyper: { minuteDelay: 4, goalPause: 45, postMatchPause: 160 },
};

const buildInitialMatches = (
  userRating: number,
  userMentality: MentalityType | null,
  userScorers: string[],
  userTeamName: string
): Match[] => {
  const teams: Team[] = [
    { id: 'user', name: userTeamName, rating: userRating, isUser: true, mentality: userMentality, scorers: userScorers },
    { id: 'bot1', name: 'Manchester United 1999', rating: 85, mentality: 'Balanced', scorers: ['Beckham', 'Giggs', 'Yorke'] },
    { id: 'bot2', name: 'Arsenal 2004', rating: 86, mentality: 'Gegenpress', scorers: ['Henry', 'Bergkamp', 'Pires'] },
    { id: 'bot3', name: 'FC Barcelona 2009', rating: 86, mentality: 'Balanced', scorers: ['Messi', 'Eto\'o', 'Xavi'] },
    { id: 'bot4', name: 'Real Madrid 2017', rating: 86, mentality: 'Gegenpress', scorers: ['Ronaldo', 'Benzema', 'Modric'] },
    { id: 'bot5', name: 'FC Bayern 2013', rating: 84, mentality: 'Gegenpress', scorers: ['Robben', 'Ribery', 'Müller'] },
    { id: 'bot6', name: 'AC Milan 2005', rating: 85, mentality: 'ParkTheBus', scorers: ['Kaka', 'Shevchenko', 'Pirlo'] },
    { id: 'bot7', name: 'Inter Milan 2010', rating: 83, mentality: 'ParkTheBus', scorers: ['Milito', 'Sneijder', 'Eto\'o'] },
  ];

  teams.sort(() => Math.random() - 0.5);

  return [
    { id: 'q1', team1: teams[0], team2: teams[1], score1: null, score2: null, winnerId: null },
    { id: 'q2', team1: teams[2], team2: teams[3], score1: null, score2: null, winnerId: null },
    { id: 'q3', team1: teams[4], team2: teams[5], score1: null, score2: null, winnerId: null },
    { id: 'q4', team1: teams[6], team2: teams[7], score1: null, score2: null, winnerId: null },
  ];
};

export default function Tournament({ userRating }: { userRating: number }) {
  const theme = useTeamStore(state => state.theme);
  const userMentality = useTeamStore(state => state.mentality);
  const userPlayers = useTeamStore(state => state.selectedPlayers);
  const formationId = useTeamStore(state => state.formation);
  const captainId = useTeamStore(state => state.captainId);
  const squadName = useTeamStore(state => state.squadName);
  const isDark = theme === 'dark';
  const captain = userPlayers.find(player => player?.id === captainId) ?? null;
  const captainRole = getCaptainRole(captain);

  const userScorers = userPlayers
    .filter(p => p !== null && (['SF', 'SLK', 'SĞK', 'MO', 'OOS'].includes(p.position)))
    .map(p => p!.name);

  const [round, setRound] = useState<number>(0);
  const [matches, setMatches] = useState<Match[]>(() => buildInitialMatches(userRating, userMentality, userScorers, squadName || 'Efsane 11'));
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<SimSpeed>('normal');
  const [currentMatchMinute, setCurrentMatchMinute] = useState<number | null>(null);
  const [liveScore, setLiveScore] = useState<{s1: number, s2: number}>({ s1: 0, s2: 0 });
  const [matchLogs, setMatchLog] = useState<{minute: number, text: string, score: string, type: 'goal' | 'info'}[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats>({ possession: 50, shots1: 0, onTarget1: 0, shots2: 0, onTarget2: 0 });
  const [champion, setChampion] = useState<Team | null>(null);
  const [headline, setHeadline] = useState<{title: string, sub: string} | null>(null);
  const [showHeadlineOverlay, setShowHeadlineOverlay] = useState(false);
  const [showPitchPreview, setShowPitchPreview] = useState(false);
  const [isEliminated, setIsEliminated] = useState(false);
  const [matchReports, setMatchReports] = useState<MatchReport[]>([]);
  
  const headlineRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const calculateFullMatch = (team1: Team, team2: Team) => {
    const diff = team1.rating - team2.rating;
    const getBaseGoals = (mentality: MentalityType | null | undefined) => {
      if (mentality === 'Gegenpress') return Math.floor(Math.random() * 4);
      if (mentality === 'ParkTheBus') return Math.floor(Math.random() * 2);
      return Math.floor(Math.random() * 3);
    };
    let s1 = getBaseGoals(team1.mentality);
    let s2 = getBaseGoals(team2.mentality);
    if (team1.mentality === 'Gegenpress') s2 += Math.random() > 0.6 ? 1 : 0;
    if (team2.mentality === 'Gegenpress') s1 += Math.random() > 0.6 ? 1 : 0;
    if (team1.mentality === 'ParkTheBus') s2 = Math.max(0, s2 - (Math.random() > 0.5 ? 1 : 0));
    if (team2.mentality === 'ParkTheBus') s1 = Math.max(0, s1 - (Math.random() > 0.5 ? 1 : 0));
    if (diff > 0) s1 += 1; else if (diff < 0) s2 += 1;
    if (s1 === s2) {
      if (Math.random() > 0.5) s1++;
      else s2++;
    }
    const events: {minute: number, team: 1|2, type: 'goal' | 'shot', scorer?: string}[] = [];
    for(let i=0; i<s1; i++) events.push({ minute: Math.floor(Math.random() * 90) + 1, team: 1, type: 'goal', scorer: team1.scorers[Math.floor(Math.random() * team1.scorers.length)] || "Efsane" });
    for(let i=0; i<s2; i++) events.push({ minute: Math.floor(Math.random() * 90) + 1, team: 2, type: 'goal', scorer: team2.scorers[Math.floor(Math.random() * team2.scorers.length)] || "Yıldız" });
    const totalShots1 = 8 + Math.floor(Math.random() * 10) + (team1.mentality === 'Gegenpress' ? 5 : 0);
    const totalShots2 = 8 + Math.floor(Math.random() * 10) + (team2.mentality === 'Gegenpress' ? 5 : 0);
    for(let i=0; i<totalShots1; i++) events.push({ minute: Math.floor(Math.random() * 90) + 1, team: 1, type: 'shot' });
    for(let i=0; i<totalShots2; i++) events.push({ minute: Math.floor(Math.random() * 90) + 1, team: 2, type: 'shot' });
    events.sort((a,b) => a.minute - b.minute);
    let p1 = 50 + (diff * 4) + (team1.mentality === 'ParkTheBus' ? -15 : 0) + (team2.mentality === 'ParkTheBus' ? 15 : 0);
    p1 = Math.min(70, Math.max(30, p1));
    return { s1, s2, winnerId: s1 > s2 ? team1.id : team2.id, events, finalPossession: Math.round(p1) };
  };

  const buildUserMatchReport = (match: Match, result: ReturnType<typeof calculateFullMatch>): MatchReport => {
    const userSide = match.team1.isUser ? 1 : 2;
    const opponent = match.team1.isUser ? match.team2 : match.team1;
    const userScore = userSide === 1 ? result.s1 : result.s2;
    const opponentScore = userSide === 1 ? result.s2 : result.s1;
    const userGoals = result.events.filter((event) => event.type === 'goal' && event.team === userSide);
    const topRatedPlayer = userPlayers
      .filter((player): player is NonNullable<typeof player> => player !== null)
      .sort((a, b) => b.overall_rating - a.overall_rating)[0];
    const firstScorer = userGoals.find((event) => event.scorer)?.scorer;
    const motm = result.winnerId === 'user'
      ? (captain && Math.random() > 0.55 ? captain.name : firstScorer ?? topRatedPlayer?.name ?? 'Efsane')
      : (topRatedPlayer?.name ?? captain?.name ?? 'Direnen Efsane');
    const captainImpact = captain
      ? `${captain.name} (${captainRole?.title}) takima +${captainRole?.bonus ?? 0} liderlik etkisi verdi.`
      : 'Kaptan secilmedi; takim ekstra liderlik etkisi almadi.';
    const goalNote = userGoals.length > 0
      ? `${userGoals.map((event) => `${event.minute}' ${event.scorer}`).join(', ')} ile skor uretildi.`
      : 'Hucum hattinda net gol katkisi bulunamadi.';
    const mentalityNote = userMentality === 'Gegenpress'
      ? 'Gegenpress tercihi maci daha acik ve tempolu hale getirdi.'
      : userMentality === 'ParkTheBus'
        ? 'Savunma plani riski azaltti ama hucum hacmini dusurdu.'
        : 'Dengeli plan takim boyunu korudu ve ritmi sabit tuttu.';

    return {
      id: `${match.id}-${Date.now()}`,
      result: result.winnerId === 'user' ? 'Galibiyet' : 'Mağlubiyet',
      opponent: opponent.name,
      score: `${userScore}-${opponentScore}`,
      motm,
      captainImpact,
      notes: [
        goalNote,
        mentalityNote,
        `Topla oynama ${userSide === 1 ? result.finalPossession : 100 - result.finalPossession}% seviyesinde bitti.`,
      ],
    };
  };

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

  const playRound = async () => {
    setIsSimulating(true);
    setMatchLog([]);
    setLiveScore({ s1: 0, s2: 0 });
    setLiveStats({ possession: 50, shots1: 0, onTarget1: 0, shots2: 0, onTarget2: 0 });
    const currentRoundMatches = matches.filter(m => m.score1 === null);
    const pastMatches = matches.filter(m => m.score1 !== null);
    const newSimulated: Match[] = [];
    let userWon = true;

    for (const match of currentRoundMatches) {
      const isUserMatch = match.team1.isUser || match.team2.isUser;
      const res = calculateFullMatch(match.team1, match.team2);
      if (isUserMatch) {
        let curS1 = 0; let curS2 = 0;
        let curShots1 = 0; let curShots2 = 0;
        let curTarget1 = 0; let curTarget2 = 0;
        const speedConfig = SIM_SPEED_CONFIG[simSpeed];
        for (let m = 1; m <= 90; m++) {
          setCurrentMatchMinute(m);
          const drift = Math.sin(m / 4) * 4;
          setLiveStats(prev => ({ ...prev, possession: Math.round(res.finalPossession + drift) }));
          const currentEvents = res.events.filter(e => e.minute === m);
          for (const ev of currentEvents) {
            if (ev.type === 'goal') {
              if (ev.team === 1) { curS1++; curShots1++; curTarget1++; } else { curS2++; curShots2++; curTarget2++; }
              setLiveScore({ s1: curS1, s2: curS2 });
              setMatchLog(prev => [...prev, { minute: m, text: `GOL! ${ev.scorer}!`, score: `${curS1} - ${curS2}`, type: 'goal' }]);
              await new Promise(r => setTimeout(r, speedConfig.goalPause));
            } else {
              const onTarget = Math.random() > 0.7;
              if (ev.team === 1) { curShots1++; if(onTarget) curTarget1++; } else { curShots2++; if(onTarget) curTarget2++; }
              setLiveStats(prev => ({ ...prev, shots1: curShots1, onTarget1: curTarget1, shots2: curShots2, onTarget2: curTarget2 }));
            }
          }
          await new Promise(r => setTimeout(r, speedConfig.minuteDelay));
        }
        await new Promise(r => setTimeout(r, speedConfig.postMatchPause));
        setCurrentMatchMinute(null);
        newSimulated.push({ ...match, score1: res.s1, score2: res.s2, winnerId: res.winnerId });
        const report = buildUserMatchReport(match, res);
        setMatchReports(prev => [report, ...prev].slice(0, 3));
        if (res.winnerId !== 'user') {
          userWon = false; setIsEliminated(true);
          const finalScore = match.team1.isUser ? `${res.s1}-${res.s2}` : `${res.s2}-${res.s1}`;
          const finalOpponent = match.team1.isUser ? match.team2.name : match.team1.name;
          const headlineText = `Efsane 11, ${finalOpponent} karşısında ${finalScore} ile veda etti.`;
          setHeadline({ title: "YIKILDIK...", sub: headlineText });
          saveTournamentOutcome('eliminated', headlineText);
          setShowHeadlineOverlay(true);
        } else if (round === 2) {
          const finalScore = match.team1.isUser ? `${res.s1}-${res.s2}` : `${res.s2}-${res.s1}`;
          const finalOpponent = match.team1.isUser ? match.team2.name : match.team1.name;
          const headlineText = `Efsane 11, finalde ${finalOpponent}'ı ${finalScore} devirerek kupaya uzandı!`;
          setHeadline({ title: "TARİH YAZILDI!", sub: headlineText });
          setChampion(match.team1.isUser ? match.team1 : match.team2);
          saveTournamentOutcome('champion', headlineText);
          setShowHeadlineOverlay(true);
        }
      } else {
        newSimulated.push({ ...match, score1: res.s1, score2: res.s2, winnerId: res.winnerId });
      }
    }
    if (userWon && round < 2) {
      const allSoFar = [...pastMatches, ...newSimulated];
      let nextRoundMatches: Match[] = [];
      if (round === 0) {
        nextRoundMatches = [
          { id: 's1', team1: newSimulated[0].winnerId === newSimulated[0].team1.id ? newSimulated[0].team1 : newSimulated[0].team2, team2: newSimulated[1].winnerId === newSimulated[1].team1.id ? newSimulated[1].team1 : newSimulated[1].team2, score1: null, score2: null, winnerId: null },
          { id: 's2', team1: newSimulated[2].winnerId === newSimulated[2].team1.id ? newSimulated[2].team1 : newSimulated[2].team2, team2: newSimulated[3].winnerId === newSimulated[3].team1.id ? newSimulated[3].team1 : newSimulated[3].team2, score1: null, score2: null, winnerId: null },
        ];
      } else if (round === 1) {
        nextRoundMatches = [{ id: 'f1', team1: newSimulated[0].winnerId === newSimulated[0].team1.id ? newSimulated[0].team1 : newSimulated[0].team2, team2: newSimulated[1].winnerId === newSimulated[1].team1.id ? newSimulated[1].team1 : newSimulated[1].team2, score1: null, score2: null, winnerId: null }];
      }
      setMatches([...allSoFar, ...nextRoundMatches]);
      setRound(prev => prev + 1);
    } else {
       setMatches([...pastMatches, ...newSimulated]);
    }
    setIsSimulating(false);
  };

  const downloadHeadline = async () => {
    if (headlineRef.current) {
      const dataUrl = await toPng(headlineRef.current, { quality: 1, pixelRatio: 2 });
      const link = document.createElement('a'); link.download = 'manset.png'; link.href = dataUrl; link.click();
    }
  };

  const downloadTeamPitch = async () => {
    if (pitchRef.current) {
      const dataUrl = await toPng(pitchRef.current, { quality: 1, pixelRatio: 2 });
      const link = document.createElement('a'); link.download = 'kadrom.png'; link.href = dataUrl; link.click();
    }
  };

  const getRoundName = () => (['Çeyrek Final', 'Yarı Final', 'Final', 'Turnuva Bitti'])[round];

  return (
    <div className={`w-full max-w-7xl mx-auto rounded-none p-4 sm:p-10 transition-colors duration-300 ${isDark ? 'bg-zinc-950 text-white' : 'bg-white text-black'} border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col xl:flex-row gap-8`}>
      
      {showHeadlineOverlay && headline && (
        <div className="absolute inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
           <button onClick={() => setShowHeadlineOverlay(false)} className="game-button absolute top-8 right-8 p-4 bg-red-600 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-white hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"><X size={40} /></button>
           <div ref={headlineRef} className="bg-white text-black p-10 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-3xl mb-10 font-serif">
              <p className="text-right text-xs font-black border-b-2 border-black pb-2 mb-6 uppercase tracking-widest">EFSANE 11 GAZETESİ - ÖZEL BASKI</p>
              <h1 className="text-6xl font-black mb-6 leading-none tracking-tighter uppercase italic">{headline.title}</h1>
              <div className="h-1.5 bg-black w-full mb-6"></div>
              <p className="text-2xl font-bold leading-tight">{headline.sub}</p>
           </div>
           <div className="flex gap-6">
              <button onClick={downloadHeadline} className="game-button px-10 py-4 bg-red-600 text-white font-black text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"><Share2 size={24} className="inline mr-2" /> MANŞETİ İNDİR</button>
              <button onClick={() => setShowHeadlineOverlay(false)} className="game-button px-10 py-4 bg-zinc-700 text-white font-black text-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">İNCELE</button>
           </div>
        </div>
      )}

      {showPitchPreview && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col items-center justify-center p-4">
           <button onClick={() => setShowPitchPreview(false)} className="game-button absolute top-6 right-6 p-3 bg-red-600 border-2 border-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"><X size={32} /></button>
           <div className="w-full max-w-5xl h-[85vh] flex items-center justify-center">
              <div className="scale-[0.4] sm:scale-[0.6] md:scale-[0.75] lg:scale-[0.85] xl:scale-95 transition-transform duration-500 overflow-visible">
                <div ref={pitchRef} className="p-10 bg-[#2d4d3a] border-4 border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]"><Pitch /></div>
              </div>
           </div>
           <button onClick={downloadTeamPitch} className="game-button game-button-major mt-8 px-14 py-5 bg-green-600 text-white font-black text-3xl border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">RESMİ İNDİR</button>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-center border-b-2 border-black pb-8 gap-6">
          <div className="flex items-center gap-4"><Trophy className="text-yellow-500" size={40} /> <span className="text-4xl font-black italic tracking-tighter uppercase">{getRoundName()}</span></div>
          
          <div className="flex items-center gap-3 bg-black/20 p-2 rounded-none border-2 border-black">
             <button onClick={()=>setSimSpeed('normal')} className={`game-button px-5 py-3 text-xs font-black transition-all ${simSpeed === 'normal' ? 'game-button-selected bg-black text-white' : 'text-gray-500 hover:text-white'}`}>NORMAL</button>
             <button onClick={()=>setSimSpeed('fast')} className={`game-button px-5 py-3 text-xs font-black transition-all ${simSpeed === 'fast' ? 'game-button-selected bg-black text-white' : 'text-gray-500 hover:text-white'}`}>HIZLI</button>
             <button onClick={()=>setSimSpeed('hyper')} className={`game-button px-5 py-3 text-xs font-black transition-all ${simSpeed === 'hyper' ? 'game-button-selected bg-black text-white' : 'text-gray-500 hover:text-white'}`}>HİPER</button>
          </div>

          {currentMatchMinute && <div className="bg-red-600 px-8 py-3 border-2 border-black shadow-[5px_5px_0px_0px_#000] font-mono font-black text-3xl">{currentMatchMinute}&apos;</div>}
        </div>

        <div className="space-y-8">
          {matches.filter(m => m.team1.isUser || m.team2.isUser).map((match) => (
            <div key={match.id} className="relative p-6 lg:p-8 border-4 border-black bg-black/5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 lg:gap-7">
                   <div className="min-w-0 text-left">
                     <span className="block text-xl lg:text-2xl font-black uppercase tracking-tighter italic leading-tight break-words">{match.team1.name}</span>
                   </div>
                   <div className="min-w-[8.5rem] lg:min-w-[10rem] text-center">
                     <span className="block whitespace-nowrap font-mono text-6xl lg:text-7xl font-black leading-none tracking-tighter">
                       {match.score1 ?? (currentMatchMinute ? liveScore.s1 : '-')}
                       <span className="mx-2 text-yellow-500">:</span>
                       {match.score2 ?? (currentMatchMinute ? liveScore.s2 : '-')}
                     </span>
                   </div>
                   <div className="min-w-0 text-right">
                     <span className="block text-xl lg:text-2xl font-black uppercase tracking-tighter italic leading-tight break-words">{match.team2.name}</span>
                   </div>
                </div>
            </div>
          ))}
        </div>

        {!champion && !isEliminated && (
          <button
            onClick={playRound}
            disabled={isSimulating}
            className="game-button game-button-major w-full border-4 border-black bg-yellow-500 px-6 py-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:bg-yellow-400 disabled:opacity-60 disabled:grayscale"
          >
            <span className="flex items-center justify-center gap-3 text-3xl lg:text-4xl font-black italic tracking-tighter">
              <Play size={32} fill="currentColor" />
              {isSimulating ? 'SİMÜLASYON...' : 'MAÇI BAŞLAT'}
            </span>
            <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.25em] opacity-55">
              {getRoundName()} / {simSpeed === 'hyper' ? 'Hiper Akış' : simSpeed === 'fast' ? 'Hızlı Akış' : 'Normal Akış'}
            </span>
          </button>
        )}

        {(champion || isEliminated) && (
           <div className="grid grid-cols-2 gap-6 mt-6">
              <button onClick={()=>setShowHeadlineOverlay(true)} className="game-button game-button-major py-6 bg-red-600 text-white font-black text-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">MANŞETLERİ AÇ</button>
              <button onClick={()=>setShowPitchPreview(true)} className="game-button game-button-major py-6 bg-blue-600 text-white font-black text-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all uppercase">Kadroyu Gör</button>
           </div>
        )}
      </div>

      {/* SAĞ PANEL: İSTATİSTİKLER VE ANLATIM */}
      <div className="w-full lg:w-96 flex flex-col gap-8">
         <div className="p-8 border-4 border-black bg-black/10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-black uppercase text-xs tracking-[0.2em] opacity-60 mb-8 flex items-center gap-3"><Activity size={20} /> MAÇ İSTATİSTİKLERİ</h3>
            
            <div className="flex justify-between items-center mb-10 border-b-2 border-black/10 pb-6">
               <div className="text-4xl font-black font-mono">{currentMatchMinute ? liveScore.s1 : (matches.find(m=>m.team1.isUser||m.team2.isUser)?.score1 ?? '-')}</div>
               <div className="text-xs font-black uppercase opacity-50 tracking-widest">SKOR</div>
               <div className="text-4xl font-black font-mono">{currentMatchMinute ? liveScore.s2 : (matches.find(m=>m.team1.isUser||m.team2.isUser)?.score2 ?? '-')}</div>
            </div>

            <div className="space-y-8">
               <div>
                  <div className="flex justify-between text-xs font-black uppercase mb-2"><span>{liveStats.possession}%</span><span>TOPLA OYNAMA</span><span>{100-liveStats.possession}%</span></div>
                  <div className="w-full h-3 bg-black/20 border-2 border-black flex">
                     <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${liveStats.possession}%` }}></div>
                     <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${100-liveStats.possession}%` }}></div>
                  </div>
               </div>
               <div className="flex justify-between items-center text-center">
                  <div className="w-1/3"><div className="text-4xl font-black">{liveStats.shots1}</div><div className="text-[10px] font-black opacity-50 mt-1">ŞUT</div></div>
                  <div className="w-1/3 border-x-2 border-black/10"><div className="text-2xl font-black text-blue-500">{liveStats.onTarget1}</div><div className="text-[9px] font-black opacity-50">İSABET</div></div>
                  <div className="w-1/3 border-r-2 border-black/10"><div className="text-2xl font-black text-red-500">{liveStats.onTarget2}</div><div className="text-[9px] font-black opacity-50">İSABET</div></div>
                  <div className="w-1/3"><div className="text-4xl font-black">{liveStats.shots2}</div><div className="text-[10px] font-black opacity-50 mt-1">ŞUT</div></div>
               </div>
            </div>
         </div>

         {matchReports[0] && (
           <div className="p-6 border-4 border-black bg-yellow-500 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-black uppercase text-xs tracking-[0.2em] opacity-70 mb-5 flex items-center gap-3">
                <FileText size={18} /> MAÇ RAPORU
              </h3>
              <div className="flex items-end justify-between gap-3 border-b-2 border-black/20 pb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{matchReports[0].result}</p>
                  <p className="text-2xl font-black italic leading-none mt-1">{matchReports[0].score}</p>
                  <p className="text-xs font-black opacity-70 mt-2">vs {matchReports[0].opponent}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">Maçın Adamı</p>
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

         <div className="flex-1 min-h-[450px] border-4 border-black bg-black/5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col">
            <h3 className="font-black uppercase text-xs tracking-[0.2em] opacity-60 mb-6 border-b-2 border-black/10 pb-4 flex items-center gap-3"><BellRing size={20} className="text-blue-500" /> CANLI ANLATIM</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
               {matchLogs.length === 0 ? <p className="text-center text-xs font-black opacity-20 mt-20 italic uppercase tracking-widest">Başlama vuruşu bekleniyor...</p> :
                 matchLogs.map((log, i) => (
                   <div key={i} className={`p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-right duration-300 ${log.type === 'goal' ? 'bg-yellow-400 text-black' : 'bg-white text-black'}`}>
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black bg-black text-white px-3 py-1">{log.minute}&apos;</span>
                         {log.type === 'goal' && <span className="text-xs font-black border-2 border-black px-3 py-0.5">{log.score}</span>}
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
