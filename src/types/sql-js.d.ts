declare module 'sql.js' {
  // Minimal typing for the in-memory SQLite used to verify the SQL dump in tests.
  export default function initSqlJs(config?: Record<string, unknown>): Promise<any>;
}
