import { NextResponse } from 'next/server';
import { Player } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamRating, players } = body as { teamRating: number, players: Player[] };

    const opponentRating = 80;
    const diff = teamRating - opponentRating;

    let userGoals = Math.floor(Math.random() * 4);
    let oppGoals = Math.floor(Math.random() * 3);

    if (diff > 5) userGoals += Math.floor(Math.random() * 2) + 1;
    else if (diff < -5) oppGoals += Math.floor(Math.random() * 2) + 1;
    else if (diff > 0) userGoals += 1;

    const validPlayers = players.filter(p => p !== null);
    const sortedPlayers = validPlayers.sort((a, b) => b.overall_rating - a.overall_rating);
    const top3 = sortedPlayers.slice(0, 3);
    const motm = top3[Math.floor(Math.random() * top3.length)];

    return NextResponse.json({
      userScore: userGoals,
      opponentScore: oppGoals,
      motm: motm,
    });
  } catch {
    return NextResponse.json({ error: 'Simülasyon sırasında hata oluştu' }, { status: 500 });
  }
}
