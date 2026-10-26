import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['like', 'comment', 'application', 'application-status', 'follow', 'message'],
      required: true,
    },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

    // Pre-rendered sentence. WHY: the bell has to render instantly without
    // populating a project and a user for each of 20 rows. The live documents
    // are still referenced above, for click-through links.
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// The unread-count query is literally {recipient, read:false}; this index
// answers it from the index alone, which is what makes the bell cheap.
notificationSchema.index({ recipient: 1, read: 1 });
// The dropdown itself is "my notifications, newest first".
notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
