import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { X, Search, Zap, AlertTriangle, Gift, Crown, AlertOctagon, Smile, Sun, Cake } from 'lucide-react';
import { SNNHeadline } from '../../types';

export const NewsPanel: React.FC = () => {
  const { isNewsPanelOpen, setIsNewsPanelOpen, headlines } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isNewsPanelOpen) return null;

  const filteredHeadlines = headlines.filter(hl => {
    const matchesCat = selectedCategory === 'all' || hl.category === selectedCategory;
    const matchesSearch = hl.headlineText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'break': return <Zap className="w-4 h-4 text-cyan shrink-0" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />;
      case 'bonus': return <Gift className="w-4 h-4 text-gold shrink-0" />;
      case 'achievement': return <Crown className="w-4 h-4 text-gold shrink-0" />;
      case 'alert': return <AlertOctagon className="w-4 h-4 text-crimson shrink-0" />;
      case 'weather': return <Sun className="w-4 h-4 text-cyan shrink-0" />;
      case 'birthday': return <Cake className="w-4 h-4 text-pink-400 shrink-0" />;
      default: return <Smile className="w-4 h-4 text-zinc-300 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
      <GlassPanel material="thick" className="w-full max-w-2xl max-h-[85vh] flex flex-col p-6 border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-crimson font-orbitron font-bold text-xs text-white shadow-[0_0_10px_#FF003C]">
              SNN FEED
            </div>
            <h2 className="font-orbitron font-bold text-xl text-zinc-100">Live Sales Floor Telemetry Stream</h2>
          </div>
          <button onClick={() => setIsNewsPanelOpen(false)} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs & Search */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-orbitron">
            {['all', 'break', 'warning', 'bonus', 'achievement', 'fun'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl uppercase transition-all ${
                  selectedCategory === cat
                    ? 'bg-yellow-400 text-black font-extrabold shadow-md'
                    : 'bg-black/40 border border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search shift headlines..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        {/* Headlines List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-inter text-xs">
          {filteredHeadlines.length === 0 ? (
            <div className="text-center text-zinc-500 py-10 italic">No matching headlines found.</div>
          ) : (
            filteredHeadlines.map(hl => (
              <div
                key={hl.headlineId}
                className="p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition-all flex items-start gap-3"
              >
                {getCategoryIcon(hl.category)}
                <div className="flex-1">
                  <div className={`font-semibold ${hl.priority === 'critical' ? 'text-crimson' : hl.priority === 'urgent' ? 'text-yellow-300' : 'text-zinc-200'}`}>
                    {hl.headlineText}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1 font-orbitron">
                    {new Date(hl.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {hl.category.toUpperCase()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassPanel>
    </div>
  );
};
