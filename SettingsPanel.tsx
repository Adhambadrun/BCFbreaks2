import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { X, Settings, Volume2, Sliders, Shield, Palette, Download, Save } from 'lucide-react';
import { playSound } from '../../lib/sound';

export const SettingsPanel: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    shiftConfig,
    updateShiftConfig,
    currentUser,
    updateUserProfile,
    exportDataJSON,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'rules' | 'sound' | 'ui' | 'data'>('rules');

  const [capacity, setCapacity] = useState(shiftConfig.breakCapacity);
  const [maxSlots, setMaxSlots] = useState(shiftConfig.maxSlots);
  const [maxSlotDuration, setMaxSlotDuration] = useState(shiftConfig.maxSlotDuration);
  const [maxTotal, setMaxTotal] = useState(shiftConfig.maxTotalBreakTime);
  const [maxWc, setMaxWc] = useState(shiftConfig.maxWCTime);
  const [restrictedFirst, setRestrictedFirst] = useState(shiftConfig.restrictedFirstHour);
  const [restrictedLast, setRestrictedLast] = useState(shiftConfig.restrictedLastHour);

  if (!isSettingsOpen) return null;

  const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'developer';

  const handleSaveRules = () => {
    updateShiftConfig({
      breakCapacity: capacity,
      maxSlots,
      maxSlotDuration,
      maxTotalBreakTime: maxTotal,
      maxWCTime: maxWc,
      restrictedFirstHour: restrictedFirst,
      restrictedLastHour: restrictedLast,
    });
    setIsSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl overflow-y-auto">
      <GlassPanel material="thick" className="w-full max-w-2xl p-6 border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-yellow-400" />
            <h2 className="font-orbitron font-bold text-xl text-zinc-100">System Preferences & Rules</h2>
          </div>
          <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-4 text-xs font-orbitron">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'rules' ? 'bg-yellow-400 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Break Rules
          </button>
          <button
            onClick={() => setActiveTab('sound')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'sound' ? 'bg-yellow-400 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sound & Audio
          </button>
          <button
            onClick={() => setActiveTab('ui')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'ui' ? 'bg-yellow-400 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            UI Customization
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'data' ? 'bg-yellow-400 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Data Export
          </button>
        </div>

        {/* TAB 1: RULES CONFIG */}
        {activeTab === 'rules' && (
          <div className="space-y-4 text-xs font-inter">
            {!isPrivileged && (
              <div className="p-3 rounded-xl bg-zinc-800/80 border border-white/10 text-zinc-400">
                🔒 Shift rules are managed by Floor Supervisors, Admins, and Developer. Read-only view for agents.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-orbitron text-zinc-300 mb-1">Max Agents on Break (Capacity)</label>
                <input
                  type="number"
                  disabled={!isPrivileged}
                  value={capacity}
                  onChange={e => setCapacity(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-orbitron text-zinc-300 mb-1">Max Slots per Shift</label>
                <input
                  type="number"
                  disabled={!isPrivileged}
                  value={maxSlots}
                  onChange={e => setMaxSlots(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-orbitron text-zinc-300 mb-1">Max Slot Duration (Minutes)</label>
                <input
                  type="number"
                  disabled={!isPrivileged}
                  value={maxSlotDuration}
                  onChange={e => setMaxSlotDuration(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-orbitron text-zinc-300 mb-1">Max Total Break Time (Minutes)</label>
                <input
                  type="number"
                  disabled={!isPrivileged}
                  value={maxTotal}
                  onChange={e => setMaxTotal(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-orbitron text-zinc-300 mb-1">Max Daily WC Time (Minutes)</label>
                <input
                  type="number"
                  disabled={!isPrivileged}
                  value={maxWc}
                  onChange={e => setMaxWc(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>
            </div>

            {isPrivileged && (
              <div className="flex justify-end pt-3">
                <button
                  onClick={handleSaveRules}
                  className="px-6 py-2.5 rounded-xl bg-yellow-400 text-black font-orbitron font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  Save Shift Rules
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SOUND & AUDIO */}
        {activeTab === 'sound' && (
          <div className="space-y-4 text-xs font-inter">
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
              <div className="font-orbitron font-bold text-sm text-yellow-400">Glass Audio Synthesizer Controls</div>
              <p className="text-zinc-400">Test the calibrated Web Audio cues modeled after glass and metal resonances:</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => playSound('break_start')}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-orbitron text-[11px] text-cyan"
                >
                  Break Start Chime
                </button>
                <button
                  onClick={() => playSound('break_end')}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-orbitron text-[11px] text-yellow-400"
                >
                  Break Return Chime
                </button>
                <button
                  onClick={() => playSound('bonus')}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-orbitron text-[11px] text-gold"
                >
                  Bonus Sparkle 🍕
                </button>
                <button
                  onClick={() => playSound('warning')}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-orbitron text-[11px] text-orange-400"
                >
                  Warning Alert
                </button>
                <button
                  onClick={() => playSound('rally')}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-orbitron text-[11px] text-crimson"
                >
                  Rally Siren 🚨
                </button>
                <button
                  onClick={() => playSound('heartbeat')}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-orbitron text-[11px] text-zinc-300"
                >
                  13m Heartbeat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: UI CUSTOMIZATION */}
        {activeTab === 'ui' && currentUser && (
          <div className="space-y-4 text-xs font-inter">
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
              <div className="font-orbitron font-bold text-sm text-zinc-200">Accessibility & Visual Fluidity</div>
              
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span>Reduced Transparency (High Contrast Solid Glass)</span>
                <input
                  type="checkbox"
                  checked={currentUser.reducedTransparency}
                  onChange={e => updateUserProfile(currentUser.email, { reducedTransparency: e.target.checked })}
                  className="w-4 h-4 rounded accent-yellow-400"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span>Reduced Motion Animations</span>
                <input
                  type="checkbox"
                  checked={currentUser.reducedMotion}
                  onChange={e => updateUserProfile(currentUser.email, { reducedMotion: e.target.checked })}
                  className="w-4 h-4 rounded accent-yellow-400"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <span>Sound Alerts Enabled</span>
                <input
                  type="checkbox"
                  checked={currentUser.soundEnabled}
                  onChange={e => updateUserProfile(currentUser.email, { soundEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-yellow-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DATA EXPORT */}
        {activeTab === 'data' && (
          <div className="space-y-4 text-xs font-inter">
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
              <div className="font-orbitron font-bold text-sm text-cyan">Instant Data Export</div>
              <p className="text-zinc-400">Download complete structured shift logs, agent audit trails, and break records:</p>

              <button
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportDataJSON());
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `break_export_${Date.now()}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                  playSound('click');
                }}
                className="px-6 py-2.5 rounded-xl bg-cyan hover:bg-cyan/90 text-black font-orbitron font-bold text-xs flex items-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" />
                Download JSON Shift Report
              </button>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
};
