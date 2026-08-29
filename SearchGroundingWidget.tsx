import React, { useState } from 'react';
import { GlassPanel } from '../shared/GlassPanel';
import { Search, Globe, ExternalLink, Sparkles, Loader2, Plane, Clock, CloudSun, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { playSound } from '../../lib/sound';

interface SearchGroundingWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchGroundingWidget: React.FC<SearchGroundingWidgetProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    text: string;
    searchQueries: string[];
    sources: Array<{ uri: string; title: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    playSound('click');

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      playSound('notification');
    } catch (err: any) {
      console.error('Grounding search failed:', err);
      setError(err.message || 'Failed to retrieve live grounded data.');
    } finally {
      setLoading(false);
    }
  };

  const trendingQueries = [
    { label: 'Cairo Weather & Local Time', icon: <CloudSun className="w-3.5 h-3.5 text-yellow-400" />, q: 'Current Cairo Egypt exact local time, weather forecast, and shift hours' },
    { label: 'Airline Strikes & Flight Delays', icon: <Plane className="w-3.5 h-3.5 text-crimson" />, q: 'Major international airline disruptions, cancellations, and strike notices today' },
    { label: 'US-UK Business Class Deals', icon: <Sparkles className="w-3.5 h-3.5 text-cyan" />, q: 'Latest average trans-Atlantic business class airfares JFK to LHR' },
    { label: 'Schengen Visa Entry Updates', icon: <Globe className="w-3.5 h-3.5 text-emerald-400" />, q: 'Latest 2026 European travel authorization and visa rules for business passengers' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl overflow-y-auto">
      <GlassPanel
        material="thick"
        concentricRadius="xl"
        className="w-full max-w-2xl p-6 border-2 border-cyan/40 shadow-[0_0_90px_rgba(0,229,255,0.25)] space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan/20 border border-cyan/50 flex items-center justify-center text-cyan">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="font-orbitron font-black text-lg text-white flex items-center gap-2">
                Floor Intelligence & Search Grounding
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan/20 border border-cyan/40 text-cyan">
                  gemini-3.5-flash + Google Search
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-inter">
                Real-time web search grounding for live flight data, weather, disruptions, and airline facts
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSearch(query);
          }}
          className="relative flex items-center"
        >
          <Search className="absolute left-4 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search live flight intelligence, weather, airline baggage limits..."
            className="w-full pl-11 pr-28 py-3 bg-black/60 border border-white/20 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan transition-all"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 px-4 py-1.5 rounded-lg bg-cyan hover:bg-cyan-400 text-black font-orbitron font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Ground</span>
          </button>
        </form>

        {/* Quick Trending Intelligence Chips */}
        <div className="space-y-2">
          <div className="text-[10px] font-orbitron text-zinc-400 uppercase tracking-wider">
            Quick Shift Intelligence Queries
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {trendingQueries.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(item.q);
                  executeSearch(item.q);
                }}
                className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 text-left transition-all group"
              >
                {item.icon}
                <span className="truncate flex-1 font-medium">{item.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Grounded Result Display */}
        {result && (
          <div className="p-4 rounded-2xl bg-black/60 border border-white/15 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-xs font-orbitron text-cyan font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Live Grounded Synthesis
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                Verified with Google Search
              </span>
            </div>

            {/* Answer Content */}
            <div className="text-xs text-zinc-200 leading-relaxed font-inter whitespace-pre-wrap">
              {result.text}
            </div>

            {/* Web Search Queries & Citations */}
            {result.sources && result.sources.length > 0 && (
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="text-[10px] font-orbitron text-zinc-400 uppercase tracking-wider">
                  Grounding Sources & Real-World Web References
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-cyan hover:underline"
                    >
                      <Globe className="w-3 h-3" />
                      <span className="max-w-[200px] truncate">{src.title || src.uri}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};
