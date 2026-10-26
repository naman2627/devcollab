import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: 1000,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Every read of this collection is "newest comments for one project", so one
// compound index serves the filter and the sort together.
commentSchema.index({ project: 1, createdAt: -1 });

export default mongoose.model('Comment', commentSchema);
