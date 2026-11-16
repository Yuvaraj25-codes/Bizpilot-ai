import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { ChatMessage } from '../../shared/types.ts';

interface AiPilotViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  sending: boolean;
}

const STARTER_PROMPTS = [
  'What is my net profit, gross margin, and biggest expense category over the last 30 days?',
  'Which SKUs are low on stock or out of stock right now?',
  'Record a $145 Marketing expense for LinkedIn Sponsored Ops',
  'Create a completed order for Stellar Labs for 1 Lumix 27" 4K IPS Studio Monitor',
];

export function AiPilotView({
  messages,
  onSendMessage,
  sending,
}: AiPilotViewProps) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const submitText = async (text: string) => {
    if (!text.trim() || sending) return;
    setInput('');
    await onSendMessage(text.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitText(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9.5rem)] min-h-[520px] bg-[#162033] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Pilot Header */}
      <div className="px-5 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center text-[#06B6D4]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              BizPilot AI Pilot
            </h2>
            <p className="text-xs text-slate-400">
              Ask profit &amp; stock questions or command expense, order, and invoice actions
            </p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#06B6D4]">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Operational Co-Pilot Ready
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Connected directly to your live inventory catalog, order book,
                expense ledger, and invoicing engine.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitText(prompt)}
                  className="p-3.5 rounded-xl bg-[#101828] hover:bg-[#101828]/80 border border-white/[0.08] hover:border-[#3B82F6]/50 text-xs text-slate-300 hover:text-white transition-colors text-left cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#101828] border border-white/[0.08] text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.actionsTaken && msg.actionsTaken.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.1] space-y-1.5">
                    {msg.actionsTaken.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs text-[#22D3EE] font-mono"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{act.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-[#101828] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs text-slate-300">
              <Loader2 className="w-4 h-4 text-[#06B6D4] animate-spin" />
              <span>Analyzing live workspace &amp; executing tools...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-[#101828] border-t border-white/[0.08] flex items-center gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ask about profit, stock risks, or type 'Record a $90 Software expense for Figma'..."
          className="flex-1 px-4 py-2.5 text-sm bg-[#162033] border border-white/[0.1] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#3B82F6]"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
