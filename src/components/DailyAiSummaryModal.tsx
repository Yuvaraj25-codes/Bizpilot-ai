import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AnalyticsSummary,
  CurrencyCode,
  DailyAiBrief,
} from '../../shared/types.ts';
import { formatDateTime, formatMoney } from '../lib/formatters.ts';

interface DailyAiSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: DailyAiBrief | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
  onOpenPilot: () => void;
  todayBenchmark: AnalyticsSummary['todayBenchmark'];
  currency: CurrencyCode;
  publicMode: boolean;
}

export function DailyAiSummaryModal({
  isOpen,
  onClose,
  brief,
  loading,
  error,
  onRegenerate,
  onOpenPilot,
  todayBenchmark,
  currency,
  publicMode,
}: DailyAiSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-ai-brief-title"
    >
      <div className="w-full max-w-2xl bg-[#162033] border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center text-[#06B6D4]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="daily-ai-brief-title"
                className="text-base font-semibold text-white"
              >
                Daily AI Performance Brief
              </h2>
              <p className="text-xs text-slate-400">
                Gemini 4 Hydrogen live workspace synthesis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Today Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 bg-[#121c2e] border-b border-white/[0.08]">
          <div>
            <p className="text-xs text-slate-400">Today Revenue</p>
            <p className="text-sm font-semibold text-white font-mono tabular-nums mt-0.5">
              {formatMoney(todayBenchmark.todayRevenue, currency, false)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Today COGS</p>
            <p className="text-sm font-semibold text-slate-200 font-mono tabular-nums mt-0.5">
              {formatMoney(todayBenchmark.todayCogs, currency, publicMode)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Today Expenses</p>
            <p className="text-sm font-semibold text-slate-200 font-mono tabular-nums mt-0.5">
              {formatMoney(todayBenchmark.todayExpenses, currency, false)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Today Net Profit</p>
            <p className="text-sm font-semibold text-[#06B6D4] font-mono tabular-nums mt-0.5">
              {formatMoney(todayBenchmark.todayNetProfit, currency, publicMode)}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <Loader2 className="w-8 h-8 text-[#06B6D4] animate-spin" />
              <p className="text-sm text-slate-200 font-medium">
                Synthesizing live revenue, margins, and inventory risks...
              </p>
              <p className="text-xs text-slate-400">
                Comparing today against your 7-day benchmark
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">
                    Unable to generate AI Brief
                  </p>
                  <p className="text-xs text-rose-200/80 mt-1">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRegenerate}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white transition-colors cursor-pointer"
              >
                Retry Brief
              </button>
            </div>
          ) : brief ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-white leading-snug max-w-lg">
                  {brief.headline}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    brief.healthStatus === 'Strong'
                      ? 'text-emerald-400'
                      : brief.healthStatus === 'Attention Needed'
                      ? 'text-amber-400'
                      : 'text-[#06B6D4]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{brief.healthStatus}</span>
                </span>
              </div>

              <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
                <div className="p-4 rounded-xl bg-[#101828] border border-white/[0.06]">
                  <p className="text-xs font-medium text-[#3B82F6] mb-1">
                    Executive Summary
                  </p>
                  <p>{brief.executiveSummary}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#101828] border border-white/[0.06]">
                    <p className="text-xs font-medium text-emerald-400 mb-1">
                      Wins Highlight
                    </p>
                    <p className="text-slate-300">{brief.winsHighlight}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#101828] border border-white/[0.06]">
                    <p className="text-xs font-medium text-amber-400 mb-1">
                      Stock & Margin Risk Alert
                    </p>
                    <p className="text-slate-300">{brief.riskAlert}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/30">
                  <p className="text-xs font-medium text-[#22D3EE] mb-1">
                    Recommended Next Action
                  </p>
                  <p className="text-white">{brief.recommendedAction}</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 font-mono">
                Generated {formatDateTime(brief.generatedAt)}
              </p>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#101828] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-white/[0.1] hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Brief</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPilot();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors cursor-pointer"
          >
            <span>Act in AI Pilot</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
