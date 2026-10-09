import type { Consumer } from './contracts.ts';

// Exercise: a successful tool call can still carry incomplete child evidence.
export const decide: Consumer = observation => observation.isError
  ? { action: 'inspect', roles: ['researcher', 'reviewer'] }
  : { action: 'summarize', roles: [] };
