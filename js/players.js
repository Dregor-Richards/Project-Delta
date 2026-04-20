export const players = [
    {
        id: 1,
        name: 'Player 1',
        faction: 'Foldari',
        isHuman: true,
        // later: color, team, difficulty, etc.
    },
    {
        id: 2,
        name: 'AI 1',
        faction: 'Foldari',   // placeholder; later maybe Malachordith
        isHuman: false,
    },
    {
        id: 3,
        name: 'AI 2',
        faction: 'Malachordith',
        isHuman: false,
    },
    {
        id: 4,
        name: 'AI 3',
        faction: 'Shiervale',
        isHuman: false,
    },
];

export function getPlayerById(id) {
    return players.find((p) => p.id === id) || null;
}