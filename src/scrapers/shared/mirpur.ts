import { PeekabooBranch } from '../peekaboo/types';

/** Peekaboo does not support "Mirpur" as a search city — scrape these and filter. */
export const MIRPUR_PROXY_CITIES = ['Kotli', 'Bhimber', 'Muzaffarabad', 'Rawalakot'] as const;

export function isMirpurBranch(branch: PeekabooBranch): boolean {
  const haystack = [branch.city, branch.name, branch.address].join(' ').toLowerCase();
  return haystack.includes('mirpur');
}

export function dedupeBranches(branches: PeekabooBranch[]): PeekabooBranch[] {
  const map = new Map<number, PeekabooBranch>();
  for (const branch of branches) {
    map.set(branch.id, branch);
  }
  return [...map.values()];
}
