export type EnemyKind = 'thief' | 'sentinel' | 'bomber';
export type Supply = 'save' | 'shield' | 'repair' | 'arsenal';
export const SUPPLIES: {
  kind: Supply;
  title: string;
  detail: string;
  cost: number;
}[] = [
  {
    kind: 'save',
    title: 'Save salvage',
    detail: 'Bank this sector’s salvage for a later upgrade.',
    cost: 0,
  },
  {
    kind: 'shield',
    title: 'Safety net',
    detail: 'One floor shield for the next sector.',
    cost: 1,
  },
  {
    kind: 'repair',
    title: 'Hull repair',
    detail: 'Recover one life. Available when your hull is damaged.',
    cost: 2,
  },
  {
    kind: 'arsenal',
    title: 'Hot start',
    detail: 'Three twin-laser bursts and eight seconds of wide paddle.',
    cost: 2,
  },
];
export const ENEMIES = {
  thief: { label: 'Raider', color: 0xf864a1, hp: 1 },
  sentinel: { label: 'Sentinel', color: 0x987bff, hp: 2 },
  bomber: { label: 'Bomber', color: 0xffa14d, hp: 1 },
};
type Sector = {
  name: string;
  hint: string;
  enemies: EnemyKind[];
  pattern: (r: number, c: number) => boolean;
  guardian?: { name: string; hp: number };
};
export const CAMPAIGN: Sector[] = [
  {
    name: 'The glass garden',
    hint: 'Aim for gold cache bricks to earn rare specials. Pink raiders steal them.',
    enemies: ['thief'],
    pattern: () => true,
  },
  {
    name: 'Prism cascade',
    hint: 'Violet sentinels take two hits. Pierce slips through armor.',
    enemies: ['thief', 'sentinel'],
    pattern: (r, c) => (r + c) % 5 !== 0,
  },
  {
    name: 'Orbital bloom',
    hint: 'Green cores regrow once. Pierce seals them; finish the grid before they return.',
    enemies: ['bomber', 'thief'],
    pattern: (r, c) => Math.abs(c - 5) <= r + 2,
  },
  {
    name: 'The prism warden',
    hint: 'Clear the warden and its grid. Its rings flash before a volley.',
    enemies: ['sentinel', 'thief'],
    pattern: (r, c) => r >= 2 && (r + c) % 4 !== 0,
    guardian: { name: 'The prism warden', hp: 16 },
  },
  {
    name: 'Crystal current',
    hint: 'A new chapter. Capsule magnet draws supplies into reach.',
    enemies: ['thief', 'bomber'],
    pattern: (r, c) => (r + c) % 4 !== 0,
  },
  {
    name: 'Twin helix',
    hint: 'Open a path through the twin strands and their armored cores.',
    enemies: ['sentinel', 'bomber'],
    pattern: (r, c) =>
      Math.abs(c - (2 + Math.round(Math.sin(r * 0.8) * 2))) <= 1 ||
      Math.abs(c - (8 - Math.round(Math.sin(r * 0.8) * 2))) <= 1,
  },
  {
    name: 'Nova orchard',
    hint: 'Glowing bricks trigger chain reactions. Aim for the clusters.',
    enemies: ['thief', 'sentinel', 'bomber'],
    pattern: (r, c) => r % 3 !== 2 && c % 4 !== 3,
  },
  {
    name: 'The solar architect',
    hint: 'The architect fires wider volleys below half health.',
    enemies: ['bomber', 'sentinel'],
    pattern: (r, c) => r >= 2 && (c < 3 || c > 7 || r > 5),
    guardian: { name: 'The solar architect', hp: 24 },
  },
  {
    name: 'Infinity bridge',
    hint: 'Keep your escape routes open. Freeze pauses every enemy and bomb.',
    enemies: ['sentinel', 'thief', 'bomber'],
    pattern: (r, c) =>
      r === 0 || r === 8 || Math.abs(c - 5) === Math.abs(r - 4) || c === 5,
  },
  {
    name: 'Aurora vault',
    hint: 'Three-hit vault armor and two-cycle regrowth. Save piercing shots for green cores.',
    enemies: ['sentinel', 'bomber', 'thief'],
    pattern: (r, c) =>
      r === 0 ||
      r === 8 ||
      c === 0 ||
      c === 10 ||
      (r > 2 && r < 6 && c > 2 && c < 8),
  },
  {
    name: 'Celestial weave',
    hint: 'All three enemy crews are active. Save a pulse for the swarm.',
    enemies: ['bomber', 'sentinel', 'thief'],
    pattern: (r, c) => (r + c) % 3 !== 0 && (r - c + 12) % 4 !== 0,
  },
  {
    name: 'The light keeper',
    hint: 'Restore the final guardian. Pulse clears its bombs as well as raiders.',
    enemies: ['sentinel', 'bomber', 'thief'],
    pattern: (r, c) => r >= 2 && (r > 5 || c < 3 || c > 7 || c === 5),
    guardian: { name: 'The light keeper', hp: 32 },
  },
];
export const SECTORS = CAMPAIGN.map((s) => s.name);
