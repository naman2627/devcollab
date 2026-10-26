import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },

    // Lowercased at write time so lookups by username are case-insensitive
    // without a collation or a regex scan.
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      match: [/^[a-z0-9_]+$/, 'Username may contain only letters, numbers and underscores'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    // select:false keeps the hash out of every ordinary query result, so a
    // controller cannot leak it by accident with res.json(user). The login
    // controller opts back in explicitly with .select('+password').
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },

    bio: { type: String, default: '', maxlength: 300 },
    avatar: {
      url: { type: String, default: '' },
      // Stored so a replacement upload can destroy the previous Cloudinary
      // asset instead of orphaning it.
      publicId: { type: String, default: '' },
    },
    skills: [{ type: String, trim: true, lowercase: true }],
    githubUrl: { type: String, default: '' },

    // Denormalised in both directions. WHY: the "following" feed needs the
    // list of people I follow on every request; a separate join collection
    // would add a round trip to the hottest query in the app.
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Text index so /api/users/search?q= matches name and username in one pass
// instead of two case-insensitive regex scans.
userSchema.index({ name: 'text', username: 'text' });

/**
 * Hash on save, never in a controller.
 *
 * WHY here: every write path (register, seed script, password change) goes
 * through save(), so hashing cannot be forgotten at a call site. The
 * isModified guard stops a profile edit from re-hashing an already hashed
 * password, which would silently lock the user out.
 */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  // 12 rounds: ~250ms per hash, slow enough to blunt offline cracking and
  // fast enough that login still feels instant.
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
