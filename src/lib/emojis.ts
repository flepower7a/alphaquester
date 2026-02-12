// Emoji/icon mapping for quest types and UI elements
// All paths reference the discord-quests-bot emojis folder

const EMOJI_BASE = "/discord-quests-bot-0.6/emojis";

export const questTypeIcons: Record<string, string> = {
  PLAY_ON_DESKTOP: `${EMOJI_BASE}/PLAY_ON_DESKTOP.png`,
  PLAY_ON_PLAYSTATION: `${EMOJI_BASE}/PLAY_ON_PLAYSTATION.png`,
  PLAY_ON_XBOX: `${EMOJI_BASE}/PLAY_ON_XBOX.png`,
  STREAM_ON_DESKTOP: `${EMOJI_BASE}/STREAM_ON_DESKTOP.png`,
  WATCH_VIDEO: `${EMOJI_BASE}/WATCH_VIDEO.png`,
  WATCH_VIDEO_ON_MOBILE: `${EMOJI_BASE}/WATCH_VIDEO.png`,
  PLAY_ACTIVITY: `${EMOJI_BASE}/PLAY_ON_DESKTOP.png`,
};

export const statusIcons = {
  success: `${EMOJI_BASE}/success.png`,
  fail: `${EMOJI_BASE}/fail.png`,
  check: `${EMOJI_BASE}/check.png`,
  loading: `${EMOJI_BASE}/loading.gif`,
  online: `${EMOJI_BASE}/online.gif`,
  offline: `${EMOJI_BASE}/offline.gif`,
  start: `${EMOJI_BASE}/start.png`,
  stop: `${EMOJI_BASE}/stop.png`,
  enroll: `${EMOJI_BASE}/enroll.png`,
  claim: `${EMOJI_BASE}/claim.png`,
  expire: `${EMOJI_BASE}/expire.png`,
  quest: `${EMOJI_BASE}/quest.png`,
  orbIcon: `${EMOJI_BASE}/orbIcon.png`,
  coins: `${EMOJI_BASE}/coins.gif`,
  timer: `${EMOJI_BASE}/timer.gif`,
  time: `${EMOJI_BASE}/time.gif`,
  discord: `${EMOJI_BASE}/discord.png`,
  speed: `${EMOJI_BASE}/speed.png`,
  password: `${EMOJI_BASE}/password.gif`,
  suspended: `${EMOJI_BASE}/suspended.png`,
  notsupported: `${EMOJI_BASE}/notsupported.png`,
  pc: `${EMOJI_BASE}/pc.gif`,
  phone: `${EMOJI_BASE}/phone.gif`,
  log: `${EMOJI_BASE}/log.png`,
  messages: `${EMOJI_BASE}/messages.gif`,
  customer: `${EMOJI_BASE}/customer.gif`,
};

export const boostLevelImages: Record<number, string> = {
  1: `${EMOJI_BASE}/boost_level_1.png`,
  2: `${EMOJI_BASE}/boost_level_2.png`,
  3: `${EMOJI_BASE}/boost_level_3.png`,
  4: `${EMOJI_BASE}/boost_level_4.png`,
  5: `${EMOJI_BASE}/boost_level_5.png`,
  6: `${EMOJI_BASE}/boost_level_6.png`,
  7: `${EMOJI_BASE}/boost_level_7.png`,
  8: `${EMOJI_BASE}/boost_level_8.png`,
  9: `${EMOJI_BASE}/boost_level_9.png`,
};

export const boostLevels = [
  { level: 1, months: 0 },
  { level: 2, months: 2 },
  { level: 3, months: 3 },
  { level: 4, months: 6 },
  { level: 5, months: 9 },
  { level: 6, months: 12 },
  { level: 7, months: 15 },
  { level: 8, months: 18 },
  { level: 9, months: 24 },
];

export function getBoostLevel(months: number): number {
  const sorted = [...boostLevels].sort((a, b) => b.months - a.months);
  const level = sorted.find((l) => l.months <= months);
  return level?.level || 1;
}

export function getBoostImage(months: number): string {
  return boostLevelImages[getBoostLevel(months)] || boostLevelImages[1];
}

export function getQuestTypeIcon(taskId: string): string | null {
  return questTypeIcons[taskId] || null;
}

export function getRewardIcon(rewardName: string): string | null {
  if (!rewardName) return null;
  const lower = rewardName.toLowerCase();
  if (lower.includes("orb")) return statusIcons.orbIcon;
  if (lower.includes("coin")) return statusIcons.coins;
  return null;
}
