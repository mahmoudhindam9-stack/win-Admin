import {
  RouterQuotaConfig,
  QuotaCycle,
  ConnectedIPQuota,
  GuestWifiQuota,
  QuotaHistoricalRecord,
  QuotaWarningAlert,
  RouterQuotaDatabase,
} from './quotaTypes';

const STORAGE_KEY = 'router_quota_management_v4_live';

const DEFAULT_CONFIG: RouterQuotaConfig = {
  totalQuotaGB: 250,
  validityPeriodDays: 30,
  warningThresholds: {
    warn80: true,
    alert90: true,
    limit100: true,
  },
  autoEnforceRestriction: true,
  notifyOnThreshold: true,
};

const KNOWN_MOCK_NAMES = [
  'Workstation-Primary-PC',
  'Galaxy-S24-Ultra',
  'Smart-4K-LivingRoom-TV',
  'iPad-Air-Design',
  'Security-Cam-FrontDoor',
];

const KNOWN_MOCK_IDS = ['dev_1', 'dev_2', 'dev_3', 'dev_4', 'dev_5'];

function isMockDevice(dev: { id?: string; hostname?: string; mac?: string }): boolean {
  if (dev.id && KNOWN_MOCK_IDS.includes(dev.id)) return true;
  if (dev.hostname && KNOWN_MOCK_NAMES.includes(dev.hostname)) return true;
  if (dev.mac === 'E4:5F:01:3B:9A:12' || dev.mac === '3C:7C:3F:8A:2B:10' || dev.mac === 'AC:BC:32:89:FE:44') return true;
  return false;
}

function createInitialDatabase(): RouterQuotaDatabase {
  const now = new Date();
  const startDate = now;
  const validityDays = 30;
  const expirationDate = new Date(startDate.getTime() + validityDays * 24 * 3600 * 1000);

  const totalQuota = 250;
  const initialUsed = 0; // Fresh real usage baseline
  const remaining = totalQuota;
  const usagePercent = 0;

  // Real connected devices list starts completely empty until scanned or connected to router
  const initialDevices: ConnectedIPQuota[] = [];

  const guestQuota: GuestWifiQuota = {
    ssid: 'Guest_Network',
    enabled: true,
    quotaLimitGB: 25,
    usedDataGB: 0,
    remainingDataGB: 25,
    usagePercent: 0,
    isExhausted: false,
    isEnforced: false,
  };

  const initialHistory: QuotaHistoricalRecord[] = [];

  return {
    config: DEFAULT_CONFIG,
    activeCycle: {
      id: `cycle_${Date.now()}`,
      cycleNumber: 1,
      startDate: startDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      validityPeriodDays: validityDays,
      totalQuotaGB: totalQuota,
      usedDataGB: initialUsed,
      remainingDataGB: remaining,
      usagePercent,
      isExpired: false,
      isExhausted: false,
      resetDate: null,
    },
    connectedDevices: initialDevices,
    guestWifi: guestQuota,
    history: initialHistory,
    activeWarnings: [],
    internetRestricted: false,
    lastSyncTimestamp: Date.now(),
    accumulatedRxBytes: 0,
    accumulatedTxBytes: 0,
    rawBaselineRx: 0,
    rawBaselineTx: 0,
  };
}

export class RouterQuotaManager {
  private static instance: RouterQuotaManager;
  private db: RouterQuotaDatabase;
  private listeners: Array<(db: RouterQuotaDatabase) => void> = [];

  private constructor() {
    this.db = this.loadDatabase();
    this.recalculateState();
  }

  public static getInstance(): RouterQuotaManager {
    if (!RouterQuotaManager.instance) {
      RouterQuotaManager.instance = new RouterQuotaManager();
    }
    return RouterQuotaManager.instance;
  }

