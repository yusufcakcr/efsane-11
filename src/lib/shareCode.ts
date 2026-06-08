import { FormationType } from './formations';
import type { MentalityType } from '@/store/useTeamStore';

export interface SharedTeamSnapshot {
  version: 1;
  formation: FormationType;
  mentality: MentalityType;
  blindMode: boolean;
  captainId: string | null;
  squadName?: string;
  playerIds: (string | null)[];
}

const normalizeBase64 = (value: string) => {
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  return base.padEnd(base.length + ((4 - (base.length % 4)) % 4), '=');
};

export const encodeShareCode = (snapshot: SharedTeamSnapshot): string => {
  const json = JSON.stringify(snapshot);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const decodeShareCode = (code: string): SharedTeamSnapshot | null => {
  try {
    const decoded = JSON.parse(atob(normalizeBase64(code))) as Partial<SharedTeamSnapshot>;
    if (
      decoded.version !== 1 ||
      !decoded.formation ||
      !decoded.mentality ||
      !Array.isArray(decoded.playerIds)
    ) {
      return null;
    }

    return {
      version: 1,
      formation: decoded.formation,
      mentality: decoded.mentality,
      blindMode: Boolean(decoded.blindMode),
      captainId: decoded.captainId ?? null,
      squadName: typeof decoded.squadName === 'string' ? decoded.squadName.slice(0, 32) : 'Efsane 11',
      playerIds: decoded.playerIds.slice(0, 11).concat(Array(11).fill(null)).slice(0, 11),
    };
  } catch {
    return null;
  }
};
