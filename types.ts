// Shared domain types. The demo is intentionally data-driven; these flexible records
// keep locally seeded and Firestore users forward-compatible.
export type UserRole = 'agent' | 'supervisor' | 'admin' | 'developer';
export type BreakType = 'short' | 'meal' | 'wc' | 'bonus' | string;
export type User = Record<string, any> & { id: string; name: string; email: string; role: UserRole; teamId: string };
export type Team = Record<string, any> & { teamId: string; teamName: string };
export type BreakRecord = Record<string, any> & { breakId: string; agentEmail: string };
export type WCTracking = Record<string, any>;
export type Warning = Record<string, any> & { warningId: string };
export type SNNHeadline = Record<string, any> & { headlineId: string; headlineText: string; category: string; priority: string; timestamp: number; visibility: string };
export type ShiftConfig = Record<string, any>;
export type ChatMessage = Record<string, any>;
export type Broadcast = Record<string, any>;
export type AuditLogEntry = Record<string, any>;
export type ShiftNote = Record<string, any>;
export type Competition = Record<string, any>;
