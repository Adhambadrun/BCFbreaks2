import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { RoleGuard } from '../shared/RoleGuard';
import { Clock, Users, Zap, ChevronDown, MessageSquare, CloudSun, Settings, Award, User, LogOut, Radio, Mic, Globe, Sparkles } from 'lucide-react';
import { SNAP, GLIDE } from '../../styles/motion-presets';
import { motion, AnimatePresence } from 'motion/react';
import { playSound } from '../../lib/sound';

export const TopHeader: React.FC = () => {
  const {
    currentUser,
    teams,
    activeTeamId,
    setActiveTeamId,
    activeBreaksCount,
    shiftConfig,
    totalTeamBreakMinutes,
    setIsGodModeOpen,
    setIsSettingsOpen,
    setIsMessagesOpen,
    setIsVoiceAssistantOpen,
    setIsSearchGroundingOpen,
    openModal,
    logout,
  } = useApp();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTeamSelectorOpen, setIsTeamSelectorOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTeam = teams.find(t => t.teamId === activeTeamId) || teams[0];
  const capacityPercent = Math.min(100, Math.round((activeBreaksCount / shiftConfig.breakCapacity) * 100));

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsTeamSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
  };

  return (
    <header className="sticky top-0 z-40 w-full h-[76px] lg:h-[80px]">
      <GlassPanel
        material="thin"
        concentricRadius="none"
        className="w-full h-full border-x-0 border-t-0 flex items-center justify-between px-3 md:px-6 shadow-2xl"
      >
        {/* LEFT: Shift Clock & Egypt Time */}
        <div className="flex items-center gap-3 min-w-[150px] md:min-w-[210px]">
          <div className="w-10 h-10 rounded-full bg-crimson/10 border border-crimson/30 flex items-center justify-center text-crimson">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] tracking-wider uppercase font-semibold text-yellow-400 font-inter">
              SHIFT TIME
            </div>
            <div className="font-orbitron font-bold text-sm md:text-base text-zinc-100 tracking-tight">
              10:00 PM – 6:00 AM
            </div>
            <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-inter">
              EGYPT TIME (UTC+2)
            </div>
          </div>
        </div>

        {/* CENTER-LEFT: Team Logo & Brand (with Admin Team Switcher) */}
        <div className="flex items-center gap-3 relative">
          <div
            className={`relative group ${
              currentUser?.role === 'admin' || currentUser?.role === 'developer'
                ? 'cursor-pointer'
                : 'cursor-default'
            }`}
            onClick={() => {
              if (currentUser?.role === 'admin' || currentUser?.role === 'developer') {
                setIsTeamSelectorOpen(!isTeamSelectorOpen);
              }
            }}
          >
            <div className="w-11 h-11 md:w-13 md:h-13 rounded-full overflow-hidden border-2 border-crimson/60 shadow-[0_0_15px_rgba(255,0,60,0.4)] transition-transform group-hover:scale-105">
              <img
                src={activeTeam.teamLogo}
                alt={activeTeam.teamName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {(currentUser?.role === 'admin' || currentUser?.role === 'developer') && (
              <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[9px] font-bold px-1 rounded-full border border-black" title="Switch or manage teams">
                ▼
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-orbitron font-black text-xl md:text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-crimson via-orange-400 to-yellow-400">
                {activeTeam.teamName}
              </span>
              <span className="text-[10px] font-orbitron px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-300">
                {activeTeam.agentCount} AGENTS
              </span>
              {(currentUser?.role === 'admin' || currentUser?.role === 'developer') && (
                <button
                  onClick={() => openModal('editTeam', activeTeam)}
                  className="p-1 rounded-md bg-white/5 hover:bg-yellow-400/20 text-zinc-400 hover:text-yellow-300 transition-colors"
                  title="Edit team name or logo"
                >
                  <span className="text-xs">✏️</span>
                </button>
              )}
            </div>
            <div className="text-[10px] text-zinc-400 font-inter tracking-wide hidden sm:block">
              Floor Shift · Break Management OS
            </div>
          </div>

          {/* Team Selector Dropdown for Admin & Developer */}
          <AnimatePresence>
            {isTeamSelectorOpen && (currentUser?.role === 'admin' || currentUser?.role === 'developer') && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={SNAP}
                className="absolute top-16 left-0 w-72 z-50"
              >
                <GlassPanel material="thick" className="p-3 shadow-2xl space-y-2 border border-white/20">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-orbitron text-zinc-400 uppercase tracking-wider">
                      Select Active Team
                    </span>
                    <button
                      onClick={() => {
                        setIsTeamSelectorOpen(false);
                        openModal('manageTeams');
                      }}
                      className="text-[10px] font-orbitron text-yellow-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      ⚙️ Manage All
                    </button>
                  </div>
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {teams.map(team => (
                      <button
                        key={team.teamId}
                        onClick={() => {
                          setActiveTeamId(team.teamId);
                          setIsTeamSelectorOpen(false);
                          playSound('click');
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                          activeTeamId === team.teamId
                            ? 'bg-crimson/20 border border-crimson/50 text-white font-semibold'
                            : 'hover:bg-zinc-800/60 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={team.teamLogo}
                            alt={team.teamName}
                            className="w-5 h-5 rounded-full object-cover border border-white/20"
                            referrerPolicy="no-referrer"
                          />
                          <span className="font-orbitron text-sm">{team.teamName}</span>
                        </div>
                        <span className="text-xs text-zinc-400 font-teko text-base">
                          {team.agentCount} pods
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsTeamSelectorOpen(false);
                        openModal('addAgent', { teamId: activeTeamId });
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400/40 text-yellow-300 text-[11px] font-orbitron font-bold text-center transition-colors"
                    >
                      + Add Agent Pod
                    </button>
                    <button
                      onClick={() => {
                        setIsTeamSelectorOpen(false);
                        openModal('editTeam', activeTeam);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 text-[11px] font-orbitron font-medium text-center transition-colors"
                    >
                      Edit Team
                    </button>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CENTER: Capacity Indicator (Liquid Bar) */}
        <div className="hidden lg:flex flex-col items-center justify-center min-w-[170px]">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Users className="w-4 h-4 text-cyan" />
            <span className="text-[10px] font-orbitron tracking-wider text-zinc-300">CAPACITY</span>
          </div>
          <div className="flex items-baseline gap-1 font-teko">
            <span className="text-3xl font-bold text-yellow-400 leading-none">
              {activeBreaksCount}
            </span>
            <span className="text-xl text-zinc-400">/{shiftConfig.breakCapacity}</span>
            <span className="text-xs font-orbitron text-zinc-400 ml-1">ON BREAK</span>
          </div>
          <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden border border-white/5 mt-0.5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${capacityPercent}%`,
                background:
                  capacityPercent < 60
                    ? 'linear-gradient(90deg, #00FF88, #00E5FF)'
                    : capacityPercent < 90
                    ? 'linear-gradient(90deg, #00E5FF, #FFD700)'
                    : 'linear-gradient(90deg, #FF8800, #FF003C)',
              }}
            />
          </div>
        </div>

        {/* CENTER-RIGHT: Total Team Break Time */}
        <div className="hidden xl:flex flex-col items-center justify-center min-w-[170px]">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] font-orbitron tracking-wider text-zinc-300">TEAM BREAK TIME</span>
          </div>
          <div className="font-teko text-3xl font-semibold text-zinc-100 leading-none">
            {formatTime(totalTeamBreakMinutes)}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-zinc-400 font-inter">
            SHIFT AGGREGATE
          </div>
        </div>

        {/* RIGHT: Quick Utility Controls & User Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3" ref={dropdownRef}>
          {/* Gemini Live Voice Assistant Shortcut */}
          <button
            onClick={() => {
              setIsVoiceAssistantOpen(true);
              playSound('click');
            }}
            title="Gemini Live Voice Dispatcher (gemini-3.1-flash-live-preview)"
            className="p-2.5 rounded-full bg-crimson/15 hover:bg-crimson/30 border border-crimson/50 text-crimson transition-all hover:scale-105 shadow-[0_0_12px_rgba(255,0,60,0.3)] relative group cursor-pointer"
          >
            <Mic className="w-5 h-5 group-hover:animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          </button>

          {/* Floor Intelligence & Google Search Grounding Shortcut */}
          <button
            onClick={() => {
              setIsSearchGroundingOpen(true);
              playSound('click');
            }}
            title="Floor Intelligence & Google Search Grounding (gemini-3.5-flash)"
            className="p-2.5 rounded-full bg-cyan/15 hover:bg-cyan/30 border border-cyan/50 text-cyan transition-all hover:scale-105 shadow-[0_0_12px_rgba(0,229,255,0.25)] cursor-pointer"
          >
            <Globe className="w-5 h-5" />
          </button>

          {/* Cairo Weather Shortcut */}
          <button
            onClick={() => openModal('weather')}
            title="Cairo Weather & Shift Intel"
            className="p-2.5 rounded-full hover:bg-zinc-800/70 border border-white/10 text-yellow-400 transition-all hover:scale-105 cursor-pointer"
          >
            <CloudSun className="w-5 h-5" />
          </button>

          {/* Messages shortcut */}
          <button
            onClick={() => setIsMessagesOpen(true)}
            title="Private Shift Messaging"
            className="relative p-2.5 rounded-full hover:bg-zinc-800/70 border border-white/10 text-zinc-300 transition-all hover:scale-105"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-crimson shadow-[0_0_8px_#FF003C]" />
          </button>

          {/* Supervisor Handover Notes Shortcut */}
          <RoleGuard allowedRoles={['supervisor', 'admin', 'developer']}>
            <button
              onClick={() => openModal('handover')}
              title="Supervisor Shift Handover Notes"
              className="p-2.5 rounded-full hover:bg-zinc-800/70 border border-white/10 text-yellow-400 transition-all hover:scale-105 hidden sm:block"
            >
              <Award className="w-5 h-5" />
            </button>
          </RoleGuard>

          {/* Developer God Mode ⚡ Icon (Exclusive to Developer) */}
          {currentUser?.role === 'developer' && (
            <button
              onClick={() => {
                setIsGodModeOpen(true);
                playSound('bonus');
              }}
              title="Developer God Mode Command Center ⚡"
              className="relative p-2.5 rounded-full bg-yellow-400/10 border-2 border-yellow-400/70 text-yellow-400 hover:scale-110 shadow-[0_0_20px_rgba(255,204,0,0.5)] transition-all animate-bounce duration-1000"
            >
              <Zap className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            </button>
          )}

          {/* User Profile Capsule Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-zinc-800/60 border border-white/15 transition-all bg-zinc-900/40"
            >
              <div className="relative w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border border-yellow-400/50">
                <img
                  src={currentUser?.avatarUrl}
                  alt={currentUser?.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black" />
              </div>
              <div className="text-left hidden md:block">
                <div className="text-[10px] text-zinc-400 leading-none">Welcome back,</div>
                <div className="font-orbitron text-xs font-semibold text-zinc-100 truncate max-w-[100px]">
                  {currentUser?.name}
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={GLIDE}
                  className="absolute right-0 top-14 w-72 z-50"
                >
                  <GlassPanel material="thick" className="p-3 shadow-2xl space-y-1">
                    {/* User header info */}
                    <div className="p-2 border-b border-white/10 mb-2">
                      <div className="font-orbitron font-bold text-sm text-zinc-100">
                        {currentUser?.name}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">{currentUser?.email}</div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-orbitron uppercase px-2 py-0.5 rounded-full bg-crimson/20 border border-crimson/40 text-crimson font-bold">
                          {currentUser?.role.toUpperCase()}
                        </span>
                        <span className="text-xs font-teko text-yellow-400">
                          {currentUser?.currentStreak} Day Streak 🔥
                        </span>
                      </div>
                    </div>

                    {/* Nav Actions */}
                    <button
                      onClick={() => {
                        openModal('profile');
                        setIsDropdownOpen(false);
                        playSound('click');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-800/70 text-xs font-inter text-zinc-200 transition-all"
                    >
                      <User className="w-4 h-4 text-cyan" />
                      My Profile & Goals
                    </button>

                    <button
                      onClick={() => {
                        setIsSettingsOpen(true);
                        setIsDropdownOpen(false);
                        playSound('click');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-800/70 text-xs font-inter text-zinc-200 transition-all"
                    >
                      <Settings className="w-4 h-4 text-yellow-400" />
                      Preferences & Settings
                    </button>

                    <button
                      onClick={() => {
                        openModal('leaderboard');
                        setIsDropdownOpen(false);
                        playSound('click');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-800/70 text-xs font-inter text-zinc-200 transition-all"
                    >
                      <Award className="w-4 h-4 text-gold" />
                      Weekly Floor Leaderboards
                    </button>

                    <button
                      onClick={() => {
                        openModal('replay');
                        setIsDropdownOpen(false);
                        playSound('click');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-800/70 text-xs font-inter text-zinc-200 transition-all"
                    >
                      <Clock className="w-4 h-4 text-orange-400" />
                      Shift Replay (Time Machine)
                    </button>

                    <RoleGuard allowedRoles={['admin', 'developer']}>
                      <button
                        onClick={() => {
                          openModal('broadcast');
                          setIsDropdownOpen(false);
                          playSound('click');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-800/70 text-xs font-inter text-crimson transition-all"
                      >
                        <Radio className="w-4 h-4 text-crimson" />
                        Send Shift Broadcast
                      </button>
                    </RoleGuard>

                    <div className="border-t border-white/10 my-1 pt-1">
                      <button
                        onClick={() => {
                          logout();
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-crimson/20 text-xs font-inter text-red-400 transition-all"
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        Sign Out
                      </button>
                    </div>
                  </GlassPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassPanel>
    </header>
  );
};
