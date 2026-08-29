/**
 * BREAK — Master Web App
 * Neo-Apple Liquid Glass Material System
 * Author & Lead Developer: Adham Badran (adhambadraan@gmail.com)
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ShaderBackground } from './components/shared/ShaderBackground';
import { TopHeader } from './components/header/TopHeader';
import { SNNTicker } from './components/ticker/SNNTicker';
import { PodGrid } from './components/pods/PodGrid';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { SupervisorDashboard } from './components/supervisor/SupervisorDashboard';
import { GodModePanel } from './components/developer/GodModePanel';
import { MessagesPanel } from './components/messaging/MessagesPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { NewsPanel } from './components/ticker/NewsPanel';
import { ModalManager } from './components/modals/ModalManager';
import { FloorAlertOverlays } from './components/shared/FloorAlertOverlays';
import { LoginCard } from './components/auth/LoginCard';
import { VoiceFloorAssistant } from './components/voice/VoiceFloorAssistant';
import { SearchGroundingWidget } from './components/intelligence/SearchGroundingWidget';
import { LayoutGrid, BarChart2, Shield } from 'lucide-react';
import { playSound } from './lib/sound';

const AppContent: React.FC = () => {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'pods' | 'supervisor' | 'admin'>('pods');

  if (!currentUser) {
    return (
      <div className="relative min-h-screen w-full bg-black text-white select-none">
        <ShaderBackground />
        <LoginCard />
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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
