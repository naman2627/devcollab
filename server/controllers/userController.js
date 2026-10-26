import mongoose from 'mongoose';
import User from '../models/User.js';
import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { readPaging, paginated } from '../utils/pagination.js';
import { publicUser } from './authController.js';
import { cloudinaryEnabled, uploadBuffer, destroyImage } from '../config/cloudinary.js';
import { emitToUser } from '../sockets/index.js';

// GET /api/users/search?q=&page=&limit=
export const searchUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = readPaging(req.query, { defaultLimit: 10 });
  const q = String(req.query.q || '').trim();

  // Prefix regex rather than the text index here. WHY: a user typing "ali"
  // expects to find "alice" - $text only matches whole words, so it would
  // return nothing until the name is fully typed. Anchored with ^ so the index
  // on username can still help and we never scan with a leading wildcard.
  const filter = q
    ? {
        $or: [
          { username: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } },
          { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        ],
      }
    : {};

  // countDocuments and find in parallel: they are independent, so awaiting
  // them in sequence would double the latency of every list endpoint.
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  res.json(paginated({ page, limit, total, data: users.map(publicUser) }));
});

// GET /api/users/:username
export const getUserByUsername = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() })
    .populate('followers', 'name username avatar')
    .populate('following', 'name username avatar');

  if (!user) throw new ApiError(404, 'No such user.');

  // The profile page always shows the projects strip, so fetching it here
  // saves the client a second round trip on first paint.
  const projects = await Project.find({ owner: user._id })
    .sort({ createdAt: -1 })
    .limit(12)
    .populate('owner', 'name username avatar')
    .lean();

  res.json({
    success: true,
    data: {
      ...publicUser(user),
      followers: user.followers,
      following: user.following,
      projects,
      projectCount: projects.length,
    },
  });
});

// PATCH /api/users/me
export const updateMe = asyncHandler(async (req, res) => {
  const { name, bio, githubUrl, skills, avatarUrl } = req.body;

  // Explicit field-by-field assignment, never Object.assign(user, req.body).
  // WHY: a mass assignment would let a caller POST {"password": "..."} or
  // {"followers": [...]} and overwrite fields this endpoint has no business
  // touching.
  if (name !== undefined) req.user.name = name;
  if (bio !== undefined) req.user.bio = bio;
  if (githubUrl !== undefined) req.user.githubUrl = githubUrl;
  if (skills !== undefined) {
    req.user.skills = Array.isArray(skills)
      ? skills
      : String(skills)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  }

  // The no-Cloudinary path: accept a plain URL string so the feature still
  // works on a clone with no image credentials.
  if (avatarUrl !== undefined && !cloudinaryEnabled) {
    req.user.avatar = { url: avatarUrl, publicId: '' };
  }

  await req.user.save();
  res.json({ success: true, data: publicUser(req.user) });
});

// PATCH /api/users/me/avatar  (multipart, field name: "image")
export const updateAvatar = asyncHandler(async (req, res) => {
  if (!cloudinaryEnabled) {
    // 503 rather than 400: the request was fine, the server just has no image
    // backend configured. The client reads this and falls back to the URL field.
    throw new ApiError(503, 'Image uploads are not configured. Send avatarUrl to PATCH /api/users/me instead.');
  }
  if (!req.file) throw new ApiError(400, 'No image file received.');

  const result = await uploadBuffer(req.file.buffer, 'devcollab/avatars');

  // Delete the previous asset only AFTER the new upload succeeded, so a failed
  // upload never leaves the user with no avatar at all.
  const oldPublicId = req.user.avatar?.publicId;
  req.user.avatar = { url: result.secure_url, publicId: result.public_id };
  await req.user.save();
  await destroyImage(oldPublicId);

  res.json({ success: true, data: publicUser(req.user) });
});

// POST /api/users/:id/follow  (toggle)
export const toggleFollow = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  if (!mongoose.isValidObjectId(targetId)) throw new ApiError(400, 'Invalid user id.');
  if (String(targetId) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot follow yourself.');
  }

  const target = await User.findById(targetId);
  if (!target) throw new ApiError(404, 'No such user.');

  const following = req.user.following.some((id) => String(id) === String(targetId));

  // $addToSet / $pull via updateOne, not push-then-save. WHY: these are atomic
  // server-side operators, so two concurrent follow clicks cannot produce a
  // duplicate entry or lose one - and $addToSet makes the whole thing
  // idempotent, which matters for a toggle a user can double-click.
  if (following) {
    await Promise.all([
      User.updateOne({ _id: req.user._id }, { $pull: { following: targetId } }),
      User.updateOne({ _id: targetId }, { $pull: { followers: req.user._id } }),
    ]);
  } else {
    await Promise.all([
      User.updateOne({ _id: req.user._id }, { $addToSet: { following: targetId } }),
      User.updateOne({ _id: targetId }, { $addToSet: { followers: req.user._id } }),
    ]);

    const note = await Notification.create({
      recipient: targetId,
      sender: req.user._id,
      type: 'follow',
      text: `@${req.user.username} started following you`,
    });
    emitToUser(targetId, 'notification:new', note);
  }

  res.json({
    success: true,
    data: { following: !following, followerCount: target.followers.length + (following ? -1 : 1) },
  });
});
