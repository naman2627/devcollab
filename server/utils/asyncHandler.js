/**
 * Wraps an async route handler so a rejected promise reaches Express.
 *
 * WHY: Express 4 does not catch rejections from async functions - an
 * unhandled `await` failure leaves the request hanging forever and can take
 * the process down. Wrapping once here means NO controller in this codebase
 * needs try/catch: they just `throw`, and the global error middleware answers.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
