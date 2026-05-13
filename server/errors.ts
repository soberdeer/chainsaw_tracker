export function toHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : undefined;

  if (
    message.includes('Database `compact_tracker` does not exist') ||
    message.includes("Environment variable not found: DATABASE_URL") ||
    message.includes("Can't reach database server")
  ) {
    return {
      statusCode: 503,
      body: {
        error: 'Database is not ready',
        detail: 'Start Postgres and run migrations: npm run setup'
      }
    };
  }

  return {
    statusCode: statusCode || 400,
    body: { error: message || 'Unexpected error' }
  };
}
