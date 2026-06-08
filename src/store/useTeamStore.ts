import { create } from 'zustand';
import { Player, Squad } from '../types';
import { mockSquads } from '../lib/mockData';
import { FormationType } from '../lib/formations';
import { getCaptainBonus } from '../lib/captain';

export type ThemeType = 'dark' | 'light';
export type MentalityType = 'Gegenpress' | 'ParkTheBus' | 'Balanced';

interface TeamState {
  theme: ThemeType;
  toggleTheme: () => void;

  formation: FormationType | null;
  mentality: MentalityType | null;
  blindMode: boolean;
  setSetup: (f: FormationType, m: MentalityType, b: boolean) => void;
  squadName: string;
  setSquadName: (name: string) => void;

  selectedPlayers: (Player | null)[];
  teamRating: number;
  captainId: string | null;
  setCaptain: (playerId: string | null) => void;
  activePlayerToPlace: Player | null;
  sourceSlotIndex: number | null;
  setActivePlayerToPlace: (player: Player | null, sourceIndex?: number | null) => void;
  placePlayer: (player: Player, targetIndex: number) => void;
  removePlayer: (slotIndex: number) => void;
  
  rolledSquad: Squad | null;
  lastRolledSquadId: string | null;
  rollSquad: () => void;
  rollTeam: () => void;
  rollYear: () => void;
  clearRolledSquad: () => void;

  needsNextRoll: boolean;
  setNeedsNextRoll: (val: boolean) => void;
  autoRoll: boolean;
  toggleAutoRoll: () => void;

  rerollsLeft: number;
  loadSharedTeam: (payload: {
    formation: FormationType;
    mentality: MentalityType;
    blindMode: boolean;
    captainId: string | null;
    squadName?: string;
    playerIds: (string | null)[];
  }) => void;
}

const allPlayers = mockSquads.flatMap((squad) => squad.players);

const calculateTeamRating = (players: (Player | null)[], captainId: string | null = null): number => {
  const validPlayers = players.filter((p): p is Player => p !== null);
  if (validPlayers.length === 0) return 0;
  
  const totalRating = validPlayers.reduce((acc, player) => acc + player.overall_rating, 0);
  const baseRating = Math.round(totalRating / validPlayers.length);
  const captain = validPlayers.find((player) => player.id === captainId);
  return Math.min(99, baseRating + getCaptainBonus(captain));
};

const resolvePlayerIds = (playerIds: (string | null)[]): (Player | null)[] => {
  return playerIds
    .slice(0, 11)
    .concat(Array(11).fill(null))
    .slice(0, 11)
    .map((id) => (id ? allPlayers.find((player) => player.id === id) ?? null : null));
};

