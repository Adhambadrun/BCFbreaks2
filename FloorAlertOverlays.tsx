import React from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { Flame, AlertOctagon, CheckCircle2 } from 'lucide-react';

export const FloorAlertOverlays: React.FC = () => {
  const { shiftConfig, broadcasts, acknowledgeBroadcast, currentUser } = useApp();

  // Active unacknowledged critical broadcast
  const activeEmergency = broadcasts.find(
    b => b.priority === 'critical' && (!currentUser || !b.acknowledgments[currentUser.email])
  );

  return (
    <>
      {/* 1. RALLY MODE FULL-SCREEN OVERLAY */}
      {shiftConfig.rallyModeActive && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-crimson/30 backdrop-blur-3xl border-4 border-crimson shadow-[0_0_100px_#FF003C] animate-pulse duration-1000">
          <GlassPanel material="ultrathick" className="p-8 max-w-xl text-center border-2 border-crimson shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-crimson/20 border-2 border-crimson mx-auto flex items-center justify-center text-crimson shadow-[0_0_30px_#FF003C]">
              <Flame className="w-10 h-10 animate-bounce" />
            </div>

            <h1 className="font-orbitron font-black text-3xl md:text-4xl text-crimson tracking-wider">
              FLOOR RALLY MODE ACTIVE!
            </h1>

            <p className="font-orbitron font-semibold text-lg text-white">
              "{shiftConfig.rallyModeMessage || 'ALL BREAKS CURRENTLY PAUSED — CLOSE INBOUND LEADS NOW!'}"
            </p>

            <p className="text-xs text-zinc-300 font-inter">
              Punches are temporarily frozen floor-wide by management. All hands on decks until the session concludes.
            </p>
          </GlassPanel>
        </div>
      )}

      {/* 2. EMERGENCY BROADCAST OVERLAY */}
      {activeEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
          <GlassPanel material="ultrathick" className="p-8 max-w-lg text-center border-2 border-crimson shadow-[0_0_80px_#FF003C] space-y-4">
            <div className="w-14 h-14 rounded-full bg-crimson/20 border-2 border-crimson mx-auto flex items-center justify-center text-crimson">
              <AlertOctagon className="w-8 h-8 animate-pulse" />
            </div>

            <h2 className="font-orbitron font-black text-2xl text-crimson">
              CRITICAL FLOOR ALERT
            </h2>

            <p className="text-sm font-inter text-zinc-200">
              {activeEmergency.message}
            </p>

            <div className="text-xs text-zinc-400 font-orbitron">
              Transmitted by {activeEmergency.sentByName} · Acknowledgment Mandatory
            </div>

            <button
              onClick={() => acknowledgeBroadcast(activeEmergency.broadcastId)}
              className="w-full py-3 rounded-2xl bg-crimson hover:bg-red-600 text-white font-orbitron font-black text-xs shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Acknowledge & Confirm Receipt
            </button>
          </GlassPanel>
        </div>
      )}
    </>
  );
};