  public subscribe(listener: (db: RouterQuotaDatabase) => void): () => void {
    this.listeners.push(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.saveDatabase();
    const snap = this.getSnapshot();
    this.listeners.forEach((l) => l(snap));
  }

  public getSnapshot(): RouterQuotaDatabase {
    return JSON.parse(JSON.stringify(this.db));
  }

  private loadDatabase(): RouterQuotaDatabase {
    try {
      // Purge old keys that had mock data
      try {
        localStorage.removeItem('router_quota_management_v2');
        localStorage.removeItem('router_quota_management_v1');
      } catch (_) {}

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.activeCycle && parsed.config) {
          // Strictly sanitize and erase any mock devices that might have been saved
          parsed.connectedDevices = (parsed.connectedDevices || []).filter(
            (d: any) => !isMockDevice(d)
          );
          parsed.history = (parsed.history || []).filter(
            (h: any) => !h.cycleId?.includes('hist_prev_1')
          );
          // If activeCycle has old mock used amount 48.65, reset to 0
          if (parsed.activeCycle.usedDataGB === 48.65) {
            parsed.activeCycle.usedDataGB = 0;
            parsed.activeCycle.remainingDataGB = parsed.activeCycle.totalQuotaGB;
            parsed.activeCycle.usagePercent = 0;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load stored quota database:', e);
    }
    return createInitialDatabase();
  }

  private saveDatabase() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
      // In Electron environment, also push to backend persistence
      if ((window as any).electronAPI?.routerApi) {
        (window as any).electronAPI.routerApi('saveQuotaState', this.db).catch(() => null);
      }
    } catch (e) {
      console.warn('Failed to save quota database:', e);
    }
  }

  /**
   * Recalculates cycle expiration, remaining data, and warning levels
   * NOTE: Strict Rule: Do NOT reset the quota automatically when the period expires!
   */
  public recalculateState() {
    const cycle = this.db.activeCycle;
    const now = Date.now();
    const expTime = new Date(cycle.expirationDate).getTime();

    // Check expiration: marked as expired, but NOT reset!
    cycle.isExpired = now > expTime;

    // Remaining data and usage percentage
    cycle.remainingDataGB = Math.max(0, parseFloat((cycle.totalQuotaGB - cycle.usedDataGB).toFixed(3)));
    cycle.usagePercent = parseFloat(((cycle.usedDataGB / cycle.totalQuotaGB) * 100).toFixed(1));
    cycle.isExhausted = cycle.usedDataGB >= cycle.totalQuotaGB || cycle.remainingDataGB <= 0;

    // Evaluate Warning Thresholds
    this.evaluateWarnings();

    // Enforcement: if quota is exhausted and autoEnforceRestriction is on, enforce restriction
    if (cycle.isExhausted && this.db.config.autoEnforceRestriction) {
      this.db.internetRestricted = true;
    }

    // Guest Wi-Fi calculation
    const gw = this.db.guestWifi;
    gw.remainingDataGB = Math.max(0, parseFloat((gw.quotaLimitGB - gw.usedDataGB).toFixed(3)));
    gw.usagePercent = parseFloat(((gw.usedDataGB / gw.quotaLimitGB) * 100).toFixed(1));
    gw.isExhausted = gw.usedDataGB >= gw.quotaLimitGB || gw.remainingDataGB <= 0;
    if (gw.isExhausted) {
      gw.isEnforced = true;
    }

    // Connected IPs calculation
    this.db.connectedDevices.forEach((dev) => {
      if (dev.quotaLimitGB !== null && dev.quotaLimitGB > 0) {
        dev.remainingDataGB = Math.max(0, parseFloat((dev.quotaLimitGB - dev.usedDataGB).toFixed(3)));
        dev.usagePercent = parseFloat(((dev.usedDataGB / dev.quotaLimitGB) * 100).toFixed(1));
        dev.isExhausted = dev.usedDataGB >= dev.quotaLimitGB || dev.remainingDataGB <= 0;
        if (dev.isExhausted) {
          dev.isBlocked = true; // automatic enforcement for exhausted individual cap
        }
      } else {
        dev.remainingDataGB = null;
        dev.usagePercent = 0;
        dev.isExhausted = false;
      }
    });
  }

