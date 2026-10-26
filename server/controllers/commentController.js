import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { readPaging, paginated } from '../utils/pagination.js';
import { emitToUser } from '../sockets/index.js';

// GET /api/projects/:id/comments
export const listComments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid project id.');

  const { page, limit, skip } = readPaging(req.query, { defaultLimit: 10 });
  const filter = { project: id };

  const [total, comments] = await Promise.all([
    Comment.countDocuments(filter),
    Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name username avatar')
      .lean(),
  ]);

  res.json(paginated({ page, limit, total, data: comments }));
});

// POST /api/projects/:id/comments
export const addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const text = String(req.body.text || '').trim();

  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid project id.');
  if (!text) throw new ApiError(400, 'Comment cannot be empty.');

  // Confirm the project exists before writing a comment that would otherwise
  // dangle off a deleted id.
  const project = await Project.findById(id).select('owner title');
  if (!project) throw new ApiError(404, 'No such project.');

  const comment = await Comment.create({ project: id, author: req.user._id, text });

  // $inc, not a read-modify-write. WHY: two people commenting at the same
  // moment would both read the same count and both write count+1, losing one.
  // $inc is applied by the server atomically.
  await Project.updateOne({ _id: id }, { $inc: { commentCount: 1 } });

  if (String(project.owner) !== String(req.user._id)) {
    const note = await Notification.create({
      recipient: project.owner,
      sender: req.user._id,
      type: 'comment',
      project: project._id,
      text: `@${req.user.username} commented on "${project.title}"`,
    });
    emitToUser(project.owner, 'notification:new', note);
  }

  await comment.populate('author', 'name username avatar');
  res.status(201).json({ success: true, data: comment });
});

// DELETE /api/projects/:id/comments/:commentId
export const deleteComment = asyncHandler(async (req, res) => {
  const { id, commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId)) throw new ApiError(400, 'Invalid comment id.');

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, 'No such comment.');

  // Two people may delete a comment: its author, and the owner of the project
  // it sits under (so an owner can moderate their own page).
  const project = await Project.findById(comment.project).select('owner');
  const isAuthor = String(comment.author) === String(req.user._id);
  const isProjectOwner = project && String(project.owner) === String(req.user._id);
  if (!isAuthor && !isProjectOwner) {
    throw new ApiError(403, 'You can only delete your own comments.');
  }

  await comment.deleteOne();
  // Floor at zero via $max so a double-delete or an old orphaned row can never
  // drive the displayed count negative.
  await Project.updateOne({ _id: id }, { $inc: { commentCount: -1 } });
  await Project.updateOne({ _id: id, commentCount: { $lt: 0 } }, { $set: { commentCount: 0 } });

  res.json({ success: true, message: 'Comment deleted.' });
});
