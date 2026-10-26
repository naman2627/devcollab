/**
 * A single Error subclass carrying an HTTP status code.
 *
 * WHY: controllers need to signal "this is a 404, not a crash". Without a
 * typed error the global error handler cannot tell an expected business
 * failure (bad password, missing project) from a genuine bug, and would have
 * to answer 500 for everything. `isOperational` marks the ones we threw on
 * purpose, so the handler can safely show their message to the user instead
 * of leaking internals.
 */
export default class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // Drop the ApiError constructor from the stack trace so the trace points
    // at the controller line that actually threw.
    Error.captureStackTrace(this, this.constructor);
  }
}