export const useTeamStore = create<TeamState>((set) => ({
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  formation: null,
  mentality: null,
  blindMode: false,
  squadName: 'Efsane 11',
  setSquadName: (name) => set({ squadName: name.slice(0, 32) }),
  setSetup: (f, m, b) => set({ 
    formation: f, 
    mentality: m,
    blindMode: b,
    selectedPlayers: Array(11).fill(null), 
    rolledSquad: null, 
    lastRolledSquadId: null,
    activePlayerToPlace: null,
    sourceSlotIndex: null,
    captainId: null,
    teamRating: 0,
    rerollsLeft: 3
  }),

  selectedPlayers: Array(11).fill(null),
  teamRating: 0,
  captainId: null,
  setCaptain: (playerId) => set((state) => {
    const validCaptain = playerId && state.selectedPlayers.some((player) => player?.id === playerId);
    const captainId = validCaptain ? playerId : null;
    return {
      captainId,
      teamRating: calculateTeamRating(state.selectedPlayers, captainId),
    };
  }),
  activePlayerToPlace: null,
  sourceSlotIndex: null,
  rolledSquad: null,
  lastRolledSquadId: null,
  
  needsNextRoll: false,
  setNeedsNextRoll: (val) => set({ needsNextRoll: val }),
  autoRoll: false,
  toggleAutoRoll: () => set((state) => ({ autoRoll: !state.autoRoll })),
  
  rerollsLeft: 3,

  loadSharedTeam: (payload) => set(() => {
    const selectedPlayers = resolvePlayerIds(payload.playerIds);
    const validCaptain = payload.captainId && selectedPlayers.some((player) => player?.id === payload.captainId);
    const captainId = validCaptain ? payload.captainId : null;

    return {
      formation: payload.formation,
      mentality: payload.mentality,
      blindMode: payload.blindMode,
      squadName: payload.squadName?.slice(0, 32) || 'Efsane 11',
      selectedPlayers,
      teamRating: calculateTeamRating(selectedPlayers, captainId),
      captainId,
      rolledSquad: null,
      lastRolledSquadId: null,
      activePlayerToPlace: null,
      sourceSlotIndex: null,
      rerollsLeft: 3,
      needsNextRoll: false,
    };
  }),

  rollSquad: () => set((state) => {
    if (state.selectedPlayers.filter((player) => player !== null).length === 11) return {};

    let availableSquads = mockSquads.filter(s => s.id !== state.rolledSquad?.id && s.id !== state.lastRolledSquadId);
    if (availableSquads.length === 0) availableSquads = mockSquads;
    const randomSquad = availableSquads[Math.floor(Math.random() * availableSquads.length)];
    return { rolledSquad: randomSquad, lastRolledSquadId: randomSquad.id, activePlayerToPlace: null, sourceSlotIndex: null };
  }),

  rollTeam: () => set((state) => {
    if (state.selectedPlayers.filter((player) => player !== null).length === 11) return {};
    if (state.rerollsLeft <= 0) return {};

    const otherTeams = mockSquads.filter(s => s.teamName !== state.rolledSquad?.teamName);
    const randomSquad = otherTeams[Math.floor(Math.random() * otherTeams.length)];
    return { rolledSquad: randomSquad, lastRolledSquadId: randomSquad.id, activePlayerToPlace: null, sourceSlotIndex: null, rerollsLeft: state.rerollsLeft - 1 };
  }),

  rollYear: () => set((state) => {
    if (state.selectedPlayers.filter((player) => player !== null).length === 11) return {};
    if (state.rerollsLeft <= 0 || !state.rolledSquad) return {};

    const otherYears = mockSquads.filter(s => s.teamName === state.rolledSquad!.teamName && s.id !== state.rolledSquad!.id);
    if (otherYears.length > 0) {
      const randomSquad = otherYears[Math.floor(Math.random() * otherYears.length)];
      return { rolledSquad: randomSquad, lastRolledSquadId: randomSquad.id, activePlayerToPlace: null, sourceSlotIndex: null, rerollsLeft: state.rerollsLeft - 1 };
    }
    return {};
  }),

  clearRolledSquad: () => set({ rolledSquad: null, activePlayerToPlace: null, sourceSlotIndex: null }),
  
  setActivePlayerToPlace: (player, sourceIndex = null) => set({ activePlayerToPlace: player, sourceSlotIndex: sourceIndex }),
  
  placePlayer: (player, targetIndex) => set((state) => {
    const newPlayers = [...state.selectedPlayers];
    const sourceIdx = state.sourceSlotIndex;

    // 1. DURUM: Draft Listesinden geliyor
    if (sourceIdx === null) {
      if (newPlayers[targetIndex] !== null) return state;
      newPlayers[targetIndex] = player;
      const isTeamFull = newPlayers.filter(p => p !== null).length === 11;
      return { 
        selectedPlayers: newPlayers, 
        teamRating: calculateTeamRating(newPlayers, state.captainId),
        activePlayerToPlace: null,
        sourceSlotIndex: null,
        rolledSquad: null,
        needsNextRoll: state.autoRoll && !isTeamFull
      };
    }

    // 2. DURUM: Sahadan geliyor (Move/Swap)
    if (sourceIdx === targetIndex) return { activePlayerToPlace: null, sourceSlotIndex: null };

    const playerAtTarget = newPlayers[targetIndex];
    if (!playerAtTarget) {
      // MOVE
      newPlayers[targetIndex] = player;
      newPlayers[sourceIdx] = null;
    } else {
      // SWAP
      newPlayers[targetIndex] = player;
      newPlayers[sourceIdx] = playerAtTarget;
    }

    return {
      selectedPlayers: newPlayers,
      teamRating: calculateTeamRating(newPlayers, state.captainId),
      activePlayerToPlace: null,
      sourceSlotIndex: null
    };
  }),

  removePlayer: (slotIndex) => set((state) => {
    const newPlayers = [...state.selectedPlayers];
    newPlayers[slotIndex] = null;
    const captainId = state.captainId && newPlayers.some((player) => player?.id === state.captainId) ? state.captainId : null;
    return {
      selectedPlayers: newPlayers,
      captainId,
      teamRating: calculateTeamRating(newPlayers, captainId),
    };
  }),
}));