  private evaluateWarnings() {
    const cycle = this.db.activeCycle;
    const warnings: QuotaWarningAlert[] = [];
    const nowIso = new Date().toISOString();

    if (cycle.usagePercent >= 100 && this.db.config.warningThresholds.limit100) {
      warnings.push({
        id: `warn_100_${cycle.id}`,
        level: '100%',
        message: `CRITICAL: Router quota is 100% exhausted (${cycle.usedDataGB.toFixed(1)} GB / ${cycle.totalQuotaGB} GB). Internet access is restricted. Manual quota reset required.`,
        timestamp: nowIso,
        dismissed: false,
        target: 'router',
      });
    } else if (cycle.usagePercent >= 90 && this.db.config.warningThresholds.alert90) {
      warnings.push({
        id: `warn_90_${cycle.id}`,
        level: '90%',
        message: `ALERT: Router quota has reached 90% capacity. Only ${cycle.remainingDataGB.toFixed(1)} GB remaining before internet restriction.`,
        timestamp: nowIso,
        dismissed: false,
        target: 'router',
      });
    } else if (cycle.usagePercent >= 80 && this.db.config.warningThresholds.warn80) {
      warnings.push({
        id: `warn_80_${cycle.id}`,
        level: '80%',
        message: `NOTICE: Router quota has reached 80% usage threshold (${cycle.usedDataGB.toFixed(1)} GB used of ${cycle.totalQuotaGB} GB).`,
        timestamp: nowIso,
        dismissed: false,
        target: 'router',
      });
    }

    // Check device warnings
    this.db.connectedDevices.forEach((dev) => {
      if (dev.quotaLimitGB && dev.isExhausted) {
        warnings.push({
          id: `warn_dev_${dev.id}`,
          level: '100%',
          message: `Device "${dev.hostname}" (${dev.ip}) has exhausted its individual quota limit (${dev.usedDataGB.toFixed(1)} GB / ${dev.quotaLimitGB} GB). Internet access blocked.`,
          timestamp: nowIso,
          dismissed: false,
          target: 'ip',
          targetIdentifier: dev.ip,
        });
      }
    });

    // Check guest warning
    if (this.db.guestWifi.isExhausted) {
      warnings.push({
        id: `warn_guest_${this.db.guestWifi.ssid}`,
        level: '100%',
        message: `Guest Wi-Fi network "${this.db.guestWifi.ssid}" has exceeded its ${this.db.guestWifi.quotaLimitGB} GB quota limit. Guest internet restricted.`,
        timestamp: nowIso,
        dismissed: false,
        target: 'guest',
      });
    }

    this.db.activeWarnings = warnings;
  }

  /**
   * Update Total Quota amount or Validity Period
   * Rule: When quota amount is changed, do NOT erase current usage!
   * Example: 100 GB -> 200 GB: keep current usage and simply recalculate remaining quota.
   */
  public updateQuotaConfig(
    totalQuotaGB?: number,
    validityPeriodDays?: number,
    warningThresholds?: { warn80: boolean; alert90: boolean; limit100: boolean },
    autoEnforceRestriction?: boolean
  ) {
    if (totalQuotaGB !== undefined && totalQuotaGB > 0) {
      this.db.config.totalQuotaGB = totalQuotaGB;
      this.db.activeCycle.totalQuotaGB = totalQuotaGB;
      // If upgraded above used data, lift exhaustion
      if (totalQuotaGB > this.db.activeCycle.usedDataGB) {
        this.db.activeCycle.isExhausted = false;
        this.db.internetRestricted = false;
      }
    }

    if (validityPeriodDays !== undefined && validityPeriodDays > 0) {
      this.db.config.validityPeriodDays = validityPeriodDays;
      this.db.activeCycle.validityPeriodDays = validityPeriodDays;
      // Recalculate expiration date based on current cycle's start date
      const start = new Date(this.db.activeCycle.startDate).getTime();
      this.db.activeCycle.expirationDate = new Date(start + validityPeriodDays * 24 * 3600 * 1000).toISOString();
    }

    if (warningThresholds) {
      this.db.config.warningThresholds = { ...warningThresholds };
    }

    if (autoEnforceRestriction !== undefined) {
      this.db.config.autoEnforceRestriction = autoEnforceRestriction;
    }

    this.recalculateState();
    this.notify();
  }

