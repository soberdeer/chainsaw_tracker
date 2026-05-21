export class ClickUpConfigError extends Error {
  statusCode = 503;

  constructor(
    message = 'CLICKUP_TOKEN is required only for the one-time ClickUp migration script'
  ) {
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
