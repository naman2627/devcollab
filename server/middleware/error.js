import ApiError from '../utils/ApiError.js';

/** 404 for any /api path that matched no route. Mounted after all routes. */
export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * The single error handler for the whole API.
 *
 * WHY one place: every controller throws instead of formatting its own error
 * response, so the JSON error shape is identical everywhere and the client
 * needs exactly one branch to read it. It also translates Mongo's internal
 * failures into HTTP, which is the thing controllers should never have to
 * know about.
 *
 * The 4-argument signature is required - Express identifies error middleware
 * by arity, so dropping the unused `next` would silently turn this back into
 * an ordinary middleware and errors would fall through to the default handler.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong.';

  // Mongoose schema validation: report every failing field at once, so a form
  // can show all its errors in one round trip.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(' ');
  }

  // A malformed ObjectId in the URL is a client mistake, not a server fault.
  // Without this it would surface as a 500 on every bad link.
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // E11000 = unique index violation. This is the path that turns our
  // deliberate {project, applicant} index into a friendly message, and it is
  // why the duplicate check lives in the database rather than a controller.
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {}).join(' + ');
    message =
      field.includes('applicant')
        ? 'You have already applied to this project.'
        : `That ${field || 'value'} is already taken.`;
  }

  // Never hand an internal stack or driver message to the browser. Operational
  // errors we threw on purpose are safe; anything else gets a generic line and
  // the real detail goes to the server log only.
  if (statusCode === 500 && !err.isOperational) {
    console.error('[error]', err);
    message = 'Internal server error.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Stack only outside production, so a demo can be debugged from the
    // network tab without leaking paths in the deployed app.
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
