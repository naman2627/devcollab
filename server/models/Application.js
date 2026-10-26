import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roleTitle: { type: String, required: true, trim: true },
    message: { type: String, default: '', trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

/**
 * One application per user per project, enforced by the DATABASE.
 *
 * WHY an index instead of a controller check: a findOne-then-create check is
 * racy. Two fast clicks (or a double-submitting client) interleave as
 * find / find / create / create, both checks pass, and you get duplicates. A
 * unique index makes the second write fail atomically with E11000, which the
 * controller translates into a clean 409.
 */
applicationSchema.index({ project: 1, applicant: 1 }, { unique: true });

// The owner dashboard lists applications per project, newest first.
applicationSchema.index({ project: 1, createdAt: -1 });
// The "sent" view lists one applicant's own applications, newest first.
applicationSchema.index({ applicant: 1, createdAt: -1 });

export default mongoose.model('Application', applicationSchema);
