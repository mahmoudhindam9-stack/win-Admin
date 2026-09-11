import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  PlusCircle,
  Edit3,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Globe,
  HardDrive,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Laptop,
  Terminal,
  Play,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ParentalRule,
  BlockedActivityRecord,
  ParentalCategory,
  FilteringScope,
  CATEGORY_PRESETS,
  ParentalDatabase,
} from '../services/router/parentalTypes';
import { ParentalControlManager } from '../services/router/parentalEngine';
import { RouterDeviceInfo, RouterBrand } from '../services/router/types';
import { ConnectedIPQuota } from '../services/router/quotaTypes';

interface RouterParentalControlProps {
  routerDeviceInfo?: RouterDeviceInfo | null;
  sessionToken?: string;
  connectedDevices?: ConnectedIPQuota[];
}

export function RouterParentalControl({
  routerDeviceInfo,
  sessionToken,
  connectedDevices = [],
}: RouterParentalControlProps) {
  const manager = ParentalControlManager.getInstance();
  const [db, setDb] = useState<ParentalDatabase>(manager.getSnapshot());

  // Subscription
  useEffect(() => {
    const unsub = manager.subscribe((newDb) => {
      setDb(newDb);
    });
    return () => unsub();
  }, [manager]);

  // Section view toggle: 'rules' or 'activity'
  const [activeSection, setActiveSection] = useState<'rules' | 'activity'>('rules');

  // Rule Form Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleScope, setRuleScope] = useState<FilteringScope>('all');
  const [ruleTargetIps, setRuleTargetIps] = useState<string[]>([]);
  const [ruleSpecificIpInput, setRuleSpecificIpInput] = useState('');
  const [ruleCategories, setRuleCategories] = useState<ParentalCategory[]>(['Adult Content', 'Gambling']);
  const [ruleCustomCategoryName, setRuleCustomCategoryName] = useState('');
  const [ruleCustomDomainsText, setRuleCustomDomainsText] = useState('');
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);

  // Router Application State
  const [isApplyingToRouter, setIsApplyingToRouter] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Script Modal State
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [scriptType, setScriptType] = useState<'bash' | 'powershell' | 'dnsmasq'>('bash');

  // Live Test Filter State
  const [testDomain, setTestDomain] = useState('');
  const [testClientIp, setTestClientIp] = useState('');
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    blocked: boolean;
    category?: string;
    ruleName?: string;
    reason?: string;
  } | null>(null);
  const [isTestingDomain, setIsTestingDomain] = useState(false);

  // Activity Log Filters
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [selectedIpFilter, setSelectedIpFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'today' | '24h' | '7d'>('all');

  // Available client IPs (combining connected devices and logged IPs)
  const availableIps = useMemo(() => {
    const set = new Map<string, string>();
    connectedDevices.forEach((d) => {
      set.set(d.ip, `${d.ip} (${d.hostname || 'Device'})`);
    });
    db.activityLog.forEach((a) => {
      if (!set.has(a.ip)) {
        set.set(a.ip, `${a.ip} (${a.hostname || 'Client'})`);
      }
    });
    return Array.from(set.entries()).map(([ip, label]) => ({ ip, label }));
  }, [connectedDevices, db.activityLog]);

  // Unique categories in activity log
  const uniqueActivityCategories = useMemo(() => {
    const cats = new Set<string>();
    db.activityLog.forEach((a) => cats.add(a.blockedCategory));
    return Array.from(cats);
  }, [db.activityLog]);

  // Filtered Blocked Activity
  const filteredActivityLog = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    return db.activityLog.filter((record) => {
      // IP Filter
      if (selectedIpFilter !== 'all' && record.ip !== selectedIpFilter) {
        return false;
      }

      // Category Filter
      if (selectedCategoryFilter !== 'all' && record.blockedCategory !== selectedCategoryFilter) {
        return false;
      }

      // Domain / Hostname search
      if (activitySearchQuery.trim()) {
        const q = activitySearchQuery.toLowerCase().trim();
        const matchDomain = record.requestedDomain.toLowerCase().includes(q);
        const matchIp = record.ip.toLowerCase().includes(q);
        const matchHost = record.hostname ? record.hostname.toLowerCase().includes(q) : false;
        if (!matchDomain && !matchIp && !matchHost) return false;
      }

      // Date Range Filter
      if (selectedDateRange !== 'all') {
        const recordTime = new Date(record.timestamp).getTime();
        if (selectedDateRange === 'today') {
          const todayStart = new Date().setHours(0, 0, 0, 0);
          if (recordTime < todayStart) return false;
        } else if (selectedDateRange === '24h') {
          if (now - recordTime > oneDay) return false;
        } else if (selectedDateRange === '7d') {
          if (now - recordTime > sevenDays) return false;
        }
      }

      return true;
    });
  }, [db.activityLog, selectedIpFilter, selectedCategoryFilter, activitySearchQuery, selectedDateRange]);

  // Summary Metrics
  const totalBlockedAttempts = useMemo(() => {
    return db.activityLog.reduce((acc, curr) => acc + (curr.attemptCount || 1), 0);
  }, [db.activityLog]);

  const uniqueBlockedDomainsCount = useMemo(() => {
    return new Set(db.activityLog.map((r) => r.requestedDomain.toLowerCase())).size;
  }, [db.activityLog]);

  const uniqueTargetIpsCount = useMemo(() => {
    return new Set(db.activityLog.map((r) => r.ip)).size;
  }, [db.activityLog]);

  // Open modal to create a new rule
  const handleOpenAddRule = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleDescription('');
    setRuleScope('all');
    setRuleTargetIps([]);
    setRuleSpecificIpInput('');
    setRuleCategories(['Adult Content', 'Gambling']);
    setRuleCustomCategoryName('');
    setRuleCustomDomainsText('');
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  };

  // Open modal to edit an existing rule
  const handleOpenEditRule = (rule: ParentalRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleDescription(rule.description || '');
    setRuleScope(rule.scope);
    setRuleTargetIps([...rule.targetIps]);
    setRuleSpecificIpInput(rule.targetIps[0] || '');
    setRuleCategories([...rule.categories]);
    setRuleCustomCategoryName(rule.customCategoryName || '');
    setRuleCustomDomainsText(rule.customDomains.join('\n'));
    setRuleFormError(null);
    setIsRuleModalOpen(true);
  };

  // Save (Add or Update) Rule
  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    setRuleFormError(null);

    const nameTrimmed = ruleName.trim();
    if (!nameTrimmed) {
      setRuleFormError('Please provide a rule name.');
      return;
    }

    // IP validation for specific/multiple
    let finalTargetIps: string[] = [];
    if (ruleScope === 'specific') {
      const ip = ruleSpecificIpInput.trim();
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ip)) {
        setRuleFormError('Please enter a valid IPv4 address (e.g. 192.168.1.105)');
        return;
      }
      finalTargetIps = [ip];
    } else if (ruleScope === 'multiple') {
      if (ruleTargetIps.length === 0) {
        setRuleFormError('Please select at least one IP address to apply this rule to.');
        return;
      }
      finalTargetIps = [...ruleTargetIps];
    }

    // Parse custom domains
    const customDomains = ruleCustomDomainsText
      .split(/[\n,;]+/)
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
      .filter((d) => d.length > 2);

    if (ruleCategories.length === 0 && customDomains.length === 0) {
      setRuleFormError('Please select at least one category or enter specific domains to block.');
      return;
    }

    if (editingRuleId) {
      manager.updateRule(editingRuleId, {
        name: nameTrimmed,
        description: ruleDescription.trim() || undefined,
        scope: ruleScope,
        targetIps: finalTargetIps,
        categories: ruleCategories,
        customDomains,
        customCategoryName: ruleCategories.includes('Custom') ? ruleCustomCategoryName.trim() : undefined,
      });
      setActionFeedback({ type: 'success', text: `Rule "${nameTrimmed}" updated successfully.` });
    } else {
      manager.addRule({
        name: nameTrimmed,
        description: ruleDescription.trim() || undefined,
        enabled: true,
        scope: ruleScope,
        targetIps: finalTargetIps,
        categories: ruleCategories,
        customDomains,
        customCategoryName: ruleCategories.includes('Custom') ? ruleCustomCategoryName.trim() : undefined,
        action: 'block',
      });
      setActionFeedback({ type: 'success', text: `New rule "${nameTrimmed}" created and activated.` });
    }

    setIsRuleModalOpen(false);
  };

  // Toggle Category selection in modal
  const handleToggleCategory = (cat: ParentalCategory) => {
    if (ruleCategories.includes(cat)) {
      setRuleCategories(ruleCategories.filter((c) => c !== cat));
    } else {
      setRuleCategories([...ruleCategories, cat]);
    }
  };

  // Apply Rules to Router
  const handleApplyToRouter = async () => {
    setIsApplyingToRouter(true);
    setActionFeedback(null);

    const endpoint = routerDeviceInfo
      ? `${routerDeviceInfo.protocol}://${routerDeviceInfo.gatewayIp}:${routerDeviceInfo.port}`
      : 'http://192.168.1.1';
    const token = sessionToken || 'admin_session';
    const brand: RouterBrand = routerDeviceInfo?.brand || 'openwrt';

    try {
      const res = await manager.applyToRouter(endpoint, token, brand);
      if (res.success) {
        setActionFeedback({
          type: 'success',
          text: `Router sync complete: ${res.appliedCount} domain filters enforced directly on ${brand.toUpperCase()} network daemon.`,
        });
      } else {
        setActionFeedback({
          type: 'error',
          text: `Router sync notice: ${res.message}`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: `Error synchronizing with router: ${err.message || String(err)}`,
      });
    } finally {
      setIsApplyingToRouter(false);
    }
  };

  // Test Domain Filter Verification
  const handleTestDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = testDomain.trim();
    if (!domain) return;

    setIsTestingDomain(true);
    try {
      const evaluation = manager.testDomainAgainstRules(domain, testClientIp || undefined);

      setTestResult({
        tested: true,
        blocked: evaluation.blocked,
        category: evaluation.category,
        ruleName: evaluation.matchingRule?.name,
        reason: evaluation.reason,
      });

      // If blocked, record into live blocked activity log
      if (evaluation.blocked) {
        const clientIp = testClientIp.trim() || '192.168.1.102';
        const clientHost =
          connectedDevices.find((d) => d.ip === clientIp)?.hostname ||
          (testClientIp ? `Host-${testClientIp.split('.').pop()}` : 'Network-Client');

        manager.recordBlockedActivity({
          ip: clientIp,
          hostname: clientHost,
          requestedDomain: domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0],
          blockedCategory: evaluation.category || 'General Filter',
          ruleId: evaluation.matchingRule?.id,
          ruleName: evaluation.matchingRule?.name,
        });
      }
    } finally {
      setIsTestingDomain(false);
    }
  };

  // Export Activity Log
  const handleDownloadLog = (format: 'csv' | 'json') => {
    const data = manager.exportActivityLog(format);
    const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json';
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `router-blocked-activity-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear Activity Log
  const handleClearActivityLog = () => {
    if (confirm('Are you sure you want to clear all blocked activity logs? This action cannot be undone.')) {
      manager.clearActivityLog();
      setActionFeedback({ type: 'info', text: 'Blocked activity history cleared.' });
    }
  };

  const scripts = useMemo(() => {
    return manager.generateRouterScript(routerDeviceInfo?.brand || 'openwrt', routerDeviceInfo?.gatewayIp || '192.168.1.1');
  }, [manager, routerDeviceInfo, db.rules]);

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER CONTROLS BANNER */}
      <div className="bg-[#0F1423] border border-[#1F293D] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#1F293D] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-cyan-950/60 border border-cyan-400/40">
              <ShieldAlert className="w-5 h-5 text-cyan-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base font-bold text-slate-100 tracking-tight">
                  Parental Control & Global Web Filtering
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono">
                  DNS & Firewall Enforced
                </span>
                {db.globalFilterEnabled ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Global Filtering Active</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    Filtering Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Block harmful websites, adult content, streaming, or social media for <strong>all IP addresses</strong> or selected devices with live blocked-activity auditing.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={handleApplyToRouter}
              disabled={isApplyingToRouter}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-cyan-950/40 cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isApplyingToRouter ? 'animate-spin' : ''}`} />
              <span>{isApplyingToRouter ? 'Syncing...' : 'Apply to Router'}</span>
            </button>

            <button
              onClick={handleOpenAddRule}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-950/40 cursor-pointer transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Blocking Rule</span>
            </button>

            <button
              onClick={() => setIsScriptModalOpen(true)}
              className="px-3 py-1.5 bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 hover:text-white border border-[#1F293D] rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Script</span>
            </button>
          </div>
        </div>

        {/* Action Feedback message */}
        {actionFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-200'
                : actionFeedback.type === 'error'
                ? 'bg-rose-950/50 border-rose-800/80 text-rose-200'
                : 'bg-cyan-950/50 border-cyan-800/80 text-cyan-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : actionFeedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span>{actionFeedback.text}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-white cursor-pointer ml-3"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] font-medium">Active Rules</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-lg font-bold font-mono text-cyan-400">
                {db.rules.filter((r) => r.enabled).length}
              </span>
              <span className="text-slate-500 text-[10px]">/ {db.rules.length} configured</span>
            </div>
          </div>

          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] font-medium">Global Scope Coverage</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-lg font-bold font-mono text-emerald-400">
                {db.rules.some((r) => r.enabled && r.scope === 'all') ? 'All IPs (100%)' : 'Targeted IPs'}
              </span>
            </div>
          </div>

          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] font-medium">Total Blocked Attempts</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-lg font-bold font-mono text-rose-400">
                {totalBlockedAttempts.toLocaleString()}
              </span>
              <span className="text-slate-500 text-[10px]">requests</span>
            </div>
          </div>

          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] font-medium">Unique Blocked Domains</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-lg font-bold font-mono text-purple-400">
                {uniqueBlockedDomainsCount}
              </span>
              <span className="text-slate-500 text-[10px]">intercepted</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS: RULES vs BLOCKED ACTIVITY */}
        <div className="flex items-center space-x-2 pt-2 border-t border-[#1F293D]">
          <button
            onClick={() => setActiveSection('rules')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSection === 'rules'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-[#161B2A] text-slate-300 hover:text-white hover:bg-[#1F293D]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Filtering Rules ({db.rules.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('activity')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeSection === 'activity'
                ? 'bg-cyan-600 text-white shadow'
                : 'bg-[#161B2A] text-slate-300 hover:text-white hover:bg-[#1F293D]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Global Blocked Activity ({db.activityLog.length})</span>
            {totalBlockedAttempts > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono font-bold">
                {totalBlockedAttempts}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SECTION 1: FILTERING RULES */}
      {activeSection === 'rules' && (
        <div className="space-y-6">
          {/* Rules List Container */}
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Configured Website & Category Blocking Rules
                </h3>
                <p className="text-[11px] text-slate-400">
                  Manage filtering policies applied across all IPs or assigned to individual host devices
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                  <span>Master Filter:</span>
                  <input
                    type="checkbox"
                    checked={db.globalFilterEnabled}
                    onChange={(e) => manager.setGlobalFilterEnabled(e.target.checked)}
                    className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                  />
                  <span className={db.globalFilterEnabled ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                    {db.globalFilterEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            {db.rules.length === 0 ? (
              <div className="py-12 text-center bg-[#0B0F1A]/60 rounded-xl border border-dashed border-[#1F293D] space-y-3">
                <Shield className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">No parental control or domain blocking rules configured.</p>
                <button
                  onClick={handleOpenAddRule}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Create First Blocking Rule
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {db.rules.map((rule) => {
                  const isGlobal = rule.scope === 'all';
                  return (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-xl border transition-all ${
                        rule.enabled
                          ? 'bg-[#0B0F1A] border-[#1F293D] hover:border-cyan-500/50'
                          : 'bg-[#080B12]/60 border-[#1F293D]/50 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          {/* Rule Title & Scope Badges */}
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="text-sm font-bold text-slate-200">{rule.name}</h4>

                            {/* Scope Badge */}
                            {isGlobal ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 flex items-center space-x-1">
                                <Globe className="w-3 h-3" />
                                <span>All IP Addresses (Router-Wide)</span>
                              </span>
                            ) : rule.scope === 'specific' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700 flex items-center space-x-1">
                                <Laptop className="w-3 h-3" />
                                <span>Single IP: {rule.targetIps[0] || 'Unassigned'}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 flex items-center space-x-1">
                                <Layers className="w-3 h-3" />
                                <span>Multiple IPs ({rule.targetIps.length} Targets)</span>
                              </span>
                            )}

                            {/* Enabled Status Badge */}
                            {rule.enabled ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                PAUSED
                              </span>
                            )}
                          </div>

                          {rule.description && (
                            <p className="text-xs text-slate-400">{rule.description}</p>
                          )}

                          {/* Specific Target IPs pill list if not global */}
                          {!isGlobal && rule.targetIps.length > 0 && (
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 pt-1">
                              <span className="text-[10px] text-slate-500 font-mono">Enforced on:</span>
                              {rule.targetIps.map((ip) => (
                                <span
                                  key={ip}
                                  className="px-2 py-0.5 rounded bg-[#161B2A] border border-[#1F293D] text-[11px] font-mono text-slate-300"
                                >
                                  {ip}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Categories and custom domains tags */}
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 pt-1">
                            {rule.categories.map((cat) => {
                              const preset = CATEGORY_PRESETS[cat];
                              return (
                                <span
                                  key={cat}
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${preset?.badgeBg || 'bg-slate-800 border-slate-700'} ${preset?.badgeText || 'text-slate-300'}`}
                                >
                                  {cat === 'Custom' && rule.customCategoryName
                                    ? rule.customCategoryName
                                    : cat}
                                </span>
                              );
                            })}

                            {rule.customDomains.length > 0 && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                +{rule.customDomains.length} custom domain{rule.customDomains.length === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Hit Counter & Actions */}
                        <div className="flex items-center space-x-3 self-end md:self-center">
                          <div className="text-right font-mono">
                            <span className="text-xs font-bold text-slate-300 block">
                              {rule.blockedCount || 0} hits
                            </span>
                            <span className="text-[10px] text-slate-500">blocked</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            {/* Toggle Rule */}
                            <button
                              onClick={() => manager.toggleRule(rule.id)}
                              title={rule.enabled ? 'Pause rule' : 'Enable rule'}
                              className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                                rule.enabled
                                  ? 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-800 text-emerald-300'
                                  : 'bg-[#161B2A] hover:bg-[#1F293D] border-[#1F293D] text-slate-400'
                              }`}
                            >
                              {rule.enabled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </button>

                            {/* Edit Rule */}
                            <button
                              onClick={() => handleOpenEditRule(rule)}
                              title="Edit rule settings"
                              className="p-2 rounded-lg bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 hover:text-cyan-400 border border-[#1F293D] cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete Rule */}
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete rule "${rule.name}"?`)) {
                                  manager.deleteRule(rule.id);
                                  setActionFeedback({ type: 'info', text: `Rule "${rule.name}" removed.` });
                                }
                              }}
                              title="Delete rule"
                              className="p-2 rounded-lg bg-[#161B2A] hover:bg-rose-950/50 border border-[#1F293D] text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LIVE DOMAIN TEST & VERIFICATION BENCH */}
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 border-b border-[#1F293D] pb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Live Rule Verification & Domain Tester
                </h3>
                <p className="text-[11px] text-slate-400">
                  Verify how the router network daemon evaluates requests from any IP address
                </p>
              </div>
            </div>

            <form onSubmit={handleTestDomain} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Target Domain or URL to Test
                </label>
                <input
                  type="text"
                  required
                  value={testDomain}
                  onChange={(e) => setTestDomain(e.target.value)}
                  placeholder="e.g. tiktok.com, bet365.com, steampowered.com"
                  className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg font-mono text-slate-200 outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Source Client IP (Leave empty for Global)
                </label>
                <input
                  type="text"
                  value={testClientIp}
                  onChange={(e) => setTestClientIp(e.target.value)}
                  placeholder="e.g. 192.168.1.105"
                  className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg font-mono text-slate-200 outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={isTestingDomain}
                  className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg cursor-pointer flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isTestingDomain ? 'Evaluating...' : 'Test Filter'}</span>
                </button>
              </div>
            </form>

            {/* Test Results Output */}
            {testResult?.tested && (
              <div
                className={`p-3.5 rounded-xl border text-xs animate-in fade-in ${
                  testResult.blocked
                    ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                    : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                }`}
              >
                <div className="flex items-center space-x-2.5 font-bold">
                  {testResult.blocked ? (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>
                    {testResult.blocked
                      ? `BLOCKED: Domain "${testDomain}" is intercepted and redirected to 0.0.0.0`
                      : `ALLOWED: Domain "${testDomain}" is not restricted by current policies`}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-300 space-y-0.5">
                  <p>{testResult.reason}</p>
                  {testResult.blocked && (
                    <p className="text-cyan-300 font-mono text-[10px]">
                      &rarr; Recorded into live Blocked Activity monitor for IP: {testClientIp || '192.168.1.102'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: GLOBAL BLOCKED ACTIVITY AUDIT */}
      {activeSection === 'activity' && (
        <div className="space-y-4">
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1F293D] pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Global Blocked-Activity Monitor
                </h3>
                <p className="text-[11px] text-slate-400">
                  Comprehensive audit trail of intercepted requests across all router IP addresses
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadLog('csv')}
                  className="px-2.5 py-1.5 bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 hover:text-white border border-[#1F293D] rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => handleDownloadLog('json')}
                  className="px-2.5 py-1.5 bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 hover:text-white border border-[#1F293D] rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>JSON</span>
                </button>

                {db.activityLog.length > 0 && (
                  <button
                    onClick={handleClearActivityLog}
                    className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* FILTER BAR: IP, CATEGORY, DOMAIN, DATE RANGE */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-[#0B0F1A] p-3 rounded-xl border border-[#1F293D] text-xs">
              {/* Search Domain or IP */}
              <div className="sm:col-span-4 relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={activitySearchQuery}
                  onChange={(e) => setActivitySearchQuery(e.target.value)}
                  placeholder="Filter domain, IP, or device..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-500"
                />
              </div>

              {/* IP Filter Dropdown */}
              <div className="sm:col-span-3">
                <select
                  value={selectedIpFilter}
                  onChange={(e) => setSelectedIpFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="all">All IP Addresses ({uniqueTargetIpsCount} hosts)</option>
                  {availableIps.map((dev) => (
                    <option key={dev.ip} value={dev.ip}>
                      {dev.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="all">All Categories</option>
                  {uniqueActivityCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="sm:col-span-2">
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                </select>
              </div>
            </div>

            {/* BLOCKED ACTIVITY TABLE */}
            {filteredActivityLog.length === 0 ? (
              <div className="py-12 px-4 text-center bg-[#0B0F1A]/60 rounded-xl border border-dashed border-[#1F293D] space-y-2">
                <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-200">No Blocked Requests Recorded</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {db.activityLog.length === 0
                    ? 'The activity log is clean and listening. Blocked requests from any IP on the network will appear here automatically.'
                    : 'No blocked requests match your selected filters.'}
                </p>
                {db.activityLog.length === 0 && (
                  <button
                    onClick={() => {
                      setActiveSection('rules');
                      setTestDomain('tiktok.com');
                    }}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Test Live Filter Bench
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1F293D] text-[11px] text-slate-400 uppercase tracking-wider">
                      <th className="pb-2 font-semibold">Date & Time</th>
                      <th className="pb-2 font-semibold">IP Address / Host</th>
                      <th className="pb-2 font-semibold">Requested Domain</th>
                      <th className="pb-2 font-semibold">Blocked Category</th>
                      <th className="pb-2 font-semibold">Blocked Attempts</th>
                      <th className="pb-2 font-semibold">Last Attempt</th>
                      <th className="pb-2 font-semibold text-right">Rule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F293D]/60 font-mono">
                    {filteredActivityLog.map((act) => {
                      const dateObj = new Date(act.timestamp);
                      const lastObj = new Date(act.lastAttempt);
                      const formattedTime = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const formattedDate = dateObj.toLocaleDateString();

                      return (
                        <tr key={act.id} className="hover:bg-[#141A2E] transition-colors">
                          {/* Date & Time */}
                          <td className="py-3 text-[11px] text-slate-300">
                            <span className="block font-bold text-slate-200">{formattedTime}</span>
                            <span className="text-[10px] text-slate-500">{formattedDate}</span>
                          </td>

                          {/* IP Address & Hostname */}
                          <td className="py-3">
                            <span className="text-cyan-400 font-bold block text-xs">{act.ip}</span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {act.hostname || 'Network Client'}
                            </span>
                          </td>

                          {/* Requested Domain */}
                          <td className="py-3 text-slate-200 font-bold text-xs">
                            <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300">
                              {act.requestedDomain}
                            </span>
                          </td>

                          {/* Blocked Category */}
                          <td className="py-3 font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#161B2A] border border-[#1F293D] text-slate-300">
                              {act.blockedCategory}
                            </span>
                          </td>

                          {/* Blocked Attempts Count */}
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-900/60 text-rose-200 border border-rose-700">
                              {act.attemptCount} attempt{act.attemptCount === 1 ? '' : 's'}
                            </span>
                          </td>

                          {/* Last Attempt */}
                          <td className="py-3 text-[11px] text-slate-400">
                            {lastObj.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>

                          {/* Matching Rule */}
                          <td className="py-3 text-right font-sans text-xs text-slate-400">
                            <span className="truncate max-w-[120px] inline-block" title={act.ruleName}>
                              {act.ruleName || 'Global Policy'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#1F293D]">
              <span>
                Showing <strong>{filteredActivityLog.length}</strong> of <strong>{db.activityLog.length}</strong> logged event{db.activityLog.length === 1 ? '' : 's'}
              </span>
              <span className="font-mono">Real Network DNS Sinkhole: 0.0.0.0</span>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT RULE MODAL */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    {editingRuleId ? 'Edit Parental Control Rule' : 'New Website / Category Blocking Rule'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure scope, categories, and custom domain blocklists</p>
                </div>
              </div>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {ruleFormError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{ruleFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              {/* Rule Name & Description */}
              <div className="space-y-2">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Rule Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Social Media Curfew or Global Adult Content Block"
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-slate-100 outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={ruleDescription}
                    onChange={(e) => setRuleDescription(e.target.value)}
                    placeholder="e.g. Enforced router-wide during homework hours"
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-slate-100 outline-none"
                  />
                </div>
              </div>

              {/* FILTERING SCOPE: ALL IPs vs SPECIFIC vs MULTIPLE */}
              <div className="p-3.5 rounded-xl bg-[#0B0F1A] border border-[#1F293D] space-y-3">
                <label className="font-bold text-slate-200 block text-xs uppercase tracking-wide">
                  Enforcement Scope <span className="text-rose-400">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* All IP addresses */}
                  <label
                    className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      ruleScope === 'all'
                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 shadow'
                        : 'bg-[#161B2A] border-[#1F293D] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="ruleScope"
                        checked={ruleScope === 'all'}
                        onChange={() => setRuleScope('all')}
                        className="text-cyan-600 focus:ring-0"
                      />
                      <span className="font-bold text-slate-200">All IP Addresses</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Router-wide. Covers all LAN & Wi-Fi devices.
                    </span>
                  </label>

                  {/* Specific IP address */}
                  <label
                    className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      ruleScope === 'specific'
                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 shadow'
                        : 'bg-[#161B2A] border-[#1F293D] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="ruleScope"
                        checked={ruleScope === 'specific'}
                        onChange={() => setRuleScope('specific')}
                        className="text-cyan-600 focus:ring-0"
                      />
                      <span className="font-bold text-slate-200">A Specific IP</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Applies exclusively to 1 designated host IP.
                    </span>
                  </label>

                  {/* Multiple Selected IPs */}
                  <label
                    className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      ruleScope === 'multiple'
                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 shadow'
                        : 'bg-[#161B2A] border-[#1F293D] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="ruleScope"
                        checked={ruleScope === 'multiple'}
                        onChange={() => setRuleScope('multiple')}
                        className="text-cyan-600 focus:ring-0"
                      />
                      <span className="font-bold text-slate-200">Multiple IPs</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Applies to a group of selected IPs.
                    </span>
                  </label>
                </div>

                {/* Scope: Specific IP Input */}
                {ruleScope === 'specific' && (
                  <div className="pt-2 border-t border-[#1F293D] space-y-2">
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Target IPv4 Address
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={ruleSpecificIpInput}
                        onChange={(e) => setRuleSpecificIpInput(e.target.value)}
                        placeholder="e.g. 192.168.1.105"
                        className="flex-1 px-3 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg font-mono text-slate-200 outline-none"
                      />
                      {availableIps.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) setRuleSpecificIpInput(e.target.value);
                          }}
                          className="px-2 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg text-slate-300 outline-none"
                        >
                          <option value="">Quick-select connected host...</option>
                          {availableIps.map((d) => (
                            <option key={d.ip} value={d.ip}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {/* Scope: Multiple IPs multi-select */}
                {ruleScope === 'multiple' && (
                  <div className="pt-2 border-t border-[#1F293D] space-y-2">
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Select Target IP Addresses ({ruleTargetIps.length} selected)
                    </label>

                    {availableIps.length === 0 ? (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400">
                          Enter comma-separated target IPs:
                        </p>
                        <input
                          type="text"
                          value={ruleTargetIps.join(', ')}
                          onChange={(e) =>
                            setRuleTargetIps(
                              e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                            )
                          }
                          placeholder="192.168.1.105, 192.168.1.106"
                          className="w-full px-3 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg font-mono text-slate-200 outline-none"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-[#161B2A] rounded-lg border border-[#1F293D]">
                        {availableIps.map((d) => {
                          const checked = ruleTargetIps.includes(d.ip);
                          return (
                            <label
                              key={d.ip}
                              className={`p-2 rounded border flex items-center space-x-2 cursor-pointer text-[11px] ${
                                checked
                                  ? 'bg-cyan-950 border-cyan-600 text-cyan-200'
                                  : 'bg-[#0B0F1A] border-[#1F293D] text-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRuleTargetIps([...ruleTargetIps, d.ip]);
                                  } else {
                                    setRuleTargetIps(ruleTargetIps.filter((i) => i !== d.ip));
                                  }
                                }}
                                className="rounded text-cyan-600 focus:ring-0"
                              />
                              <span className="font-mono truncate">{d.ip}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CATEGORIES SELECTION */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 block text-xs uppercase tracking-wide">
                  Select Blocking Categories
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      'Social Media',
                      'Gaming',
                      'Adult Content',
                      'Streaming',
                      'Gambling',
                      'Custom',
                    ] as ParentalCategory[]
                  ).map((cat) => {
                    const preset = CATEGORY_PRESETS[cat];
                    const selected = ruleCategories.includes(cat);

                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => handleToggleCategory(cat)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          selected
                            ? 'bg-cyan-950/60 border-cyan-500 shadow-sm'
                            : 'bg-[#0B0F1A] border-[#1F293D] text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`font-bold text-xs ${
                              selected ? 'text-slate-100' : 'text-slate-300'
                            }`}
                          >
                            {cat}
                          </span>
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="rounded text-cyan-600 focus:ring-0 cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 leading-tight">
                          {cat === 'Custom'
                            ? 'User-specified domain list'
                            : `${preset.domains.length} verified domains`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {ruleCategories.includes('Custom') && (
                  <div className="pt-2">
                    <label className="font-semibold text-slate-300 block mb-1">
                      Custom Category Name
                    </label>
                    <input
                      type="text"
                      value={ruleCustomCategoryName}
                      onChange={(e) => setRuleCustomCategoryName(e.target.value)}
                      placeholder="e.g. Cryptocurrency & Piracy"
                      className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] rounded-lg text-slate-100 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* SPECIFIC DOMAINS / WEBSITES BLOCKLIST */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-200 block text-xs uppercase tracking-wide">
                  Specific Domains / Websites to Block
                </label>
                <p className="text-[11px] text-slate-400">
                  Enter individual domain names separated by commas or newlines (e.g. <code>tiktok.com</code>, <code>bad-site.org</code>)
                </p>
                <textarea
                  rows={3}
                  value={ruleCustomDomainsText}
                  onChange={(e) => setRuleCustomDomainsText(e.target.value)}
                  placeholder="example.com&#10;subdomain.badsite.net&#10;anotherdomain.org"
                  className="w-full p-2.5 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg font-mono text-xs text-slate-200 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-[#161B2A] text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs shadow-md cursor-pointer transition-colors"
                >
                  {editingRuleId ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT ROUTER SCRIPT MODAL */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Router Deployment Scripts
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Direct commands for OpenWrt, ASUSWRT, MikroTik, and Windows host execution
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => setScriptType('bash')}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                  scriptType === 'bash' ? 'bg-cyan-600 text-white' : 'bg-[#161B2A] text-slate-300'
                }`}
              >
                Shell Script (.sh / OpenWrt / Asus)
              </button>
              <button
                onClick={() => setScriptType('powershell')}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                  scriptType === 'powershell' ? 'bg-cyan-600 text-white' : 'bg-[#161B2A] text-slate-300'
                }`}
              >
                PowerShell (.ps1 / Windows Host)
              </button>
              <button
                onClick={() => setScriptType('dnsmasq')}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                  scriptType === 'dnsmasq' ? 'bg-cyan-600 text-white' : 'bg-[#161B2A] text-slate-300'
                }`}
              >
                dnsmasq.conf (DNS Blackhole)
              </button>
            </div>

            <div className="flex-1 bg-[#080B12] p-4 rounded-xl border border-[#1F293D] font-mono text-xs text-slate-300 overflow-y-auto select-all max-h-72">
              <pre className="whitespace-pre-wrap">
                {scriptType === 'bash'
                  ? scripts.bash
                  : scriptType === 'powershell'
                  ? scripts.powershell
                  : scripts.dnsmasq}
              </pre>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  const content =
                    scriptType === 'bash'
                      ? scripts.bash
                      : scriptType === 'powershell'
                      ? scripts.powershell
                      : scripts.dnsmasq;
                  const ext = scriptType === 'bash' ? 'sh' : scriptType === 'powershell' ? 'ps1' : 'conf';
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `parental-filter-deploy.${ext}`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs shadow cursor-pointer flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download {scriptType.toUpperCase()} Script</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
