import Notification from '../models/Notification.js';
import asyncHandler from '../utils/asyncHandler.js';
import { readPaging, paginated } from '../utils/pagination.js';

// GET /api/notifications
export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = readPaging(req.query, { defaultLimit: 15, maxLimit: 50 });
  const filter = { recipient: req.user._id };

  // Three parallel reads: the page, its total, and the unread badge. The badge
  // cannot be derived from the page (page 2 knows nothing about page 1), so it
  // needs its own count - but it runs concurrently, not after.
  const [total, notifications, unread] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name username avatar')
      .populate('project', 'title')
      .lean(),
    Notification.countDocuments({ ...filter, read: false }),
  ]);

  res.json({ ...paginated({ page, limit, total, data: notifications }), unread });
});

/**
 * PATCH /api/notifications/read - mark all mine as read.
 *
 * Scoped to recipient: req.user._id, so there is no id in the body a caller
 * could swap to mark someone else's notifications read.
 */
export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true }
  );
  res.json({ success: true, data: { modified: result.modifiedCount } });
});
