import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const COOKIE_NAME = 'devcollab_token';

/**
 * Sign a 7-day JWT and put it in an httpOnly cookie.
 *
 * WHY a cookie and not a Bearer token in localStorage: anything readable by
 * JavaScript is readable by an XSS payload. httpOnly means the token is
 * invisible to scripts, and because the API and the React build are served
 * from the SAME origin we get it back automatically without CORS or
 * SameSite=None.
 */
export const sendTokenCookie = (res, user) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    // 'lax' is enough precisely because we are same-origin. It still blocks
    // the cross-site POST that CSRF depends on, without the 'none' + 'secure'
    // dance a split deploy would force on us.
    sameSite: 'lax',
    // Only require HTTPS in production - on localhost there is no TLS, and a
    // secure cookie would simply never be stored.
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // must match the JWT lifetime, or one outlives the other
    path: '/',
  });

  return token;
};

export const clearTokenCookie = (res) => {
  // Same attributes as when it was set: a cookie is only overwritten if
  // name + path + domain all match.
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
};

/** Verify a raw token string and return the user, or null. Shared with the socket layer. */
export const userFromToken = async (token) => {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Re-read the user on every request rather than trusting the payload:
    // a deleted account must stop working immediately, and we want fresh
    // following[] for the feed.
    return await User.findById(payload.id);
  } catch {
    // Expired or tampered token is not an exceptional condition, it is a
    // logged-out visitor. Returning null keeps the caller simple.
    return null;
  }
};

/** Hard gate: 401 unless a valid cookie is present. */
export const protect = asyncHandler(async (req, res, next) => {
  const user = await userFromToken(req.cookies?.[COOKIE_NAME]);
  if (!user) throw new ApiError(401, 'You must be logged in to do that.');
  req.user = user;
  next();
});

/**
 * Soft gate: attach req.user if logged in, otherwise continue anonymously.
 *
 * WHY: the feed and project pages are public, but still need to know whether
 * to draw a filled or hollow like button. Without this, every public read
 * would need a duplicate "logged in" route.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  req.user = await userFromToken(req.cookies?.[COOKIE_NAME]);
  next();
});
