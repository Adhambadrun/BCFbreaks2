import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { Users, Clock, AlertTriangle, ShieldCheck, TrendingUp, Search, Plus, Radio, Award, AlertOctagon, UserPlus, Sliders } from 'lucide-react';
import { playSound } from '../../lib/sound';
import { BreakEfficiencyChart } from './BreakEfficiencyChart';

export const AdminDashboard: React.FC = () => {
  const {
    users,
    teams,
    activeTeamId,
    setActiveTeamId,
    breaks,
    warnings,
    openModal,
    shiftConfig,
    currentUser,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'agent' | 'supervisor'>('all');

  const team = teams.find(t => t.teamId === activeTeamId) || teams[0];
  const allTeamAgents = users.filter(u => u.teamId === activeTeamId && (selectedRoleFilter === 'all' || u.role === selectedRoleFilter));

  const filteredAgents = allTeamAgents.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeBreaks = breaks.filter(b => b.teamId === activeTeamId && b.isActive);
  const totalBreaksToday = breaks.filter(b => b.teamId === activeTeamId).length;
  const activeWarningsCount = warnings.filter(w => w.teamId === activeTeamId && w.status === 'active').length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header Row with Title and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md bg-yellow-400/20 text-yellow-400 font-orbitron text-xs font-bold border border-yellow-400/40 uppercase">
              Admin Deck
            </span>
            <h1 className="font-orbitron font-extrabold text-2xl md:text-3xl text-zinc-100">
              Sales Floor Command & Analytics
            </h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1 font-inter">
            Real-time oversight for <span className="text-yellow-400 font-semibold">{team.teamName}</span> and cross-team shifts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => openModal('editTeam', team)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400/40 text-yellow-300 text-xs font-orbitron font-semibold shadow-lg transition-all"
          >
            <span>✏️</span>
            Edit Team
          </button>
          <button
            onClick={() => openModal('manageTeams')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-zinc-200 text-xs font-orbitron font-semibold shadow-lg transition-all"
          >
            <span>⚙️</span>
            Manage Teams & Pods
          </button>
          <button
            onClick={() => openModal('addAgent', { teamId: activeTeamId })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan/20 hover:bg-cyan/30 border border-cyan/50 text-white text-xs font-orbitron font-semibold shadow-lg transition-all"
          >
            <UserPlus className="w-4 h-4 text-cyan" />
            + Add Agent Pod
          </button>
          <button
            onClick={() => openModal('broadcast')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-crimson/20 hover:bg-crimson/30 border border-crimson/50 text-white text-xs font-orbitron font-semibold shadow-lg transition-all"
          >
            <Radio className="w-4 h-4 text-crimson" />
            Broadcast
          </button>
        </div>
      </div>

      {/* TOP STATS ROW (5 Cards per Part 16) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <GlassPanel material="regular" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-orbitron">
            <span>FLOOR CAPACITY</span>
            <Users className="w-4 h-4 text-cyan" />
          </div>
          <div className="font-teko text-3xl md:text-4xl text-cyan font-bold mt-2">
            {activeBreaks.length} / {shiftConfig.breakCapacity}
          </div>
          <div className="text-[10px] text-zinc-400 font-inter">Agents currently punched out</div>
        </GlassPanel>

        <GlassPanel material="regular" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-orbitron">
            <span>TOTAL BREAKS</span>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="font-teko text-3xl md:text-4xl text-yellow-400 font-bold mt-2">
            {totalBreaksToday}
          </div>
          <div className="text-[10px] text-emerald-400 font-inter">▲ 14% shift activity</div>
        </GlassPanel>

        <GlassPanel material="regular" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-orbitron">
            <span>ACTIVE WARNINGS</span>
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="font-teko text-3xl md:text-4xl text-orange-400 font-bold mt-2">
            {activeWarningsCount}
          </div>
          <div className="text-[10px] text-zinc-400 font-inter">Across team members</div>
        </GlassPanel>

        <GlassPanel material="regular" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-orbitron">
            <span>TEAM SCORE</span>
            <Award className="w-4 h-4 text-gold" />
          </div>
          <div className="font-teko text-3xl md:text-4xl text-gold font-bold mt-2">
            {team.competitionScore}
          </div>
          <div className="text-[10px] text-zinc-400 font-inter">Floor Competition Leader</div>
        </GlassPanel>

        <GlassPanel material="regular" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-orbitron">
            <span>SYSTEM STATUS</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-orbitron text-xl md:text-2xl text-emerald-400 font-extrabold mt-3">
            ONLINE
          </div>
          <div className="text-[10px] text-zinc-400 font-inter">Military sync active</div>
        </GlassPanel>
      </div>

      {/* 7-DAY BREAK EFFICIENCY & COMPLIANCE TREND GRAPH */}
      <BreakEfficiencyChart
        breaks={breaks}
        shiftConfig={shiftConfig}
        teamId={activeTeamId}
        teamName={team.teamName}
      />

      {/* LIVE AGENTS STATUS TABLE */}
      <GlassPanel material="thick" className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-orbitron font-bold text-lg text-zinc-100">Live Agent Floor Telemetry</h3>
            <p className="text-xs text-zinc-400 font-inter">Click any agent row to inspect full shift history and manage status</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search agent name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-yellow-400 w-60"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-inter">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 font-orbitron text-[10px] uppercase tracking-wider">
                <th className="py-3 px-3">Agent</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Total Time</th>
                <th className="py-3 px-3">Slots (5 max)</th>
                <th className="py-3 px-3">WC Today</th>
                <th className="py-3 px-3">Warnings</th>
                <th className="py-3 px-3">Bonuses</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAgents.map(agent => {
                const activeBreak = breaks.find(b => b.agentEmail === agent.email && b.isActive);
                const agentBreaks = breaks.filter(b => b.agentEmail === agent.email && b.date === new Date().toISOString().split('T')[0]);
                const totalMinutes = agentBreaks.reduce((acc, b) => acc + Math.round(b.duration / 60), 0);
                const agentWarns = warnings.filter(w => w.agentEmail === agent.email && w.status === 'active');

                return (
                  <tr
                    key={agent.id}
                    onClick={() => openModal('agentDetail', { agent })}
                    className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 flex items-center gap-2.5">
                      <img
                        src={agent.avatarUrl}
                        alt={agent.name}
                        className="w-8 h-8 rounded-full object-cover border border-white/15"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="font-orbitron font-semibold text-zinc-200">{agent.name}</div>
                        <div className="text-[10px] text-zinc-400 truncate max-w-[150px]">{agent.email}</div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {activeBreak ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan/20 border border-cyan/40 text-cyan text-[10px] font-orbitron font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-ping" />
                          {activeBreak.breakType.toUpperCase()} ({Math.floor(activeBreak.duration / 60)}m)
                        </span>
                      ) : agent.isBlocked ? (
                        <span className="px-2 py-0.5 rounded-full bg-crimson/20 border border-crimson/40 text-crimson text-[10px] font-orbitron font-bold">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-orbitron font-bold">
                          AVAILABLE
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-teko text-base text-yellow-400 font-semibold">
                      {totalMinutes}m / 60m
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <span
                            key={s}
                            className={`w-2 h-2 rounded-full ${
                              s <= agentBreaks.length
                                ? 'bg-yellow-400 shadow-[0_0_5px_#FFCC00]'
                                : 'bg-zinc-800 border border-white/10'
                            }`}
                          />
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-teko text-base text-blue-400 font-semibold">
                      {agent.email === 'solomon@bcflights.com' ? '7m / 20m' : '4m / 20m'}
                    </td>

                    <td className="py-3 px-3">
                      {agentWarns.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 font-orbitron font-bold text-[10px]">
                          L{agentWarns[0].level} ({agentWarns.length})
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[10px]">Clean</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-teko text-base text-gold font-semibold">
                      {agent.totalBonusReceived > 0 ? `+${agent.totalBonusReceived * 10}m 🎁` : '0m'}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openModal('agentDetail', { agent });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-orbitron text-[10px] transition-all"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
};