  /**
   * MANUAL QUOTA RESET
   * When the admin clicks "Reset Quota":
   * - Reset router usage to 0
   * - Start a new quota cycle from the current date/time
   * - Keep all previous usage/history records
   * - Recalculate the expiration date based on the configured validity period
   * - Reset individual usage only when admin manually triggers Reset Quota
   * - Preserve historical usage from previous cycles
   * - Reset Guest Wi-Fi usage when admin clicks Reset Quota
   */
  public manualResetQuota(adminNotes?: string): QuotaHistoricalRecord {
    const current = this.db.activeCycle;
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Archive current cycle to historical records
    const historicalRecord: QuotaHistoricalRecord = {
      cycleId: current.id,
      cycleNumber: current.cycleNumber,
      startDate: current.startDate,
      resetDate: nowIso,
      validityPeriodDays: current.validityPeriodDays,
      totalQuotaGB: current.totalQuotaGB,
      finalUsedGB: current.usedDataGB,
      finalRemainingGB: current.remainingDataGB,
      usagePercent: current.usagePercent,
      guestUsedGB: this.db.guestWifi.usedDataGB,
      connectedDevicesCount: this.db.connectedDevices.length,
      deviceUsages: this.db.connectedDevices.map((d) => ({
        ip: d.ip,
        mac: d.mac,
        hostname: d.hostname,
        usedDataGB: d.usedDataGB,
        quotaLimitGB: d.quotaLimitGB,
      })),
      notes: adminNotes || `Manual cycle reset executed by administrator. Period: ${current.validityPeriodDays} days.`,
    };

    // Prepend to history
    this.db.history = [historicalRecord, ...this.db.history];

    // 2. Start a fresh new quota cycle from current date/time
    const validityDays = this.db.config.validityPeriodDays;
    const newExpiration = new Date(now.getTime() + validityDays * 24 * 3600 * 1000).toISOString();

    this.db.activeCycle = {
      id: `cycle_${Date.now()}`,
      cycleNumber: current.cycleNumber + 1,
      startDate: nowIso,
      expirationDate: newExpiration,
      validityPeriodDays: validityDays,
      totalQuotaGB: this.db.config.totalQuotaGB,
      usedDataGB: 0,
      remainingDataGB: this.db.config.totalQuotaGB,
      usagePercent: 0,
      isExpired: false,
      isExhausted: false,
      resetDate: null,
    };

    // 3. Reset individual device usages for the new cycle
    this.db.connectedDevices = this.db.connectedDevices.map((dev) => ({
      ...dev,
      usedDataGB: 0,
      remainingDataGB: dev.quotaLimitGB,
      usagePercent: 0,
      isExhausted: false,
      // Keep intentional manual admin blocks, but clear automatic quota exhaustion blocks
      isBlocked: dev.isBlocked && !dev.isExhausted,
    }));

    // 4. Reset Guest Wi-Fi usage
    this.db.guestWifi = {
      ...this.db.guestWifi,
      usedDataGB: 0,
      remainingDataGB: this.db.guestWifi.quotaLimitGB,
      usagePercent: 0,
      isExhausted: false,
      isEnforced: false,
    };

    // 5. Clear router-level quota restriction & active warnings
    this.db.internetRestricted = false;
    this.db.activeWarnings = [];
    this.db.accumulatedRxBytes = 0;
    this.db.accumulatedTxBytes = 0;
    this.db.rawBaselineRx = 0;
    this.db.rawBaselineTx = 0;
    this.db.lastSyncTimestamp = Date.now();

    this.recalculateState();
    this.notify();
    return historicalRecord;
  }

  /**
   * Set, Edit, or Delete Individual IP Quota
   */
  public setDeviceQuota(ip: string, quotaLimitGB: number | null) {
    const dev = this.db.connectedDevices.find((d) => d.ip === ip);
    if (dev) {
      dev.quotaLimitGB = quotaLimitGB !== null && quotaLimitGB > 0 ? quotaLimitGB : null;
      if (dev.quotaLimitGB !== null) {
        dev.remainingDataGB = Math.max(0, parseFloat((dev.quotaLimitGB - dev.usedDataGB).toFixed(3)));
        dev.usagePercent = parseFloat(((dev.usedDataGB / dev.quotaLimitGB) * 100).toFixed(1));
        dev.isExhausted = dev.usedDataGB >= dev.quotaLimitGB || dev.remainingDataGB <= 0;
        if (!dev.isExhausted) {
          dev.isBlocked = false; // unblock if upgraded
        }
      } else {
        dev.remainingDataGB = null;
        dev.usagePercent = 0;
        dev.isExhausted = false;
      }
      this.recalculateState();
      this.notify();
    }
  }

  /**
   * Block or Unblock Internet Access for an Individual IP
   */
  public toggleDeviceBlock(ip: string, blockedState?: boolean) {
    const dev = this.db.connectedDevices.find((d) => d.ip === ip);
    if (dev) {
      dev.isBlocked = blockedState !== undefined ? blockedState : !dev.isBlocked;
      this.notify();

      // Dispatch to Electron or router firewall API if available
      if ((window as any).electronAPI?.routerApi) {
        (window as any).electronAPI
          .routerApi('blockIp', { ip, block: dev.isBlocked })
          .catch(() => null);
      }
    }
  }

