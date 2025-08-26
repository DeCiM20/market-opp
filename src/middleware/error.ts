export const ERROR_CODES = {
  BAD_REQUEST: 400,
  // Internal JSON-RPC error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  // Implementation specific errors
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  SESSION_EXPIRED: 419,
}

export class ExpressError extends Error {
  public readonly code
  public readonly error: unknown

  constructor(opts: { message?: string; error?: unknown; code: keyof typeof ERROR_CODES }) {
    const message = opts.message ?? "Something went extremely wrong!!"
    const error = opts.error ?? "Unknown"

    super(message)

    this.code = opts.code
    this.name = "ExpressError"
    this.error = error
  }
}
