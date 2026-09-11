export type ParentalCategory =
  | 'Social Media'
  | 'Gaming'
  | 'Adult Content'
  | 'Streaming'
  | 'Gambling'
  | 'Custom';

export type FilteringScope = 'all' | 'specific' | 'multiple';

export interface CategoryPresetInfo {
  category: ParentalCategory;
  displayName: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  domains: string[];
}

export const CATEGORY_PRESETS: Record<ParentalCategory, CategoryPresetInfo> = {
  'Social Media': {
    category: 'Social Media',
    displayName: 'Social Media & Networks',
    description: 'Social networking sites, feeds, short video apps, and microblogs',
    color: '#0284C7',
    badgeBg: 'bg-sky-950/80 border-sky-700/60',
    badgeText: 'text-sky-300',
    domains: [
      'facebook.com',
      'www.facebook.com',
      'instagram.com',
      'www.instagram.com',
      'tiktok.com',
      'www.tiktok.com',
      'x.com',
      'twitter.com',
      'snapchat.com',
      'reddit.com',
      'pinterest.com',
      'linkedin.com',
      'threads.net',
      't.co',
    ],
  },
  'Gaming': {
    category: 'Gaming',
    displayName: 'Gaming & Online Platforms',
    description: 'Online games, game launchers, download clients, and community portals',
    color: '#8B5CF6',
    badgeBg: 'bg-purple-950/80 border-purple-700/60',
    badgeText: 'text-purple-300',
    domains: [
      'steamcommunity.com',
      'steampowered.com',
      'epicgames.com',
      'roblox.com',
      'riotgames.com',
      'blizzard.com',
      'battlenet.com',
      'ea.com',
      'origin.com',
      'playstation.com',
      'xbox.com',
      'discord.com',
      'discordapp.com',
    ],
  },
  'Adult Content': {
    category: 'Adult Content',
    displayName: 'Adult & Explicit Content',
    description: 'Adult material, mature media, and adult entertainment domains',
    color: '#E11D48',
    badgeBg: 'bg-rose-950/80 border-rose-700/60',
    badgeText: 'text-rose-300',
    domains: [
      'pornhub.com',
      'xvideos.com',
      'adultfriendfinder.com',
      'onlyfans.com',
      'chaturbate.com',
      'redtube.com',
      'youporn.com',
      'xhamster.com',
      'livejasmin.com',
    ],
  },
  'Streaming': {
    category: 'Streaming',
    displayName: 'Video & Media Streaming',
    description: 'High-bandwidth streaming services, online television, and video portals',
    color: '#F59E0B',
    badgeBg: 'bg-amber-950/80 border-amber-700/60',
    badgeText: 'text-amber-300',
    domains: [
      'netflix.com',
      'youtube.com',
      'googlevideo.com',
      'youtu.be',
      'twitch.tv',
      'hulu.com',
      'disneyplus.com',
      'primevideo.com',
      'dailymotion.com',
      'vimeo.com',
      'max.com',
      'crunchyroll.com',
    ],
  },
  'Gambling': {
    category: 'Gambling',
    displayName: 'Gambling & Betting Sites',
    description: 'Online casinos, sports betting, lottery, and real-money gaming portals',
    color: '#EF4444',
    badgeBg: 'bg-red-950/80 border-red-700/60',
    badgeText: 'text-red-300',
    domains: [
      'bet365.com',
      'pokerstars.com',
      '888casino.com',
      'bovada.lv',
      'draftkings.com',
      'fanduel.com',
      'stake.com',
      'betfair.com',
      'williamhill.com',
      'roobet.com',
    ],
  },
  'Custom': {
    category: 'Custom',
    displayName: 'Custom Category',
    description: 'User-specified category and domain definitions',
    color: '#10B981',
    badgeBg: 'bg-emerald-950/80 border-emerald-700/60',
    badgeText: 'text-emerald-300',
    domains: [],
  },
};

export interface ParentalRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  scope: FilteringScope; // 'all' (all IPs on router) | 'specific' | 'multiple'
  targetIps: string[];   // Empty when scope === 'all'
  categories: ParentalCategory[];
  customDomains: string[];
  customCategoryName?: string;
  action: 'block' | 'redirect';
  redirectIp?: string;
  createdAt: string;     // ISO String
  updatedAt: string;     // ISO String
  blockedCount: number;
}

export interface BlockedActivityRecord {
  id: string;
  timestamp: string;      // Date and time of the initial blocked attempt
  ip: string;             // Client IP address
  hostname?: string;      // Hostname or device name if known
  mac?: string;           // MAC address if known
  requestedDomain: string;// Domain that was intercepted
  blockedCategory: string;// Category triggered
  ruleId?: string;        // Specific rule ID matched
  ruleName?: string;      // Friendly rule name
  attemptCount: number;   // Number of blocked attempts aggregated
  lastAttempt: string;    // Date and time of the most recent blocked attempt
}

export interface ParentalDatabase {
  globalFilterEnabled: boolean;
  rules: ParentalRule[];
  activityLog: BlockedActivityRecord[];
  enforcementMethod: 'dnsmasq' | 'iptables' | 'router_api' | 'mikrotik' | 'hosts';
  lastAppliedTimestamp?: number;
  lastAppliedStatus?: 'success' | 'error' | 'pending';
  lastAppliedMessage?: string;
}