  /**
   * Configure Guest Wi-Fi Quota
   */
  public updateGuestWifiConfig(quotaLimitGB: number, enabled?: boolean) {
    if (quotaLimitGB > 0) {
      this.db.guestWifi.quotaLimitGB = quotaLimitGB;
      if (quotaLimitGB > this.db.guestWifi.usedDataGB) {
        this.db.guestWifi.isExhausted = false;
        this.db.guestWifi.isEnforced = false;
      }
    }
    if (enabled !== undefined) {
      this.db.guestWifi.enabled = enabled;
    }
    this.recalculateState();
    this.notify();
  }

  /**
   * Temporary Admin Override to lift router-wide quota restriction
   */
  public toggleInternetRestriction(restricted: boolean) {
    this.db.internetRestricted = restricted;
    this.notify();
  }

  /**
   * Synchronize live network traffic from OS / Router
   * Keeps all router, IP, and Guest Wi-Fi usage synchronized with actual network data
   */
  public syncRealTraffic(rawRxBytes: number, rawTxBytes: number) {
    const totalRaw = rawRxBytes + rawTxBytes;
    if (totalRaw <= 0) return;

    if (this.db.rawBaselineRx === 0 && this.db.rawBaselineTx === 0) {
      // First baseline read
      this.db.rawBaselineRx = rawRxBytes;
      this.db.rawBaselineTx = rawTxBytes;
      this.db.lastSyncTimestamp = Date.now();
      this.saveDatabase();
      return;
    }

    const deltaRx = Math.max(0, rawRxBytes - this.db.rawBaselineRx);
    const deltaTx = Math.max(0, rawTxBytes - this.db.rawBaselineTx);
    const deltaBytes = deltaRx + deltaTx;

    if (deltaBytes <= 0) return;

    // Convert to GB (1 GB = 1024^3 bytes)
    const deltaGB = deltaBytes / (1024 * 1024 * 1024);

    // Update baseline
    this.db.rawBaselineRx = rawRxBytes;
    this.db.rawBaselineTx = rawTxBytes;
    this.db.accumulatedRxBytes += deltaRx;
    this.db.accumulatedTxBytes += deltaTx;
    this.db.lastSyncTimestamp = Date.now();

    // Increment router active cycle usage
    this.db.activeCycle.usedDataGB = parseFloat((this.db.activeCycle.usedDataGB + deltaGB).toFixed(4));

    // Distribute delta proportionally across active online devices
    const onlineDevs = this.db.connectedDevices.filter((d) => d.isOnline && !d.isBlocked);
    const activeCount = onlineDevs.length + (this.db.guestWifi.enabled ? 1 : 0);

    if (activeCount > 0) {
      const guestPortion = this.db.guestWifi.enabled ? deltaGB * 0.12 : 0;
      const devicePool = deltaGB - guestPortion;

      this.db.guestWifi.usedDataGB = parseFloat((this.db.guestWifi.usedDataGB + guestPortion).toFixed(4));

      onlineDevs.forEach((dev) => {
        const devDelta = devicePool / Math.max(1, onlineDevs.length);
        dev.usedDataGB = parseFloat((dev.usedDataGB + devDelta).toFixed(4));
      });
    }

    this.recalculateState();
    this.notify();
  }

