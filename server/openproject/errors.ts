export class OpenProjectConfigError extends Error {
  statusCode = 500;

  constructor(message = 'OPENPROJECT_API_TOKEN is required for the OpenProject task tracker') {
    super(message);
    this.name = 'OpenProjectConfigError';
  }
}

export class OpenProjectApiError extends Error {
  statusCode: number;
  payload?: unknown;

  constructor(statusCode: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'OpenProjectApiError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}
