/**
 * BREAK — Master Web App
 * Neo-Apple Liquid Glass Material System
 * Author & Lead Developer: Adham Badran (adhambadraan@gmail.com)
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import { ErrorBoundary } from './ErrorBoundary';
import { ShaderBackground } from './ShaderBackground';
import { TopHeader } from './TopHeader';
import { SNNTicker } from './SNNTicker';
import { PodGrid } from './PodGrid';
import { AdminDashboard } from './AdminDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { GodModePanel } from './GodModePanel';
import { MessagesPanel } from './MessagesPanel';
import { SettingsPanel } from './SettingsPanel';
import { NewsPanel } from './NewsPanel';
import { ModalManager } from './ModalManager';
import { FloorAlertOverlays } from './FloorAlertOverlays';
import { LockedGate } from './LockedGate';
import { Profile } from './Profile';
import { LogoutButton } from './LogoutButton';
import { VoiceFloorAssistant } from './VoiceFloorAssistant';
import { SearchGroundingWidget } from './SearchGroundingWidget';
import { LayoutGrid, BarChart2, Shield } from 'lucide-react';
import { playSound } from './sound';

const AppContent: React.FC = () => {
  const { currentUser, sessionState } = useApp();
  const [activeTab, setActiveTab] = useState<'pods' | 'supervisor' | 'admin'>('pods');

  // ZERO DEMO MODE: nothing about the floor renders until the server has confirmed a
  // session. There is deliberately no sign-in card, no preview, and no demo entry
  // point in this branch — the only way forward is the Auth0 redirect the server
  // issues (with `sessionApi` as the client-side fallback for a stale tab).
  if (!currentUser) {
    const gateState =
      sessionState === 'unavailable' ? 'unavailable' : sessionState === 'authenticated' ? 'verifying' : 'redirecting';
    return (
      <div className="relative min-h-screen w-full bg-black text-white select-none">
        <ShaderBackground />
        <LockedGate state={gateState} />
      </div>
    );
  }

  const isSupervisorOrAbove = currentUser.role === 'supervisor' || currentUser.role === 'admin' || currentUser.role === 'developer';
  const isAdminOrAbove = currentUser.role === 'admin' || currentUser.role === 'developer';

  return (
    <div className="relative min-h-screen w-full bg-black text-white select-none flex flex-col font-sans">
      {/* WebGL Drifting Liquid Glass Background Shader */}
      <ShaderBackground />

      {/* 80px Sticky Top Header */}
      <TopHeader />

      {/* 44px Sticky SNN Live Ticker */}
      <SNNTicker />

      {/* Verified identity + the access tier the gate actually granted */}
      <div className="w-full max-w-7xl mx-auto px-4 pt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex-1 min-w-0">
          <Profile />
        </div>
        <div className="sm:w-44 shrink-0">
          <LogoutButton />
        </div>
      </div>

      {/* Role Navigation Bar (For Supervisor / Admin / Developer) */}
      {isSupervisorOrAbove && (
        <div className="w-full max-w-7xl mx-auto px-4 pt-4 flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2 text-xs font-orbitron">
            <button
              onClick={() => {
                setActiveTab('pods');
                playSound('click');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'pods'
                  ? 'bg-yellow-400 text-black font-extrabold shadow-md'
                  : 'bg-black/40 border border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Floor Pods
            </button>

            <button
              onClick={() => {
                setActiveTab('supervisor');
                playSound('click');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                activeTab === 'supervisor'
                  ? 'bg-yellow-400 text-black font-extrabold shadow-md'
                  : 'bg-black/40 border border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Supervisor Deck
            </button>

            {isAdminOrAbove && (
              <button
                onClick={() => {
                  setActiveTab('admin');
                  playSound('click');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                  activeTab === 'admin'
                    ? 'bg-yellow-400 text-black font-extrabold shadow-md'
                    : 'bg-black/40 border border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Admin Analytics
              </button>
            )}
          </div>

          <div className="text-[10px] font-orbitron text-zinc-400 hidden sm:block">
            Shift Active · 10 PM – 6 AM Cairo Time
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'pods' && <PodGrid />}
        {activeTab === 'supervisor' && <SupervisorDashboard />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      {/* Slide-in Drawers & Full Screen Dialogs */}
      <MessagesPanel />
      <SettingsPanel />
      <GodModePanel />
      <NewsPanel />
      <ModalManager />
      <FloorAlertOverlays />
      <VoiceFloorAssistant />
      <SearchGroundingWidget />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
