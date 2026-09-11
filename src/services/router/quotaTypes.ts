export interface RouterQuotaConfig {
  totalQuotaGB: number;
  validityPeriodDays: number;
  warningThresholds: {
    warn80: boolean;
    alert90: boolean;
    limit100: boolean;
  };
  autoEnforceRestriction: boolean;
  notifyOnThreshold: boolean;
}

export interface QuotaCycle {
  id: string;
  cycleNumber: number;
  startDate: string;        // ISO 8601 string
  expirationDate: string;   // ISO 8601 string (startDate + validityPeriodDays)
  validityPeriodDays: number;
  totalQuotaGB: number;
  usedDataGB: number;
  remainingDataGB: number;
  usagePercent: number;
  isExpired: boolean;       // Past expiration date, but NOT auto-reset
  isExhausted: boolean;     // used >= total
  resetDate: string | null; // Set when manually reset
}

export interface ConnectedIPQuota {
  id: string;
  ip: string;
  mac: string;
  hostname: string;
  isOnline: boolean;
  connectionType: '2.4GHz' | '5.0GHz' | 'Ethernet' | 'Guest' | 'Wi-Fi';
  usedDataGB: number;
  quotaLimitGB: number | null; // null = unlimited (draws from router pool)
  remainingDataGB: number | null;
  usagePercent: number;
  isBlocked: boolean;          // Internet access restriction enforced
  isExhausted: boolean;        // Exceeded individual limit
  bandwidthRateKBps?: number;
  lastActive: string;
}

export interface GuestWifiQuota {
  ssid: string;
  enabled: boolean;
  quotaLimitGB: number;        // Max GB configured
  usedDataGB: number;
  remainingDataGB: number;
  usagePercent: number;
  isExhausted: boolean;
  isEnforced: boolean;         // Internet restricted when limit reached
}

export interface DeviceHistoricalUsage {
  ip: string;
  mac: string;
  hostname: string;
  usedDataGB: number;
  quotaLimitGB: number | null;
}

export interface QuotaHistoricalRecord {
  cycleId: string;
  cycleNumber: number;
  startDate: string;
  resetDate: string;
  validityPeriodDays: number;
  totalQuotaGB: number;
  finalUsedGB: number;
  finalRemainingGB: number;
  usagePercent: number;
  guestUsedGB: number;
  connectedDevicesCount: number;
  deviceUsages: DeviceHistoricalUsage[];
  notes?: string;
}

export interface QuotaWarningAlert {
  id: string;
  level: '80%' | '90%' | '100%';
  message: string;
  timestamp: string;
  dismissed: boolean;
  target: 'router' | 'ip' | 'guest';
  targetIdentifier?: string;
}

export interface RouterQuotaDatabase {
  config: RouterQuotaConfig;
  activeCycle: QuotaCycle;
  connectedDevices: ConnectedIPQuota[];
  guestWifi: GuestWifiQuota;
  history: QuotaHistoricalRecord[];
  activeWarnings: QuotaWarningAlert[];
  internetRestricted: boolean;
  lastSyncTimestamp: number;
  accumulatedRxBytes: number;
  accumulatedTxBytes: number;
  rawBaselineRx: number;
  rawBaselineTx: number;
}
