export type Position = 'KL' | 'STP' | 'SLB' | 'SĞB' | 'MO' | 'SLK' | 'SĞK' | 'SF';

export interface Player {
  id: string;
  name: string;
  era: string;
  position: Position;
  secondary_position?: Position;
  overall_rating: number;
  image_url: string;
  jersey_number: number;
}

export interface Squad {
  id: string;
  teamName: string;
  year: string;
  players: Player[];
}