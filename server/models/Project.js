import mongoose from 'mongoose';

// Subdocument rather than its own collection: a role has no meaning outside
// its project and is never queried on its own.
const roleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    count: { type: Number, default: 1, min: 1 },
    filled: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    summary: { type: String, required: [true, 'Summary is required'], trim: true, maxlength: 240 },
    description: { type: String, default: '', maxlength: 8000 },
    coverImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    techStack: [{ type: String, trim: true, lowercase: true }],
    rolesNeeded: [roleSchema],
    repoUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['recruiting', 'in-progress', 'completed'],
      default: 'recruiting',
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // An array of user ids, not a counter. WHY: the UI must answer "has THIS
    // user liked it?" while rendering, which a bare number cannot do. Side
    // projects collect tens of likes, not millions, so the array stays small.
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Denormalised counter. WHY: every feed card shows a comment count, and
    // counting the Comment collection per card would be N+1 queries per page.
    // Kept honest with $inc on comment create and delete.
    commentCount: { type: Number, default: 0 },

    views: { type: Number, default: 0 },
    aiGenerated: { type: Boolean, default: false }, // honesty flag, shown in the UI
  },
  { timestamps: true }
);

// Feed index. The default feed matches on status then sorts newest-first, so a
// compound index in exactly that order lets Mongo serve both the filter and
// the sort from the index - no in-memory sort, no collection scan.
projectSchema.index({ status: 1, createdAt: -1 });

// Search index. Mongo allows only ONE text index per collection, so title and
// summary share it; the weights make a title hit outrank a summary hit.
projectSchema.index({ title: 'text', summary: 'text' }, { weights: { title: 5, summary: 1 } });

// Multikey index over the array elements, which is what makes ?tech=react a
// lookup rather than a scan.
projectSchema.index({ techStack: 1 });

export default mongoose.model('Project', projectSchema);
