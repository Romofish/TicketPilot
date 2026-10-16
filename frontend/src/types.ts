export type Platform = 'allticket' | 'ttm';
export type SessionStatus = 'opening' | 'active' | 'failed' | 'closed';
export interface ResearchConfig {
  platforms: { id: Platform; label: string }[];
  browser_mode: 'headed' | 'headless';
  display_available: boolean;
  max_active_sessions: number;
  capture_cooldown_seconds: number;
}
export interface Session {
  id: string;
  platform: Platform;
  url: string;
  event_name: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  error: string | null;
}
export interface ResearchEvent {
  id: string;
  session_id: string;
  kind: string;
  created_at: string;
  data: Record<string, unknown>;
}
export interface Observation {
  page_type?: string;
  seat_state?: string;
  visible_counts?: Record<string, number>;
  evidence?: Record<string, boolean | string>;
  timing?: Record<string, number | null>;
  url?: string;
}
