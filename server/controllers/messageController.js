import mongoose from 'mongoose';
import Message, { conversationKey } from '../models/Message.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { readPaging, paginated } from '../utils/pagination.js';
import { emitToUser, isOnline } from '../sockets/index.js';

/**
 * GET /api/messages/conversations - the chat sidebar.
 *
 * Aggregation rather than find(). WHY: we need ONE row per thread showing the
 * latest message, which no plain query can express - find() would return every
 * message and the client would have to group thousands of rows itself.
 */
export const listConversations = asyncHandler(async (req, res) => {
  const me = req.user._id;

  const threads = await Message.aggregate([
    // Only threads I am part of. First stage so the index does the narrowing
    // before any grouping work happens.
    { $match: { $or: [{ sender: me }, { recipient: me }] } },
    // _id breaks the tie. WHY: two messages can land in the same millisecond,
    // and createdAt alone would then make $first pick an arbitrary one of
    // them as "the latest". ObjectIds are monotonically increasing, so
    // _id descending is always true insertion order.
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: '$conversation',
        // $first after a descending sort = the most recent message in the thread.
        lastMessage: { $first: '$$ROOT' },
        unread: {
          // Count only the ones sent TO me and still unread - my own sent
          // messages are never "unread" for me.
          $sum: {
            $cond: [{ $and: [{ $eq: ['$recipient', me] }, { $eq: ['$read', false] }] }, 1, 0],
          },
        },
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
    { $limit: 30 },
  ]);

  // Resolve the other participant for each thread in ONE query rather than
  // populating inside the loop (which would be N queries for N threads).
  const otherIds = threads.map((t) =>
    String(t.lastMessage.sender) === String(me) ? t.lastMessage.recipient : t.lastMessage.sender
  );
  const users = await User.find({ _id: { $in: otherIds } })
    .select('name username avatar')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  res.json({
    success: true,
    data: threads.map((t, i) => ({
      conversation: t._id,
      user: byId.get(String(otherIds[i])) || null,
      lastMessage: t.lastMessage,
      unread: t.unread,
      online: isOnline(otherIds[i]),
    })),
  });
});

// GET /api/messages/:userId - paginated history with one person.
export const getThread = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, 'Invalid user id.');

  const { page, limit, skip } = readPaging(req.query, { defaultLimit: 30, maxLimit: 100 });
  const conversation = conversationKey(req.user._id, userId);
  const filter = { conversation };

  const [total, messages, other] = await Promise.all([
    Message.countDocuments(filter),
    // Newest-first for pagination (page 1 is the recent end of the thread),
    // then reversed below so the UI can render top-to-bottom.
    //
    // _id is the tiebreaker: messages sent in the same millisecond would
    // otherwise come back in an arbitrary order and the conversation would
    // read out of sequence. ObjectIds increase monotonically, so this is
    // exactly insertion order.
    Message.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    User.findById(userId).select('name username avatar').lean(),
  ]);

  if (!other) throw new ApiError(404, 'No such user.');

  // Opening a thread marks it read. updateMany in one call, not a loop.
  await Message.updateMany({ conversation, recipient: req.user._id, read: false }, { read: true });

  res.json({
    ...paginated({ page, limit, total, data: messages.reverse() }),
    user: other,
    online: isOnline(userId),
  });
});

/**
 * POST /api/messages/:userId - REST fallback for sending.
 *
 * WHY keep this when sockets exist: the smoke test and any client with a dead
 * websocket still need a way to send. It persists the same way and reuses
 * emitToUser, so a live recipient sees it instantly either way.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const text = String(req.body.text || '').trim();

  if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, 'Invalid user id.');
  if (!text) throw new ApiError(400, 'Message cannot be empty.');
  if (String(userId) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot message yourself.');
  }

  const recipient = await User.findById(userId).select('_id');
  if (!recipient) throw new ApiError(404, 'No such user.');

  const message = await Message.create({
    conversation: conversationKey(req.user._id, userId),
    sender: req.user._id,
    recipient: userId,
    text,
  });

  // Persisted first, emitted second - same ordering rule as the socket path.
  emitToUser(userId, 'message:new', message);
  emitToUser(req.user._id, 'message:new', message);

  res.status(201).json({ success: true, data: message });
});
