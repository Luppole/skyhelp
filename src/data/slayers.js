// Slayer efficiency static data

export const SLAYERS = [
  {
    id: 'zombie',
    name: 'Revenant Horror',
    icon: '🧟',
    color: 'var(--green)',
    tiers: [
      { level: 1, hp: '500', xp: 5,     costCoins: 2_000,    avgDropValue: 3_500,    avgTimeSec: 45,  drops: ['Rotten Flesh', 'Revenant Flesh'] },
      { level: 2, hp: '20K', xp: 15,    costCoins: 10_000,   avgDropValue: 14_000,   avgTimeSec: 90,  drops: ['Foul Flesh', 'Snake Skin'] },
      { level: 3, hp: '400K',xp: 200,   costCoins: 45_000,   avgDropValue: 90_000,   avgTimeSec: 180, drops: ['Scythe Blade', 'Vile Sword (rare)'] },
      { level: 4, hp: '3M',  xp: 2000,  costCoins: 200_000,  avgDropValue: 500_000,  avgTimeSec: 300, drops: ['Beheaded Horror', 'Smite VI/VII', 'Revenant Catalyst'] },
    ],
  },
  {
    id: 'spider',
    name: 'Tarantula Broodfather',
    icon: '🕷️',
    color: 'var(--purple)',
    tiers: [
      { level: 1, hp: '2K',   xp: 5,    costCoins: 1_500,    avgDropValue: 3_000,    avgTimeSec: 40,  drops: ['String', 'Spider Eye'] },
      { level: 2, hp: '40K',  xp: 25,   costCoins: 8_000,    avgDropValue: 18_000,   avgTimeSec: 90,  drops: ['Fly Swatter', 'Bane of Arthropods VI'] },
      { level: 3, hp: '500K', xp: 200,  costCoins: 35_000,   avgDropValue: 80_000,   avgTimeSec: 200, drops: ['Tarantula Web', 'Toxic Arrow Poison'] },
      { level: 4, hp: '5M',   xp: 2000, costCoins: 150_000,  avgDropValue: 400_000,  avgTimeSec: 360, drops: ['Tarantula Talisman', 'Spider Catalyst', 'Overflux Orb (rare)'] },
    ],
  },
  {
    id: 'wolf',
    name: 'Sven Packmaster',
    icon: '🐺',
    color: 'var(--blue)',
    tiers: [
      { level: 1, hp: '2K',   xp: 10,   costCoins: 3_000,    avgDropValue: 5_000,    avgTimeSec: 50,  drops: ['Wolf Tooth', 'Hamster Wheel'] },
      { level: 2, hp: '60K',  xp: 50,   costCoins: 18_000,   avgDropValue: 30_000,   avgTimeSec: 100, drops: ['Critical VI book', 'Furball'] },
      { level: 3, hp: '1M',   xp: 500,  costCoins: 70_000,   avgDropValue: 150_000,  avgTimeSec: 240, drops: ['Wolf Paw', 'Paw of Sven (accessory)'] },
      { level: 4, hp: '10M',  xp: 5000, costCoins: 280_000,  avgDropValue: 700_000,  avgTimeSec: 480, drops: ['Wolf Talisman', 'Overflux Power Orb (rare)', 'Silex (rare)'] },
    ],
  },
  {
    id: 'enderman',
    name: 'Voidgloom Seraph',
    icon: '👾',
    color: 'var(--purple)',
    tiers: [
      { level: 1, hp: '2K',   xp: 10,   costCoins: 4_000,    avgDropValue: 8_000,    avgTimeSec: 60,  drops: ['Ender Pearl', 'Null Sphere'] },
      { level: 2, hp: '50K',  xp: 60,   costCoins: 25_000,   avgDropValue: 45_000,   avgTimeSec: 120, drops: ['Null Atom', 'Bane VII book'] },
      { level: 3, hp: '600K', xp: 600,  costCoins: 80_000,   avgDropValue: 200_000,  avgTimeSec: 270, drops: ['Summoning Eye', 'Null Ovoid'] },
      { level: 4, hp: '5M',   xp: 6000, costCoins: 320_000,  avgDropValue: 900_000,  avgTimeSec: 480, drops: ['Null Atom', 'Judgement Core (rare)', 'Summoning Eye (boosted)'] },
    ],
  },
  {
    id: 'blaze',
    name: 'Inferno Demonlord',
    icon: '🔥',
    color: 'var(--red)',
    tiers: [
      { level: 1, hp: '1.5K', xp: 10,   costCoins: 2_000,    avgDropValue: 6_000,    avgTimeSec: 40,  drops: ['Blaze Rod', 'Scorched Books'] },
      { level: 2, hp: '30K',  xp: 50,   costCoins: 12_000,   avgDropValue: 30_000,   avgTimeSec: 90,  drops: ['Mana Disintegrator', 'Fire Veil Wand'] },
      { level: 3, hp: '250K', xp: 500,  costCoins: 55_000,   avgDropValue: 150_000,  avgTimeSec: 240, drops: ['Scorched Books', 'Subzero Inverter'] },
      { level: 4, hp: '2M',   xp: 5000, costCoins: 220_000,  avgDropValue: 600_000,  avgTimeSec: 420, drops: ['Mana Disintegrator', 'Kuudra Mandible (rare)', 'Soul Eater enchant'] },
    ],
  },
  {
    id: 'vampire',
    name: 'Riftstalker Bloodfiend',
    icon: '🧛',
    color: 'var(--red)',
    tiers: [
      { level: 1, hp: '1K',   xp: 10,   costCoins: 2_000,    avgDropValue: 5_000,    avgTimeSec: 45,  drops: ['Vampire Fang', 'Blood Ichor'] },
      { level: 2, hp: '20K',  xp: 60,   costCoins: 10_000,   avgDropValue: 25_000,   avgTimeSec: 90,  drops: ['Blood Ichor', 'Hemolytic Books'] },
      { level: 3, hp: '200K', xp: 600,  costCoins: 50_000,   avgDropValue: 120_000,  avgTimeSec: 210, drops: ['Rift Prism', 'Hemolytic Sword'] },
      { level: 4, hp: '2M',   xp: 6000, costCoins: 200_000,  avgDropValue: 500_000,  avgTimeSec: 360, drops: ['Rift Core', 'Sanguine Boots (rare)', 'Zenith (very rare)'] },
      { level: 5, hp: '20M',  xp:10000, costCoins: 600_000,  avgDropValue: 1_500_000,avgTimeSec: 600, drops: ['Zenith (boosted)', 'Sanguine Set (rare)', 'Mosquito Bow (rare)'] },
    ],
  },
];

export function calcSlayerProfit(slayer, tierIndex) {
  const tier = slayer.tiers[tierIndex];
  if (!tier) return null;
  const profit = tier.avgDropValue - tier.costCoins;
  const coinsPerHour = profit / (tier.avgTimeSec / 3600);
  const xpPerHour = tier.xp / (tier.avgTimeSec / 3600);
  return {
    profit,
    coinsPerHour: Math.round(coinsPerHour),
    xpPerHour: Math.round(xpPerHour),
    roi: Math.round((profit / tier.costCoins) * 100),
    runsPerHour: Math.round(3600 / tier.avgTimeSec * 10) / 10,
  };
}
