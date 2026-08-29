import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { Zap, Terminal, ShieldAlert, Sliders, RefreshCw, Download, Database, Flame, X, Check, ToggleLeft, ToggleRight, Radio } from 'lucide-react';
import { playSound } from '../../lib/sound';

export const GodModePanel: React.FC = () => {
  const {
    isGodModeOpen,
    setIsGodModeOpen,
    teams,
    users,
    breaks,
    auditLogs,
    shiftConfig,
    updateShiftConfig,
    triggerRallyMode,
    endRallyMode,
    resetAllBreaks,
    exportDataJSON,
    loginAs,
    currentUser,
    openModal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'actions' | 'toggles'>('overview');
  const [rallyDuration, setRallyDuration] = useState(10);
  const [rallyMsg, setRallyMsg] = useState('ALL HANDS ON DECK! Close the pending airline leads now!');

  if (!isGodModeOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-3xl overflow-y-auto">
      <GlassPanel material="ultrathick" className="w-full max-w-6xl max-h-[92vh] flex flex-col p-6 border-2 border-yellow-400/60 shadow-[0_0_80px_rgba(255,204,0,0.3)]">
        {/* TOP HEADER DECK */}
        <div className="flex items-center justify-between border-b border-yellow-400/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-yellow-400/20 border border-yellow-400 text-yellow-400 shadow-[0_0_20px_rgba(255,204,0,0.5)]">
              <Zap className="w-6 h-6 fill-yellow-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-orbitron font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-white">
                  DEVELOPER GOD MODE COMMAND DECK
                </h2>
                <span className="text-[10px] font-orbitron font-extrabold px-2 py-0.5 rounded-full bg-crimson text-white">
                  TIER 1 HARDCODED
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-inter">
                Operated by <span className="text-yellow-400 font-bold">{currentUser?.name}</span> ({currentUser?.email}) · Unlimited Superuser Override
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsGodModeOpen(false)}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-white/10 py-3 text-xs font-orbitron">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'overview'
                ? 'bg-yellow-400 text-black font-extrabold shadow-lg'
                : 'hover:bg-zinc-800 text-zinc-300'
            }`}
          >
            System Overview
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'logs'
                ? 'bg-yellow-400 text-black font-extrabold shadow-lg'
                : 'hover:bg-zinc-800 text-zinc-300'
            }`}
          >
            Live Logs Terminal
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'actions'
                ? 'bg-yellow-400 text-black font-extrabold shadow-lg'
                : 'hover:bg-zinc-800 text-zinc-300'
            }`}
          >
            Quick Actions & Rally Mode
          </button>
          <button
            onClick={() => setActiveTab('toggles')}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'toggles'
                ? 'bg-yellow-400 text-black font-extrabold shadow-lg'
                : 'hover:bg-zinc-800 text-zinc-300'
            }`}
          >
            Feature Toggles
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* TAB 1: SYSTEM OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold text-sm text-yellow-400">Active Teams Matrix</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsGodModeOpen(false);
                      openModal('manageTeams');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs font-orbitron hover:bg-yellow-400/30 transition-colors"
                  >
                    ⚙️ Manage Teams & Pods
                  </button>
                  <button
                    onClick={() => {
                      setIsGodModeOpen(false);
                      openModal('addAgent');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan/20 border border-cyan/40 text-cyan text-xs font-orbitron hover:bg-cyan/30 transition-colors"
                  >
                    + Add Agent Pod
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {teams.map(t => (
                  <GlassPanel key={t.teamId} material="regular" className="p-4 border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <img src={t.teamLogo} alt={t.teamName} className="w-6 h-6 rounded-full object-cover border" style={{ borderColor: t.teamColorAccent }} referrerPolicy="no-referrer" />
                          <span className="font-orbitron font-bold text-sm text-zinc-100">{t.teamName}</span>
                        </div>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: t.teamColorAccent }}
                        />
                      </div>
                      <div className="text-2xl font-teko text-yellow-400 font-bold">
                        {breaks.filter(b => b.teamId === t.teamId && b.isActive).length} / {shiftConfig.breakCapacity} Active Breaks
                      </div>
                      <div className="text-xs text-zinc-400 font-inter">
                        Supervisor: {t.supervisorEmail.split('@')[0]} · {users.filter(u => u.teamId === t.teamId && u.role === 'agent').length} Pods
                      </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setIsGodModeOpen(false);
                          openModal('editTeam', t);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-yellow-300 text-[10px] font-orbitron"
                      >
                        Edit Profile
                      </button>
                    </div>
                  </GlassPanel>
                ))}
              </div>

              {/* Impersonation Matrix */}
              <GlassPanel material="regular" className="p-5 border border-white/10">
                <h3 className="font-orbitron font-bold text-sm text-yellow-400 mb-3">
                  Superuser Instant Impersonation Matrix
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        loginAs(u.email);
                        playSound('click');
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs border transition-all ${
                        currentUser?.email === u.email
                          ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300 font-bold'
                          : 'bg-black/40 border-white/10 hover:border-yellow-400/50 text-zinc-300'
                      }`}
                    >
                      <img
                        src={u.avatarUrl}
                        alt={u.name}
                        className="w-6 h-6 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="truncate">
                        <div className="truncate font-semibold">{u.name}</div>
                        <div className="text-[9px] font-orbitron text-zinc-500 uppercase">{u.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </GlassPanel>
            </div>
          )}

          {/* TAB 2: LIVE LOGS TERMINAL */}
          {activeTab === 'logs' && (
            <div className="bg-black border border-emerald-500/40 rounded-2xl p-4 font-mono text-xs text-emerald-400 shadow-2xl h-[420px] overflow-y-auto space-y-2">
              <div className="text-zinc-500 pb-2 border-b border-zinc-800 flex items-center justify-between">
                <span>[STREAMING EVENT TELEMETRY LOGS — ISO 8601 UTC+2]</span>
                <span className="text-emerald-500 font-bold animate-pulse">● LIVE</span>
              </div>
              {auditLogs.length === 0 ? (
                <div className="text-zinc-500 italic py-6 text-center">No system events logged yet. Triggering actions will populate here live.</div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.logId} className="hover:bg-zinc-900/60 p-1 rounded transition-colors flex items-start gap-2">
                    <span className="text-zinc-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-yellow-400 font-semibold">{log.action.toUpperCase()}</span>
                    <span className="text-cyan">{log.performedBy}</span>
                    <span className="text-zinc-300">→</span>
                    <span className="text-zinc-400">{JSON.stringify(log.details)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: QUICK ACTIONS & RALLY MODE */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* RALLY MODE SECTION */}
              <GlassPanel material="thick" className="p-6 border-2 border-crimson/60 bg-crimson/5">
                <div className="flex items-center gap-3 mb-3">
                  <Flame className="w-6 h-6 text-crimson animate-pulse" />
                  <h3 className="font-orbitron font-extrabold text-lg text-crimson">
                    FLOOR RALLY MODE CONTROL
                  </h3>
                </div>
                <p className="text-xs text-zinc-300 font-inter mb-4">
                  Rally Mode instantly locks all break punches floor-wide with an urgent full-screen red warning overlay.
                </p>

                {shiftConfig.rallyModeActive ? (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-crimson/20 border border-crimson">
                    <div>
                      <div className="font-orbitron font-bold text-white text-sm">RALLY MODE ACTIVE!</div>
                      <div className="text-xs text-zinc-300">{shiftConfig.rallyModeMessage}</div>
                    </div>
                    <button
                      onClick={endRallyMode}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-orbitron font-black text-xs shadow-lg transition-transform hover:scale-105"
                    >
                      END RALLY MODE
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={rallyMsg}
                      onChange={e => setRallyMsg(e.target.value)}
                      className="flex-1 bg-black/70 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-crimson"
                    />
                    <select
                      value={rallyDuration}
                      onChange={e => setRallyDuration(Number(e.target.value))}
                      className="bg-black/70 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                    >
                      <option value={5}>5 Minutes</option>
                      <option value={10}>10 Minutes</option>
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                    </select>
                    <button
                      onClick={() => triggerRallyMode(rallyDuration, rallyMsg)}
                      className="px-6 py-2.5 rounded-xl bg-crimson hover:bg-red-600 text-white font-orbitron font-black text-xs shadow-[0_0_20px_#FF003C] transition-transform hover:scale-105 shrink-0"
                    >
                      TRIGGER RALLY 🚨
                    </button>
                  </div>
                )}
              </GlassPanel>

              {/* DANGEROUS SYSTEM ACTIONS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to RESET all active and logged breaks for this shift?')) {
                      resetAllBreaks();
                    }
                  }}
                  className="p-5 rounded-2xl bg-crimson/10 border border-crimson/40 hover:bg-crimson/20 text-left transition-all group"
                >
                  <RefreshCw className="w-6 h-6 text-crimson mb-2 group-hover:rotate-180 transition-transform duration-500" />
                  <div className="font-orbitron font-bold text-sm text-crimson">RESET ALL BREAKS</div>
                  <div className="text-[11px] text-zinc-400 font-inter mt-1">Clears all active breaks and returns all agents to available status</div>
                </button>

                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportDataJSON());
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `break_app_export_${Date.now()}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    playSound('click');
                  }}
                  className="p-5 rounded-2xl bg-cyan/10 border border-cyan/40 hover:bg-cyan/20 text-left transition-all"
                >
                  <Download className="w-6 h-6 text-cyan mb-2" />
                  <div className="font-orbitron font-bold text-sm text-cyan">BACKUP / EXPORT JSON</div>
                  <div className="text-[11px] text-zinc-400 font-inter mt-1">Complete instant snapshot of all teams, users, warnings & shift logs</div>
                </button>

                <button
                  onClick={() => {
                    updateShiftConfig({ maintenanceMode: !shiftConfig.maintenanceMode });
                    playSound('click');
                  }}
                  className="p-5 rounded-2xl bg-yellow-400/10 border border-yellow-400/40 hover:bg-yellow-400/20 text-left transition-all"
                >
                  <Database className="w-6 h-6 text-yellow-400 mb-2" />
                  <div className="font-orbitron font-bold text-sm text-yellow-400">
                    MAINTENANCE MODE: {shiftConfig.maintenanceMode ? 'ON' : 'OFF'}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-inter mt-1">Locks app for all agents with custom maintenance screen</div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: FEATURE TOGGLES */}
          {activeTab === 'toggles' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(shiftConfig.featuresEnabled).map(([key, enabled]) => (
                <GlassPanel
                  key={key}
                  material="regular"
                  className="p-4 flex items-center justify-between border border-white/10"
                >
                  <div>
                    <div className="font-orbitron font-bold text-xs text-zinc-200 uppercase tracking-wider">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div className="text-[10px] text-zinc-400">System module toggle</div>
                  </div>
                  <button
                    onClick={() => {
                      updateShiftConfig({
                        featuresEnabled: {
                          ...shiftConfig.featuresEnabled,
                          [key]: !enabled,
                        },
                      });
                      playSound('click');
                    }}
                    className={`p-2 rounded-xl transition-all ${
                      enabled ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  >
                    {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
};
