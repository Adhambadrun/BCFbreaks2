import React, { useState } from 'react';
import { User, BreakRecord } from '../../types';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { SNAP, GLIDE, COIN_FLIP_TRANSITION } from '../../styles/motion-presets';
import { Coffee, UtensilsCrossed, Phone, Gift, ShieldAlert, XCircle, AlertTriangle, Eye, Camera, UserX, CheckCircle, Flame } from 'lucide-react';
import { playSound } from '../../lib/sound';

// Ultra-fast, high-tactile spring physics for instantaneous pod option popups
const POD_POP_SPRING = {
  type: 'spring' as const,
  stiffness: 800,
  damping: 26,
  mass: 0.28,
};

const POD_RETICLE_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 28,
};

interface AgentPodProps {
  agent: User;
  activeBreak?: BreakRecord;
  usedSlotsCount: number;
  totalBreakMinutes: number;
  isOwnPod: boolean;
  canManage: boolean;
}

export const AgentPod: React.FC<AgentPodProps> = ({
  agent,
  activeBreak,
  usedSlotsCount,
  totalBreakMinutes,
  isOwnPod,
  canManage,
}) => {
  const {
    currentUser,
    breaks,
    startBreak,
    endBreak,
    openModal,
    toggleBlockAgent,
    wcTracking,
    warnings,
    shiftConfig,
  } = useApp();

  const [isHovered, setIsHovered] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<{ label: string; color: string; sub?: string } | null>(null);
  const [showConfirmBreakType, setShowConfirmBreakType] = useState<string | null>(null);

  const isOnBreak = !!activeBreak?.isActive;
  const isAgentRole = currentUser?.role === 'agent';
  const isSelf = currentUser?.email === agent.email;

  // Privileged management permission check (Supervisor, Admin, Developer)
  const isSuperOrAdminOrDev =
    currentUser?.role === 'developer' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'supervisor';

  // Last 3 Break Events for this agent (timestamped tracking pattern)
  const agentRecentBreaks = React.useMemo(() => {
    return breaks
      .filter((b) => b.agentEmail === agent.email)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 3);
  }, [breaks, agent.email]);

  // Active warning on this agent
  const agentWarning = warnings.find(w => w.agentEmail === agent.email && w.status === 'active');
  const agentWc = wcTracking[agent.email]?.totalWCTime || 0;

  // 1. Daily cumulative 60m budget ring math
  const maxBudget = agentWarning ? agentWarning.penalties.maxBreakTime : 60;
  const progressPercent = Math.min(100, Math.round((totalBreakMinutes / maxBudget) * 100));
  const strokeDashoffset = 440 - (440 * progressPercent) / 100;

  // 2. Active Break Slot Depletion Math (Depletes from Green -> Yellow -> Orange -> Crimson)
  const totalSlotSeconds = activeBreak?.breakType === 'bonus'
    ? 600
    : activeBreak?.breakType === 'wc'
    ? 1200
    : (shiftConfig.maxSlotDuration || 15) * 60;

  const breakDuration = activeBreak?.duration || 0;
  const remainingSeconds = Math.max(0, totalSlotSeconds - breakDuration);
  const remainingRatio = Math.max(0, Math.min(1, remainingSeconds / totalSlotSeconds));
  const remainingPercent = Math.round(remainingRatio * 100);
  const isOvertime = breakDuration > totalSlotSeconds;
  // Urgency indicator: within 2 minutes (120 seconds) of maximum allowed break duration or during overtime
  const isWithin2Minutes = isOnBreak && (remainingSeconds <= 120 || isOvertime);

  // Circumference for r=76 in 180x180 viewBox: 2 * Math.PI * 76 = 477.52
  const activeCircumference = 477.52;
  const activeStrokeDashoffset = activeCircumference * (1 - remainingRatio);

  // Dynamic status color based on remaining break time
  const getDynamicGradientColor = (ratio: number, overtime: boolean) => {
    if (overtime) return '#FF003C';
    if (ratio > 0.6) return '#00FF88'; // Plenty of time remaining (green)
    if (ratio > 0.3) return '#FFD700'; // Moderate time (yellow/gold)
    if (ratio > 0.15) return '#FF8800'; // Low time (orange)
    return '#FF003C'; // Urgent / near end (crimson)
  };

  const currentDepletionColor = getDynamicGradientColor(remainingRatio, isOvertime);

  // Timer format MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (seconds: number) => {
    if (seconds < 600) return 'text-emerald-400'; // 0-10m
    if (seconds < 780) return 'text-yellow-400'; // 10-13m
    if (seconds < 900) return 'text-orange-400'; // 13-15m
    return 'text-crimson animate-pulse'; // 15m+
  };

  const handleStartBreakConfirm = (type: any) => {
    startBreak(agent.email, type);
    setShowConfirmBreakType(null);
    setIsHovered(false);
  };

  const handleEndBreak = () => {
    if (activeBreak) {
      endBreak(activeBreak.breakId, isSelf ? undefined : currentUser?.email);
    }
  };

  // Symmetrical 5-position radial menu for Agent on own pod (72° equidistant spacing)
  const agentRadialButtons = [
    {
      type: 'regular',
      label: 'Regular Break',
      sub: '15m floor slot',
      icon: Coffee,
      colorClass: 'text-cyan border-cyan/40 hover:border-cyan hover:shadow-[0_0_14px_rgba(0,229,255,0.7)]',
      textColor: 'text-cyan',
      angle: -90,
      disabled: false,
    },
    {
      type: 'wc',
      label: 'WC Break',
      sub: '20m daily allowance',
      icon: () => <span className="font-bold text-xs leading-none">🚻</span>,
      colorClass: 'text-blue-400 border-blue-400/40 hover:border-blue-400 hover:shadow-[0_0_14px_rgba(96,165,250,0.7)]',
      textColor: 'text-blue-400',
      angle: -18,
      disabled: agentWc >= 1200,
    },
    {
      type: 'meal',
      label: 'Meal Punch',
      sub: 'Meal break punch',
      icon: UtensilsCrossed,
      colorClass: 'text-orange-400 border-orange-400/40 hover:border-orange-400 hover:shadow-[0_0_14px_rgba(251,146,60,0.7)]',
      textColor: 'text-orange-400',
      angle: 54,
      disabled: false,
    },
    {
      type: 'personal',
      label: 'Call Break',
      sub: 'Personal punch',
      icon: Phone,
      colorClass: 'text-purple-400 border-purple-400/40 hover:border-purple-400 hover:shadow-[0_0_14px_rgba(192,132,252,0.7)]',
      textColor: 'text-purple-400',
      angle: 126,
      disabled: false,
    },
    {
      type: 'bonus',
      label: 'Bonus Break',
      sub: '10m extra reward',
      icon: Gift,
      colorClass: 'text-yellow-400 border-yellow-400/40 hover:border-yellow-400 hover:shadow-[0_0_14px_rgba(250,204,21,0.7)]',
      textColor: 'text-yellow-400',
      angle: 198,
      disabled: agent.totalBonusReceived <= 0,
    },
  ];

  // Symmetrical radial menu for Management (Supervisor/Admin/Dev)
  const adminRadialButtons = isOnBreak
    ? [
        {
          action: 'force_end',
          label: 'Force End',
          sub: 'End active punch',
          icon: XCircle,
          colorClass: 'text-crimson border-crimson/50 hover:border-crimson hover:shadow-[0_0_14px_rgba(255,0,60,0.7)]',
          textColor: 'text-crimson',
          angle: -90,
        },
        {
          action: 'warning',
          label: 'Warn Agent',
          sub: 'Issue floor warning',
          icon: AlertTriangle,
          colorClass: 'text-yellow-400 border-yellow-400/50 hover:border-yellow-400 hover:shadow-[0_0_14px_rgba(250,204,21,0.7)]',
          textColor: 'text-yellow-400',
          angle: -30,
        },
        {
          action: 'bonus',
          label: 'Give Bonus',
          sub: 'Award +10m break',
          icon: Gift,
          colorClass: 'text-emerald-400 border-emerald-400/50 hover:border-emerald-400 hover:shadow-[0_0_14px_rgba(0,255,136,0.7)]',
          textColor: 'text-emerald-400',
          angle: 30,
        },
        {
          action: 'report',
          label: 'View Report',
          sub: 'Audit & break logs',
          icon: Eye,
          colorClass: 'text-cyan border-cyan/50 hover:border-cyan hover:shadow-[0_0_14px_rgba(0,229,255,0.7)]',
          textColor: 'text-cyan',
          angle: 90,
        },
        {
          action: 'block',
          label: agent.isBlocked ? 'Unblock' : 'Block',
          sub: agent.isBlocked ? 'Restore break access' : 'Block break punches',
          icon: ShieldAlert,
          colorClass: agent.isBlocked
            ? 'text-emerald-400 border-emerald-400/50 hover:border-emerald-400 hover:shadow-[0_0_14px_rgba(0,255,136,0.7)]'
            : 'text-crimson border-crimson/50 hover:border-crimson hover:shadow-[0_0_14px_rgba(255,0,60,0.7)]',
          textColor: agent.isBlocked ? 'text-emerald-400' : 'text-crimson',
          angle: 150,
        },
        {
          action: 'remove',
          label: 'Hold Agent',
          sub: 'Shift status hold',
          icon: UserX,
          colorClass: 'text-zinc-400 border-zinc-500/50 hover:border-zinc-300 hover:shadow-[0_0_14px_rgba(255,255,255,0.3)]',
          textColor: 'text-zinc-300',
          angle: 210,
        },
      ]
    : [
        {
          action: 'start_break',
          label: 'Start Break',
          sub: 'Punch break for agent',
          icon: Coffee,
          colorClass: 'text-cyan border-cyan/50 hover:border-cyan hover:shadow-[0_0_14px_rgba(0,229,255,0.7)]',
          textColor: 'text-cyan',
          angle: -90,
        },
        {
          action: 'warning',
          label: 'Warn Agent',
          sub: 'Issue floor warning',
          icon: AlertTriangle,
          colorClass: 'text-yellow-400 border-yellow-400/50 hover:border-yellow-400 hover:shadow-[0_0_14px_rgba(250,204,21,0.7)]',
          textColor: 'text-yellow-400',
          angle: -30,
        },
        {
          action: 'bonus',
          label: 'Give Bonus',
          sub: 'Award +10m break',
          icon: Gift,
          colorClass: 'text-emerald-400 border-emerald-400/50 hover:border-emerald-400 hover:shadow-[0_0_14px_rgba(0,255,136,0.7)]',
          textColor: 'text-emerald-400',
          angle: 30,
        },
        {
          action: 'report',
          label: 'View Report',
          sub: 'Audit & break logs',
          icon: Eye,
          colorClass: 'text-blue-400 border-blue-400/50 hover:border-blue-400 hover:shadow-[0_0_14px_rgba(96,165,250,0.7)]',
          textColor: 'text-blue-400',
          angle: 90,
        },
        {
          action: 'block',
          label: agent.isBlocked ? 'Unblock' : 'Block',
          sub: agent.isBlocked ? 'Restore punch access' : 'Block break punches',
          icon: ShieldAlert,
          colorClass: agent.isBlocked
            ? 'text-emerald-400 border-emerald-400/50 hover:border-emerald-400 hover:shadow-[0_0_14px_rgba(0,255,136,0.7)]'
            : 'text-crimson border-crimson/50 hover:border-crimson hover:shadow-[0_0_14px_rgba(255,0,60,0.7)]',
          textColor: agent.isBlocked ? 'text-emerald-400' : 'text-crimson',
          angle: 150,
        },
        {
          action: 'remove',
          label: 'Hold Agent',
          sub: 'Shift status hold',
          icon: UserX,
          colorClass: 'text-zinc-400 border-zinc-500/50 hover:border-zinc-300 hover:shadow-[0_0_14px_rgba(255,255,255,0.3)]',
          textColor: 'text-zinc-300',
          angle: 210,
        },
      ];

  const formatBreakTime = (timestampMs: number) => {
    const d = new Date(timestampMs);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getBreakTypeIcon = (type: string) => {
    switch (type) {
      case 'regular': return '☕';
      case 'wc': return '🚻';
      case 'meal': return '🍽️';
      case 'bonus': return '🎁';
      default: return '⏱️';
    }
  };

  return (
    <div
      draggable={false}
      className="relative flex flex-col items-center justify-start w-[150px] sm:w-[170px] lg:w-[180px] min-h-[250px] sm:min-h-[265px] m-1 sm:m-2 select-none group flex-shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowConfirmBreakType(null);
      }}
    >
      {/* FLOATING ACTION HUD BANNER (Positioned above pod with clear unclipped typography) */}
      <AnimatePresence>
        {isHovered && !showConfirmBreakType && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-3 py-1 rounded-full bg-zinc-950/95 border border-cyan/40 shadow-[0_6px_24px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-center gap-1.5 whitespace-nowrap"
          >
            {hoveredAction ? (
              <>
                <span className={`text-[10px] font-orbitron font-extrabold tracking-wide uppercase ${hoveredAction.color}`}>
                  {hoveredAction.label}
                </span>
                {hoveredAction.sub && (
                  <span className="text-[8px] font-inter text-zinc-300 font-medium">
                    • {hoveredAction.sub}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[8.5px] font-orbitron font-semibold text-zinc-400 tracking-wider">
                {canManage && !isSelf ? '⚡ MANAGER CONTROLS' : '⚡ SELECT ACTION'}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* OUTER CIRCULAR POD CONTAINER (Fixed dimensions with subtle pulse animation when within 2 minutes) */}
      <motion.div
        animate={
          isWithin2Minutes
            ? {
                scale: [1, 1.028, 1],
                filter: isOvertime
                  ? [
                      'drop-shadow(0 0 12px rgba(255,0,60,0.4))',
                      'drop-shadow(0 0 26px rgba(255,0,60,0.85))',
                      'drop-shadow(0 0 12px rgba(255,0,60,0.4))',
                    ]
                  : [
                      'drop-shadow(0 0 10px rgba(255,136,0,0.35))',
                      'drop-shadow(0 0 22px rgba(255,136,0,0.75))',
                      'drop-shadow(0 0 10px rgba(255,136,0,0.35))',
                    ],
              }
            : { scale: 1, filter: 'drop-shadow(0 0 0px transparent)' }
        }
        transition={
          isWithin2Minutes
            ? {
                duration: isOvertime ? 1.0 : 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : { duration: 0.3 }
        }
        className="relative w-[150px] h-[150px] sm:w-[170px] sm:h-[170px] lg:w-[180px] lg:h-[180px] rounded-full flex items-center justify-center flex-shrink-0"
      >
        
        {/* Layer 1: Background Glass Disc */}
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-b from-zinc-900/90 to-black border transition-all duration-300 ${
            isOnBreak
              ? isOvertime
                ? 'border-crimson shadow-[0_0_35px_rgba(255,0,60,0.6)] animate-pulse'
                : isWithin2Minutes
                ? 'border-amber-500/90 shadow-[0_0_30px_rgba(255,136,0,0.6)] ring-2 ring-amber-500/50'
                : 'border-cyan/40 shadow-[0_0_30px_rgba(0,229,255,0.25)]'
              : agent.isBlocked
              ? 'border-crimson/60 shadow-[0_0_30px_rgba(255,0,60,0.35)] ring-2 ring-crimson/30'
              : agentWarning
              ? 'border-yellow-400/50 shadow-[0_0_25px_rgba(255,204,0,0.25)]'
              : 'border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.6)]'
          }`}
        />

        {/* Layer 2: SVG Progress Ring (Active Break Depletion vs Cumulative Budget) */}
        <svg viewBox="0 0 180 180" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
          <defs>
            {/* Green to Crimson Linear Gradient for Active Break Depletion */}
            <linearGradient id={`breakGradient-${agent.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00FF88" />
              <stop offset="25%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="75%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#FF003C" />
            </linearGradient>

            {/* Glowing filter for high-visibility telemetry */}
            <filter id={`breakGlow-${agent.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3.5"
                floodColor={currentDepletionColor}
                floodOpacity="0.8"
              />
            </filter>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx="90"
            cy="90"
            r="76"
            className={isOnBreak ? 'stroke-zinc-800/80' : 'stroke-zinc-800/60'}
            strokeWidth={isOnBreak ? '7' : '6'}
            fill="transparent"
          />

          {/* ACTIVE BREAK RING: Circular progress ring that visually depletes as remaining break time decreases */}
          {isOnBreak ? (
            <circle
              cx="90"
              cy="90"
              r="76"
              stroke={`url(#breakGradient-${agent.id})`}
              strokeWidth="7"
              strokeDasharray={activeCircumference}
              strokeDashoffset={activeStrokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              filter={`url(#breakGlow-${agent.id})`}
              className="transition-all duration-1000 ease-linear"
            />
          ) : (
            /* Cumulative Daily 60m Budget Ring (for idle agents, visible per privacy matrix) */
            (!isAgentRole || isSelf) && (
              <circle
                cx="90"
                cy="90"
                r="70"
                stroke={
                  progressPercent < 50
                    ? '#00FF88'
                    : progressPercent < 80
                    ? '#FFD700'
                    : progressPercent < 95
                    ? '#FF8800'
                    : '#FF003C'
                }
                strokeWidth="5"
                strokeDasharray="440"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            )
          )}
        </svg>

        {/* Layer 4: Center Core (Avatar OR 3D Coin-flip Digital Timer) */}
        <div
          className="relative w-[110px] h-[110px] sm:w-[124px] sm:h-[124px] lg:w-[130px] lg:h-[130px] rounded-full overflow-hidden flex items-center justify-center cursor-pointer"
          onClick={() => {
            if (isOnBreak && (isSelf || canManage)) {
              handleEndBreak();
            } else if (canManage) {
              openModal('agentDetail', { agent });
            }
          }}
        >
          <AnimatePresence mode="wait">
            {isOnBreak ? (
              // Active Break Timer View (Only show duration to self or supervisor/admin per Privacy Matrix)
              <motion.div
                key="timer"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={COIN_FLIP_TRANSITION}
                className={`w-full h-full bg-black/90 flex flex-col items-center justify-center p-2 rounded-full border ${
                  isOvertime ? 'border-crimson shadow-[inset_0_0_15px_rgba(255,0,60,0.5)]' : 'border-cyan/40'
                }`}
              >
                <div className="text-[10px] font-orbitron uppercase font-semibold flex items-center gap-1" style={{ color: currentDepletionColor }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: currentDepletionColor }} />
                  {activeBreak.breakType.toUpperCase()}
                </div>
                
                {/* Duration Privacy Guard: Teammates cannot see exact elapsed seconds */}
                {isAgentRole && !isSelf ? (
                  <div className="font-orbitron font-bold text-sm text-cyan mt-1">
                    ON BREAK
                  </div>
                ) : (
                  <>
                    <div className={`font-orbitron font-extrabold text-xl sm:text-2xl leading-none my-0.5 ${getTimerColor(activeBreak.duration)}`}>
                      {formatTimer(isOvertime ? activeBreak.duration : remainingSeconds)}
                    </div>
                    <div className="text-[9px] font-orbitron font-semibold tracking-tight" style={{ color: currentDepletionColor }}>
                      {isOvertime ? 'OVERTIME' : `${remainingPercent}% REMAINING`}
                    </div>
                  </>
                )}

                <div className="text-[8px] font-inter text-zinc-400 mt-0.5">
                  {isSelf || canManage ? 'Click to Return' : 'Occupied'}
                </div>
              </motion.div>
            ) : (
              // Idle Avatar View
              <motion.div
                key="avatar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full h-full"
              >
                <img
                  src={agent.avatarUrl}
                  alt={agent.name}
                  draggable={false}
                  className={`w-full h-full object-cover rounded-full filter select-none ${
                    agent.isBlocked ? 'grayscale brightness-60' : ''
                  }`}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                
                {/* Blocked Overlay Shield if Blocked */}
                {agent.isBlocked ? (
                  <div className="absolute inset-0 bg-crimson/30 flex flex-col items-center justify-center p-2 backdrop-blur-[1px] pointer-events-none">
                    <ShieldAlert className="w-6 h-6 text-crimson animate-bounce drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]" />
                    <span className="text-[8px] font-orbitron font-bold text-white bg-black/80 px-1.5 py-0.5 rounded mt-1 border border-crimson/50">
                      BLOCKED
                    </span>
                  </div>
                ) : (
                  /* Online / Ready Status Dot */
                  <div className="absolute bottom-1 right-1/2 translate-x-1/2 flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded-full border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-orbitron text-zinc-300">
                      READY
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Layer 5: Inner Bottom Arc 5 Slot Dots */}
        {(!isAgentRole || isSelf) && (
          <div className="absolute bottom-1.5 flex items-center gap-1.5 z-20">
            {[1, 2, 3, 4, 5].map(slot => {
              const isUsed = slot <= usedSlotsCount;
              const isActiveSlot = isOnBreak && slot === usedSlotsCount + 1;
              return (
                <div
                  key={slot}
                  className={`w-2 h-2 rounded-full transition-all ${
                    isActiveSlot
                      ? 'bg-cyan shadow-[0_0_8px_#00E5FF] animate-ping'
                      : isUsed
                      ? 'bg-yellow-400 shadow-[0_0_6px_#FFCC00]'
                      : 'border border-white/20 bg-black/40'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Layer 7: Orbiting Badges */}
        {/* YOU Badge */}
        {isSelf && (
          <div className="absolute -top-1 -left-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-orbitron font-extrabold text-[9px] px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(255,204,0,0.6)] z-20 animate-bounce">
            YOU
          </div>
        )}

        {/* Warning Badge (if active warning) */}
        {agentWarning && (
          <div
            title={`Warning Level ${agentWarning.level}: ${agentWarning.reason}`}
            className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-black z-20 shadow-lg ${
              agentWarning.level === 1
                ? 'bg-yellow-400 text-black'
                : agentWarning.level === 2
                ? 'bg-orange-500 text-white'
                : 'bg-crimson text-white animate-pulse'
            }`}
          >
            {agentWarning.level === 1 ? '⚠️' : agentWarning.level === 2 ? '🔶' : '🟥'}
          </div>
        )}

        {/* Bonus Badge (if agent has bonus balance) */}
        {agent.totalBonusReceived > 0 && !agentWarning && (
          <div
            title={`+10m Bonus Break Available (${agent.totalBonusReceived})`}
            className="absolute -bottom-1 -right-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-orbitron font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(0,255,136,0.5)] z-20"
          >
            🎁 +10m
          </div>
        )}

        {/* Birthday Badge */}
        {agent.birthday === '08-28' && (
          <div
            title="Birthday Shift! 🎂 Soft confetti active"
            className="absolute top-1/2 -right-3 text-lg z-20 animate-spin"
            style={{ animationDuration: '6s' }}
          >
            🎂
          </div>
        )}

        {/* HOVER COMMAND WHEEL: AGENT ON OWN POD (Clean, high-precision orbital wheel with center HUD) */}
        <AnimatePresence>
          {isHovered && isSelf && !isOnBreak && !agent.isBlocked && !showConfirmBreakType && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={POD_POP_SPRING}
              className="absolute inset-0 z-30 rounded-full bg-zinc-950/90 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center p-1"
            >
              {/* Center HUD Readout (Eliminates messy button clipping) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-1 z-10">
                <div className="w-8 h-8 rounded-full bg-zinc-900/90 border border-cyan-500/30 flex items-center justify-center shadow-inner">
                  <AnimatePresence mode="wait">
                    {hoveredAction ? (
                      <motion.div
                        key={hoveredAction.label}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.1 }}
                        className="flex items-center justify-center"
                      >
                        <span className="w-2 h-2 rounded-full bg-cyan animate-ping" />
                      </motion.div>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.8 }}
                        exit={{ opacity: 0 }}
                        className="text-[7.5px] font-orbitron font-bold text-cyan"
                      >
                        PUNCH
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Equidistant Radial Action Buttons (r=42px, zero overlap) */}
              {agentRadialButtons.map((btn, idx) => {
                const radius = 42;
                const rad = (btn.angle * Math.PI) / 180;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);
                const IconComponent = btn.icon;

                return (
                  <motion.button
                    key={btn.type}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    animate={{ scale: 1, x, y, opacity: 1 }}
                    exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ ...POD_POP_SPRING, delay: idx * 0.015 }}
                    disabled={btn.disabled}
                    onMouseEnter={() => {
                      if (!btn.disabled) {
                        playSound('hover_tick');
                        setHoveredAction({ label: btn.label, color: btn.textColor, sub: btn.sub });
                      }
                    }}
                    onMouseLeave={() => setHoveredAction(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!btn.disabled) {
                        playSound('click');
                        setShowConfirmBreakType(btn.type);
                        setHoveredAction(null);
                      }
                    }}
                    className={`absolute w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border backdrop-blur-md transition-all duration-150 z-20 cursor-pointer ${
                      btn.disabled
                        ? 'bg-zinc-900/90 border-zinc-700 opacity-40 cursor-not-allowed text-zinc-500'
                        : `bg-zinc-950/95 ${btn.colorClass}`
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* HOVER COMMAND WHEEL: SUPERVISOR / ADMIN ON MANAGED POD (Clean, high-precision orbital wheel with center HUD) */}
        <AnimatePresence>
          {isHovered && canManage && !isSelf && !showConfirmBreakType && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={POD_POP_SPRING}
              className="absolute inset-0 z-30 rounded-full bg-zinc-950/90 backdrop-blur-md border border-yellow-500/30 flex items-center justify-center p-1"
            >
              {/* Center HUD Readout (Eliminates button collision) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-1 z-10">
                <div className="w-8 h-8 rounded-full bg-zinc-900/90 border border-yellow-500/30 flex items-center justify-center shadow-inner">
                  <AnimatePresence mode="wait">
                    {hoveredAction ? (
                      <motion.div
                        key={hoveredAction.label}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.1 }}
                        className="flex items-center justify-center"
                      >
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                      </motion.div>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.8 }}
                        exit={{ opacity: 0 }}
                        className="text-[7.5px] font-orbitron font-bold text-yellow-400"
                      >
                        FLOOR
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Equidistant Radial Action Buttons (r=44px, 60° spacing, zero overlap) */}
              {adminRadialButtons.map((btn, idx) => {
                const radius = 44;
                const rad = (btn.angle * Math.PI) / 180;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);
                const IconComponent = btn.icon;

                return (
                  <motion.button
                    key={btn.action}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    animate={{ scale: 1, x, y, opacity: 1 }}
                    exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    whileHover={{ scale: 1.18 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ ...POD_POP_SPRING, delay: idx * 0.015 }}
                    onMouseEnter={() => {
                      playSound('hover_tick');
                      setHoveredAction({ label: btn.label, color: btn.textColor, sub: btn.sub });
                    }}
                    onMouseLeave={() => setHoveredAction(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click');
                      setHoveredAction(null);
                      if (btn.action === 'force_end') {
                        handleEndBreak();
                      } else if (btn.action === 'start_break') {
                        openModal('agentDetail', { agent });
                      } else if (btn.action === 'warning') {
                        openModal('warning', { agent });
                      } else if (btn.action === 'bonus') {
                        openModal('bonus', { agent });
                      } else if (btn.action === 'report') {
                        openModal('agentReport', { agent });
                      } else if (btn.action === 'picture') {
                        openModal('changePicture', { agent });
                      } else if (btn.action === 'block') {
                        toggleBlockAgent(
                          agent.email,
                          agent.isBlocked ? undefined : 'Break punches blocked by management'
                        );
                      } else if (btn.action === 'remove') {
                        openModal('removeAgent', { agent });
                      }
                    }}
                    className={`absolute w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border backdrop-blur-md transition-all duration-150 z-20 cursor-pointer bg-zinc-950/95 ${btn.colorClass}`}
                  >
                    <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* BREAK CONFIRMATION OVERLAY MODAL (Inside Pod Core) */}
        <AnimatePresence>
          {showConfirmBreakType && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={GLIDE}
              className="absolute inset-0 z-40 bg-black/95 rounded-full flex flex-col items-center justify-center p-3 text-center border-2 border-yellow-400 shadow-2xl"
            >
              <div className="text-[10px] font-orbitron text-zinc-300 uppercase tracking-wider">
                Start {showConfirmBreakType}?
              </div>
              <div className="text-[9px] text-zinc-400 mb-2">
                {showConfirmBreakType === 'bonus' ? 'Free 10m' : showConfirmBreakType === 'wc' ? '20m daily' : '15m slot max'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartBreakConfirm(showConfirmBreakType)}
                  className="px-2.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-orbitron font-bold shadow-md transition-transform hover:scale-105"
                >
                  PUNCH
                </button>
                <button
                  onClick={() => setShowConfirmBreakType(null)}
                  className="px-2 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-orbitron"
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* POD LABEL & TIMESTAMPED BREAK HISTORY (Below Pod) */}
      <div className="mt-2 text-center w-full max-w-[165px] flex flex-col items-center justify-start pointer-events-none">
        <div className="font-orbitron font-bold text-xs sm:text-sm text-zinc-100 uppercase tracking-wide truncate flex items-center justify-center gap-1 w-full">
          <span>{agent.name.split(' ')[0]}</span>
          {agent.powerEmoji && <span className="text-xs">{agent.powerEmoji}</span>}
        </div>

        {/* Status / Time Budget Label */}
        {agent.isBlocked ? (
          <div className="font-orbitron font-bold text-[10px] text-crimson tracking-wider flex items-center justify-center gap-1 mt-0.5 animate-pulse">
            <ShieldAlert className="w-3 h-3" />
            <span>BREAKS BLOCKED</span>
          </div>
        ) : (!isAgentRole || isSelf) ? (
          <div className="font-teko text-base sm:text-lg text-yellow-400 leading-none">
            {totalBreakMinutes}m / {maxBudget}m
          </div>
        ) : (
          <div className="font-orbitron text-[10px] text-emerald-400 font-semibold mt-0.5">
            AVAILABLE
          </div>
        )}

        {/* LAST 3 BREAK EVENTS (Small timestamped event tags for admins & floor leads) */}
        {isSuperOrAdminOrDev && agentRecentBreaks.length > 0 && (
          <div className="w-full mt-1 flex items-center justify-center gap-1">
            {agentRecentBreaks.map((b) => {
              const durationMin = Math.round((b.duration || (Date.now() - b.startTime) / 1000) / 60);
              return (
                <span
                  key={b.breakId}
                  title={`${b.breakType.toUpperCase()} at ${formatBreakTime(b.startTime)}${b.endTime ? ` - ${formatBreakTime(b.endTime)}` : ' (Active)'} [${durationMin}m]`}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-orbitron font-semibold flex items-center gap-0.5 border ${
                    b.isActive
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : b.isForcedEnded
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-zinc-900/90 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>{getBreakTypeIcon(b.breakType)}</span>
                  <span>{formatBreakTime(b.startTime)}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Personal Motto (Clean opacity fade when no recent breaks or agent view) */}
        {agent.personalMotto && (!isSuperOrAdminOrDev || agentRecentBreaks.length === 0) && (
          <div
            className={`text-[9px] italic text-zinc-400 truncate w-full transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            "{agent.personalMotto}"
          </div>
        )}
      </div>
    </div>
  );
};

