import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendTokenCookie, clearTokenCookie } from '../middleware/auth.js';

/**
 * Shape a user document for the client.
 *
 * WHY a whitelist and not `delete user.password`: an allow-list cannot leak a
 * field added to the schema later. A deny-list has to be remembered every time
 * the model grows.
 */
const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  bio: user.bio,
  avatar: user.avatar,
  skills: user.skills,
  githubUrl: user.githubUrl,
  followers: user.followers,
  following: user.following,
  createdAt: user.createdAt,
});

export { publicUser };

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, username, email, password } = req.body;

  if (!name || !username || !email || !password) {
    throw new ApiError(400, 'Name, username, email and password are all required.');
  }

  // No pre-flight "does this email exist" query: the unique indexes on email
  // and username decide, and E11000 becomes a 409 in the error handler. A
  // findOne check here would be racy under two simultaneous signups.
  const user = await User.create({
    name,
    username: String(username).toLowerCase(),
    email,
    password,
  });

  sendTokenCookie(res, user);
  res.status(201).json({ success: true, data: publicUser(user) });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  // +password because the field is select:false in the schema.
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');

  // One identical message and one identical code for "no such email" and
  // "wrong password". WHY: differentiating them turns the login form into an
  // account-enumeration oracle - an attacker could harvest which emails are
  // registered without ever guessing a password.
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  sendTokenCookie(res, user);
  res.json({ success: true, data: publicUser(user) });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  clearTokenCookie(res);
  res.json({ success: true, message: 'Logged out.' });
});

// GET /api/auth/me - how the client rehydrates its session on a hard refresh.
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});
