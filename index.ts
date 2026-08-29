export type UserRole = 'agent' | 'supervisor' | 'admin' | 'developer';

export type BreakType = 'regular' | 'wc' | 'meal' | 'personal' | 'bonus';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
  avatarUrl: string;
  personalMotto?: string;
  powerEmoji?: string;
  podColorTheme?: string;
  preferredLanguage: 'en' | 'ar';
  themeMode: 'dark' | 'light';
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  birthday?: string; // MM-DD
  hireDate?: string; // YYYY-MM-DD
  yearsOfService?: number;
  isOnline: boolean;
  isBlocked?: boolean;
  blockReason?: string;
  lastSeen: string;
  totalBreaksTaken: number;
  totalBreakTime: number; // in minutes
  totalWarnings: number;
  totalBonusReceived: number;
  currentStreak: number;
  longestStreak: number;
  dailyGoal?: {
    text: string;
    target: number;
    progress: number;
    completed: boolean;
  };
}

export interface Team {
  teamId: string;
  teamName: string;
  teamLogo: string;
  teamColorAccent: string;
  supervisorEmail: string;
  defaultLanguage: 'en' | 'ar';
  agentCount: number;
  competitionScore: number;
  isActive: boolean;
  settings?: {
    customBreakCapacity?: number;
    customMaxTotalBreakTime?: number;
    customMaxWCTime?: number;
  };
}

export interface BreakRecord {
  breakId: string;
  agentEmail: string;
  agentName: string;
  teamId: string;
  breakType: BreakType;
  slotNumber: number;
  startTime: number; // timestamp ms
  endTime: number | null;
  duration: number; // in seconds
  scheduledEndTime: number;
  isActive: boolean;
  isBonus: boolean;
  isAutoEnded?: boolean;
  isForcedEnded?: boolean;
  grantedBy?: string;
  forcedEndBy?: string;
  date: string; // YYYY-MM-DD
}

export interface WCTracking {
  agentEmail: string;
  agentName: string;
  teamId: string;
  date: string;
  totalWCTime: number; // in seconds (20 min = 1200 sec limit)
  wcBreakCount: number;
  lastWCBreakAt: number;
  hasReceivedLimitWarning: boolean;
}

export interface Warning {
  warningId: string;
  agentEmail: string;
  agentName: string;
  teamId: string;
  level: 1 | 2 | 3;
  reason: string;
  customNote: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: number;
  expiresAt: number;
  cleanShiftsCount: number;
  requiredCleanShifts: number;
  status: 'active' | 'dismissed' | 'appealed' | 'expired';
  appealText?: string;
  appealSubmittedAt?: number;
  appealDecision?: 'approved' | 'denied';
  appealDecisionBy?: string;
  appealDecisionAt?: number;
  appealDecisionReason?: string;
  penalties: {
    maxBreakTime: number; // default 60, L2: 50, L3: 40
    maxSlots: number;     // default 5, L2: 4, L3: 4
  };
}

export interface SNNHeadline {
  headlineId: string;
  headlineText: string;
  category: 'break' | 'warning' | 'bonus' | 'achievement' | 'alert' | 'fun' | 'weather' | 'birthday';
  priority: 'normal' | 'urgent' | 'critical';
  relatedAgent?: string;
  relatedAgentName?: string;
  teamId?: string;
  timestamp: number;
  isPinned?: boolean;
  isGodMessage?: boolean;
  visibility: 'all' | 'admin_only' | 'supervisor_only' | 'team_only';
}

export interface ShiftConfig {
  breakCapacity: number;
  maxSlots: number;
  maxSlotDuration: number; // 15 mins
  maxTotalBreakTime: number; // 60 mins
  maxWCTime: number; // 20 mins
  shiftStartHour: number; // 22 (10 PM)
  shiftEndHour: number; // 6 (6 AM)
  restrictedFirstHour: boolean; // 10-11 PM
  restrictedLastHour: boolean; // 5-6 AM
  restrictedHoursApplyToWC: boolean; // false
  masterBreakBlock: boolean;
  blockedAgents: string[];
  maintenanceMode: boolean;
  maintenanceMessage: string;
  rallyModeActive: boolean;
  rallyModeStartedBy?: string;
  rallyModeEndsAt?: number;
  rallyModeMessage?: string;
  featuresEnabled: {
    bonusBreaks: boolean;
    warnings: boolean;
    ticker: boolean;
    animations: boolean;
    messaging: boolean;
    competitions: boolean;
    goals: boolean;
    weather: boolean;
    birthdays: boolean;
    leaderboards: boolean;
  };
  autoWarningThresholds: {
    slotOverrunL1Min: number;
    slotOverrunL1Max: number;
    slotOverrunL2Max: number;
    l1EscalationCount: number;
    l2EscalationCount: number;
  };
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  messageText: string;
  timestamp: number;
  read: boolean;
  attachments?: { type: string; url: string; fileName: string }[];
  reactions?: Record<string, string[]>;
}

export interface Broadcast {
  broadcastId: string;
  messageType: 'announcement' | 'warning' | 'rally' | 'emergency';
  message: string;
  target: 'all' | 'team' | 'agents';
  targetTeamId?: string;
  sentBy: string;
  sentByName: string;
  sentAt: number;
  requireAcknowledgment: boolean;
  acknowledgments: Record<string, number>;
  priority: 'normal' | 'urgent' | 'critical';
}

export interface AuditLogEntry {
  logId: string;
  timestamp: number;
  action: string;
  actionCategory: 'break' | 'warning' | 'admin' | 'system' | 'auth';
  performedBy: string;
  performedByName: string;
  performedByRole: UserRole;
  targetUser?: string;
  targetUserName?: string;
  targetTeamId?: string;
  details: Record<string, any>;
}

export interface ShiftNote {
  noteId: string;
  supervisorEmail: string;
  supervisorName: string;
  teamId: string;
  noteText: string;
  category: 'general' | 'warning' | 'praise' | 'alert' | 'handover';
  timestamp: number;
  forShiftDate: string;
  isPinned: boolean;
  mentionedAgents: string[];
}

export interface Competition {
  competitionId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  metric: 'fewest_warnings' | 'best_attendance' | 'quickest_breaks' | 'highest_streak';
  scores: Record<string, number>; // teamId -> score
  currentLeaderTeamId: string;
  prizeDescription: string;
  isActive: boolean;
  winnerTeamId?: string;
}
