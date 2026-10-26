import axios from 'axios';

/**
 * One axios instance for the whole app.
 *
 * baseURL is the RELATIVE '/api'. WHY relative and not an env-configured
 * absolute URL: in production Express serves this bundle from the same origin,
 * and in development Vite proxies /api to port 5000. Either way the browser
 * sees a same-origin request, so there is no VITE_API_URL to forget to set at
 * deploy time - the single most common way a MERN deploy breaks.
 */
const api = axios.create({
  baseURL: '/api',
  // Without this, axios drops the httpOnly auth cookie and every protected
  // call 401s. Same-origin or not, it has to be explicit.
  withCredentials: true,
  timeout: 30000, // AI drafting is the slow one, at up to 20s server-side
});

/**
 * Normalise every error into a plain message string.
 *
 * WHY an interceptor: the API always answers failures as
 * {success:false, message}. Unwrapping it once here means no component has to
 * write `err.response?.data?.message || err.message` - they just read
 * err.message and render it.
 */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED' ? 'That took too long. Try again.' : null) ||
      error.message ||
      'Something went wrong.';

    // Keep the status on the error so callers that care (401 -> log out) can
    // still branch on it.
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    return Promise.reject(wrapped);
  }
);

export default api;
