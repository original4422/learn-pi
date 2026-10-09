import type { Consumer } from './contracts.ts';

export const decide: Consumer = observation => {
  const roles = observation.results
    .filter(result => result.status !== 'fulfilled' || result.truncated)
    .map(result => result.role);
  return { action: roles.length ? 'inspect' : 'summarize', roles };
};
