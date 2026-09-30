export type Role = 'researcher' | 'reviewer';
export interface Observation {
  isError: boolean;
  results: {
    role: Role;
    status: 'fulfilled' | 'rejected' | 'cancelled';
    text?: string;
    error?: string;
    truncated?: boolean;
  }[];
}
export interface Decision {
  action: 'summarize' | 'inspect';
  roles: Role[];
}
export type Consumer = (observation: Observation) => Decision;
