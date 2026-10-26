import mongoose from 'mongoose';

/**
 * Deterministic conversation key for a pair of users.
 *
 * WHY: a DM thread has to be findable by either participant with ONE equality
 * lookup. Sorting the two ids before joining them means A->B and B->A produce
 * an identical key, so there is no $or query, no duplicate thread documents,
 * and no separate Conversation collection to keep in sync.
 */
export const conversationKey = (a, b) => [String(a), String(b)].sort().join('_');

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: String, required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Chat history is always "this thread, newest page first". The compound index
// covers the match and the sort, which matters most here because this is the
// collection that grows fastest.
messageSchema.index({ conversation: 1, createdAt: -1 });

// Unread badge per recipient.
messageSchema.index({ recipient: 1, read: 1 });

export default mongoose.model('Message', messageSchema);
