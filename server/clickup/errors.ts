export class ClickUpConfigError extends Error {
  statusCode = 503;

  constructor(message = 'CLICKUP_TOKEN is required for the ClickUp task tracker') {
    super(message);
  }
}

export class ClickUpApiError extends Error {
  statusCode: number;
  detail?: unknown;

  constructor(statusCode: number, message: string, detail?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;
  }
}