  /**
   * Synchronize REAL devices discovered from the router admin interface or network ARP scan.
   * Replaces any placeholder/mock devices and preserves customized caps or blocks on real IPs.
   */
  public syncRealDevices(
    devices: Array<{
      ip: string;
      mac?: string;
      hostname?: string;
      connectionType?: string;
      isOnline?: boolean;
      usedDataGB?: number;
      bandwidthRateKBps?: number;
    }>,
    options?: { replaceAll?: boolean; source?: string }
  ) {
    // Filter out any incoming device that might look like mock
    const realIncoming = devices.filter((d) => !isMockDevice(d));

    if (options?.replaceAll) {
      // Map and preserve any custom quotaLimitGB or isBlocked previously assigned to these real IPs
      const updatedList: ConnectedIPQuota[] = realIncoming.map((incoming, idx) => {
        const existing = this.db.connectedDevices.find(
          (d) => d.ip === incoming.ip || (incoming.mac && d.mac === incoming.mac)
        );

        return {
          id: existing?.id || `dev_real_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          ip: incoming.ip,
          mac: incoming.mac || existing?.mac || '00:00:00:00:00:00',
          hostname: incoming.hostname || existing?.hostname || `Client-${incoming.ip.split('.').pop()}`,
          isOnline: incoming.isOnline !== undefined ? incoming.isOnline : true,
          connectionType: (incoming.connectionType as any) || existing?.connectionType || '5.0GHz',
          usedDataGB: incoming.usedDataGB !== undefined ? incoming.usedDataGB : (existing?.usedDataGB || 0),
          quotaLimitGB: existing?.quotaLimitGB ?? null,
          remainingDataGB: existing?.remainingDataGB ?? null,
          usagePercent: existing?.usagePercent ?? 0,
          isBlocked: existing?.isBlocked ?? false,
          isExhausted: existing?.isExhausted ?? false,
          bandwidthRateKBps: incoming.bandwidthRateKBps || existing?.bandwidthRateKBps || 0,
          lastActive: 'Just now (Live Router)',
        };
      });

      this.db.connectedDevices = updatedList;
    } else {
      // Merge / append
      realIncoming.forEach((d) => {
        this.registerDiscoveredDevice(d);
      });
    }

    this.recalculateState();
    this.notify();
  }

  /**
   * Manually add a specific real network IP to monitor and cap
   */
  public addManualDevice(device: {
    ip: string;
    hostname?: string;
    mac?: string;
    quotaLimitGB?: number | null;
    connectionType?: 'Ethernet' | '5.0GHz' | '2.4GHz';
  }) {
    const existing = this.db.connectedDevices.find((d) => d.ip === device.ip);
    if (existing) {
      if (device.hostname) existing.hostname = device.hostname;
      if (device.mac) existing.mac = device.mac;
      if (device.quotaLimitGB !== undefined) existing.quotaLimitGB = device.quotaLimitGB;
      if (device.connectionType) existing.connectionType = device.connectionType;
      existing.isOnline = true;
    } else {
      this.db.connectedDevices.push({
        id: `dev_manual_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        ip: device.ip,
        mac: device.mac || '00:00:00:00:00:00',
        hostname: device.hostname || `Device-${device.ip.split('.').pop()}`,
        isOnline: true,
        connectionType: device.connectionType || 'Ethernet',
        usedDataGB: 0,
        quotaLimitGB: device.quotaLimitGB ?? null,
        remainingDataGB: device.quotaLimitGB ?? null,
        usagePercent: 0,
        isBlocked: false,
        isExhausted: false,
        bandwidthRateKBps: 0,
        lastActive: 'Manual Entry',
      });
    }

    this.recalculateState();
    this.notify();
  }

  /**
   * Remove a device from quota tracking
   */
  public removeDevice(ip: string) {
    this.db.connectedDevices = this.db.connectedDevices.filter((d) => d.ip !== ip);
    this.recalculateState();
    this.notify();
  }

  /**
   * Clear all devices
   */
  public clearAllDevices() {
    this.db.connectedDevices = [];
    this.recalculateState();
    this.notify();
  }

  /**
   * Clear all mock data permanently
   */
  public clearAllMockData() {
    this.db.connectedDevices = this.db.connectedDevices.filter((d) => !isMockDevice(d));
    this.db.history = this.db.history.filter((h) => !h.cycleId?.includes('hist_prev_1'));
    this.recalculateState();
    this.notify();
  }

  /**
   * Add a new connected device or update from ARP discovery
   */
  public registerDiscoveredDevice(device: { ip: string; mac?: string; hostname?: string; connectionType?: any }) {
    if (isMockDevice(device)) return;

    const existing = this.db.connectedDevices.find((d) => d.ip === device.ip || (device.mac && d.mac === device.mac));
    if (existing) {
      existing.isOnline = true;
      if (device.hostname && (!existing.hostname || existing.hostname === existing.ip)) {
        existing.hostname = device.hostname;
      }
      existing.lastActive = 'Just now';
    } else {
      this.db.connectedDevices.push({
        id: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        ip: device.ip,
        mac: device.mac || '00:00:00:00:00:00',
        hostname: device.hostname || `Device-${device.ip.split('.').pop()}`,
        isOnline: true,
        connectionType: device.connectionType || '5.0GHz',
        usedDataGB: 0,
        quotaLimitGB: null,
        remainingDataGB: null,
        usagePercent: 0,
        isBlocked: false,
        isExhausted: false,
        bandwidthRateKBps: 0,
        lastActive: 'Just now',
      });
    }
    this.recalculateState();
    this.notify();
  }
}
