import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Cloud,
  Database,
  Download,
  LogIn,
  LogOut,
  RotateCcw,
  Save,
  Shield,
} from 'lucide-react';
import type {
  CurrencyCode,
  WorkspaceData,
  WorkspaceSettings,
} from '../../shared/types.ts';
import { formatDateTime } from '../lib/formatters.ts';

interface SettingsViewProps {
  workspace: WorkspaceData;
  firebaseUser: User | null;
  firebaseSyncing: boolean;
  firebaseError: string | null;
  onFirebaseSignIn: () => Promise<void>;
  onFirebaseSignOut: () => Promise<void>;
  onSaveSettings: (patch: Partial<WorkspaceSettings>) => Promise<void>;
  onResetSession: () => Promise<void>;
  onCloudSync: (syncCode: string, direction: 'push' | 'pull') => Promise<void>;
}

export function SettingsView({
  workspace,
  firebaseUser,
  firebaseSyncing,
  firebaseError,
  onFirebaseSignIn,
  onFirebaseSignOut,
  onSaveSettings,
  onResetSession,
  onCloudSync,
}: SettingsViewProps) {
  const s = workspace.settings;
  const [businessName, setBusinessName] = useState(s.businessName);
  const [currency, setCurrency] = useState<CurrencyCode>(s.currency);
  const [publicMode, setPublicMode] = useState(s.publicMode);
  const [telemetryAlerts, setTelemetryAlerts] = useState(s.telemetryAlerts);
  const [lowStockDefault, setLowStockDefault] = useState(
    String(s.lowStockDefault)
  );
  const [syncCode, setSyncCode] = useState(s.syncCode || 'PUBLIC-DEMO');

  useEffect(() => {
    setBusinessName(s.businessName);
    setCurrency(s.currency);
    setPublicMode(s.publicMode);
    setTelemetryAlerts(s.telemetryAlerts);
    setLowStockDefault(String(s.lowStockDefault));
    setSyncCode(s.syncCode || 'PUBLIC-DEMO');
  }, [
    s.businessName,
    s.currency,
    s.publicMode,
    s.telemetryAlerts,
    s.lowStockDefault,
    s.syncCode,
  ]);

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveSettings({
        businessName: businessName.trim() || 'BizPilot Hardware & Ops',
        currency,
        publicMode,
        telemetryAlerts,
        lowStockDefault: Math.max(0, Number(lowStockDefault) || 10),
      });
      setFeedback('Workspace settings saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (direction: 'push' | 'pull') => {
    if (!syncCode.trim()) return;
    setSyncing(true);
    setFeedback(null);
    try {
      await onCloudSync(syncCode.trim(), direction);
      setFeedback(
        direction === 'push'
          ? `Snapshot synced to cloud workspace "${syncCode.trim().toUpperCase()}".`
          : `Pulled workspace snapshot from "${syncCode.trim().toUpperCase()}".`
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadBackup = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bizpilot_backup_${workspace.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl space-y-6">
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Firebase Authentication & Real-Time Firestore Sync */}
      <div className="bg-[#162033] border border-[#3B82F6]/30 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-[#06B6D4] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-white">
                Firebase Cloud Sync
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {firebaseUser
                  ? 'Live Firestore persistence and real-time multi-device sync active'
                  : 'Sign in with Google to persist inventory, orders, expenses, and invoices in your private Firebase Firestore database'}
              </p>
            </div>
          </div>

          {firebaseUser ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={async () => {
                setAuthBusy(true);
                setFeedback(null);
                try {
                  await onFirebaseSignOut();
                  setFeedback('Signed out. Switched back to public demo workspace.');
                } finally {
                  setAuthBusy(false);
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-200 bg-[#101828] hover:bg-white/[0.06] border border-white/[0.12] rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{authBusy ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={async () => {
                setAuthBusy(true);
                setFeedback(null);
                try {
                  await onFirebaseSignIn();
                } finally {
                  setAuthBusy(false);
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>
                {authBusy ? 'Connecting...' : 'Sign In with Google'}
              </span>
            </button>
          )}
        </div>

        {firebaseError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {firebaseError}
          </div>
        )}

        {firebaseUser && (
          <div className="p-3.5 rounded-lg bg-[#101828] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-medium text-white">
                {firebaseUser.displayName || 'Workspace Owner'}
              </p>
              <p className="text-slate-400 font-mono">{firebaseUser.email}</p>
            </div>
            <span className="font-mono text-[#22D3EE]">
              {firebaseSyncing ? 'Syncing Firestore...' : 'Firestore Connected'}
            </span>
          </div>
        )}
      </div>

      {/* Workspace & Privacy Shield */}
      <form
        onSubmit={handleSave}
        className="bg-[#162033] border border-white/[0.08] rounded-xl p-6 space-y-5"
      >
        <div>
          <h2 className="text-base font-semibold text-white">
            Workspace &amp; Privacy Controls
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure organization branding, currency, and Public Mode masking
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Default Low-Stock Alert Threshold
          </label>
          <input
            type="number"
            min="0"
            value={lowStockDefault}
            onChange={(e) => setLowStockDefault(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div className="pt-4 border-t border-white/[0.08] space-y-4">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-[#06B6D4] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">
                  Public Mode &amp; Privacy Shield
                </p>
                <p className="text-xs text-slate-400">
                  Masks sensitive net profits, unit costs, COGS, and customer phone numbers across all views
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={publicMode}
              onChange={(e) => setPublicMode(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-[#101828] text-[#3B82F6]"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-white">
                In-App Low-Stock &amp; Order Alerts
              </p>
              <p className="text-xs text-slate-400">
                Highlight low-stock SKUs and fulfillment reminders in the workspace
              </p>
            </div>
            <input
              type="checkbox"
              checked={telemetryAlerts}
              onChange={(e) => setTelemetryAlerts(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-[#101828] text-[#3B82F6]"
            />
          </label>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Workspace Settings'}</span>
          </button>
        </div>
      </form>

      {/* Public Session Sync Key & Backup */}
      <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-[#3B82F6] mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-white">
                {firebaseUser
                  ? 'Export JSON Backup'
                  : 'Optional Cloud Sync Key'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {firebaseUser
                  ? 'Download a portable JSON snapshot of your Firestore-synced workspace at any time'
                  : 'Link a custom sync code to persist and restore the public workspace without signing in'}
              </p>
            </div>
          </div>
          {s.lastSyncedAt && (
            <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
              Synced {formatDateTime(s.lastSyncedAt)}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!firebaseUser && (
            <>
              <input
                type="text"
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value)}
                placeholder="MY-TEAM-KEY"
                className="flex-1 px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono uppercase focus:outline-none focus:border-[#3B82F6]"
              />
              <button
                type="button"
                disabled={syncing}
                onClick={() => handleSync('push')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Push to Cloud Key
              </button>
              <button
                type="button"
                disabled={syncing}
                onClick={() => handleSync('pull')}
                className="px-4 py-2 text-xs font-medium text-slate-200 bg-[#101828] hover:bg-white/[0.06] border border-white/[0.1] rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Pull from Key
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#101828] hover:bg-white/[0.06] border border-white/[0.1] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON Backup</span>
          </button>
        </div>
      </div>

      {/* Reset Workspace */}
      <div className="bg-[#162033] border border-rose-500/25 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            {firebaseUser ? 'Reset Cloud Workspace' : 'Reset Public Session'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Restore catalog SKUs, sample orders, expenses, and invoices back to clean demo defaults
          </p>
        </div>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {firebaseUser ? 'Reset Cloud Workspace' : 'Reset Public Session'}
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3 py-2 text-xs font-medium text-slate-300 border border-white/[0.1] rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await onResetSession();
                setConfirmReset(false);
                setFeedback(
                  firebaseUser
                    ? 'Firestore workspace restored to fresh defaults.'
                    : 'Public session restored to fresh defaults.'
                );
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer"
            >
              Confirm Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
