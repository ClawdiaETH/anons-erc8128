/**
 * auth middleware — re-exports from routes/auth.ts for backward compat.
 * SIWA-based auth is now live; placeholder X-Agent-Address header removed.
 */
export { requireAuth, requireMember, requireHolder } from '../routes/auth.js';
