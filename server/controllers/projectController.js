import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Comment from '../models/Comment.js';
import Application from '../models/Application.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { readPaging, paginated } from '../utils/pagination.js';
import { cloudinaryEnabled, uploadBuffer, destroyImage } from '../config/cloudinary.js';
import { emitToUser } from '../sockets/index.js';

// Fields the feed needs for an owner chip - deliberately not the whole user
// document, because that would ship followers[] and following[] per card.
const OWNER_FIELDS = 'name username avatar';

/** Normalise a comma string or array into a clean lowercase tag list. */
const toList = (value) => {
  if (value === undefined) return undefined;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
};

/**
 * rolesNeeded arrives from a multipart form as a JSON string, and from a JSON
 * body as a real array. Parsing in one place keeps create and update honest.
 */
const toRoles = (value) => {
  if (value === undefined) return undefined;
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new ApiError(400, 'rolesNeeded must be valid JSON.');
    }
  }
  if (!Array.isArray(raw)) throw new ApiError(400, 'rolesNeeded must be an array.');
  return raw
    .filter((r) => r && String(r.title || '').trim())
    .map((r) => ({
      title: String(r.title).trim(),
      count: Math.max(1, parseInt(r.count, 10) || 1),
      // `filled` is server-owned. WHY: accepting it from the client would let
      // an owner mark a role full without anyone being accepted, or worse,
      // let a stale form overwrite a real acceptance.
      filled: 0,
    }));
};

// GET /api/projects?page&limit&q&tech&status&sort&feed=following
export const listProjects = asyncHandler(async (req, res) => {
  const { page, limit, skip } = readPaging(req.query, { defaultLimit: 9, maxLimit: 30 });
  const { q, tech, status, sort = 'new', feed } = req.query;

  const filter = {};
  if (status && ['recruiting', 'in-progress', 'completed'].includes(status)) {
    filter.status = status;
  }
  if (tech) filter.techStack = { $in: toList(tech) };

  // "Following" feed. WHY the filter lives here rather than a separate route:
  // the tabs share every other filter and the pagination envelope, so forking
  // the endpoint would duplicate all of it. An empty following list must
  // return nothing, not everything - hence $in on a possibly empty array,
  // which Mongo correctly matches zero documents against.
  if (feed === 'following') {
    if (!req.user) throw new ApiError(401, 'Log in to see your following feed.');
    filter.owner = { $in: req.user.following };
  }

  // Text search when a query is present. $meta textScore is only available as
  // a sort key when the query actually uses $text, which is why the sort is
  // chosen inside this branch.
  let sortSpec = { createdAt: -1 };
  let projection = null;
  if (q && String(q).trim()) {
    filter.$text = { $search: String(q).trim() };
    projection = { score: { $meta: 'textScore' } };
    sortSpec = { score: { $meta: 'textScore' } };
  } else if (sort === 'popular') {
    // Sort by the length of likes[] is not indexable, so popularity sorts on
    // views + comment count, both plain numbers.
    sortSpec = { views: -1, commentCount: -1, createdAt: -1 };
  } else if (sort === 'oldest') {
    sortSpec = { createdAt: 1 };
  }

  const query = Project.find(filter, projection)
    .sort(sortSpec)
    .skip(skip)
    .limit(limit)
    .populate('owner', OWNER_FIELDS)
    .lean(); // plain objects: these documents are read once and serialised

  const [total, projects] = await Promise.all([Project.countDocuments(filter), query]);

  res.json(paginated({ page, limit, total, data: projects }));
});

/**
 * GET /api/projects/stats - a single $facet aggregation.
 *
 * WHY $facet: the landing page wants four unrelated numbers (totals, a
 * breakdown by status, the top tech tags, the busiest projects). Four separate
 * queries would be four round trips to Atlas; $facet runs all of them over one
 * pass of the same input documents and returns one document.
 */
export const projectStats = asyncHandler(async (req, res) => {
  const [stats] = await Project.aggregate([
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              projects: { $sum: 1 },
              views: { $sum: '$views' },
              comments: { $sum: '$commentCount' },
              // likes[] is an array, so its size has to be summed explicitly.
              likes: { $sum: { $size: '$likes' } },
            },
          },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        topTech: [
          { $unwind: '$techStack' }, // one document per tag, then count them
          { $group: { _id: '$techStack', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ],
        mostActive: [
          { $sort: { commentCount: -1, views: -1 } },
          { $limit: 5 },
          { $project: { title: 1, commentCount: 1, views: 1, status: 1 } },
        ],
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      // $group over an empty collection yields an empty array, so the fallback
      // keeps the client from reading properties of undefined on a fresh DB.
      totals: stats.totals[0] || { projects: 0, views: 0, comments: 0, likes: 0 },
      byStatus: stats.byStatus,
      topTech: stats.topTech,
      mostActive: stats.mostActive,
    },
  });
});

// GET /api/projects/:id
export const getProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid project id.');

  // $inc in the same call that fetches, so a view is counted without a second
  // write round trip. new:true returns the already-incremented document.
  const project = await Project.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true })
    .populate('owner', OWNER_FIELDS)
    .populate('collaborators', OWNER_FIELDS);

  if (!project) throw new ApiError(404, 'No such project.');

  // Tell the caller their own relationship to this project, so the client does
  // not have to scan likes[] (and cannot get it wrong when logged out).
  const viewer = req.user
    ? {
        hasLiked: project.likes.some((uid) => String(uid) === String(req.user._id)),
        isOwner: String(project.owner._id) === String(req.user._id),
        myApplication: await Application.findOne({
          project: project._id,
          applicant: req.user._id,
        }).select('status roleTitle'),
      }
    : { hasLiked: false, isOwner: false, myApplication: null };

  res.json({ success: true, data: project, viewer });
});

// POST /api/projects
export const createProject = asyncHandler(async (req, res) => {
  const { title, summary, description, repoUrl, status, difficulty, coverImageUrl, aiGenerated } =
    req.body;

  if (!title || !summary) throw new ApiError(400, 'Title and summary are required.');

  const coverImage = { url: '', publicId: '' };
  if (req.file && cloudinaryEnabled) {
    const result = await uploadBuffer(req.file.buffer, 'devcollab/projects');
    coverImage.url = result.secure_url;
    coverImage.publicId = result.public_id;
  } else if (coverImageUrl) {
    // Degraded path: plain URL accepted when there is no Cloudinary account.
    coverImage.url = coverImageUrl;
  }

  const project = await Project.create({
    owner: req.user._id,
    title,
    summary,
    description: description || '',
    coverImage,
    techStack: toList(req.body.techStack) || [],
    rolesNeeded: toRoles(req.body.rolesNeeded) || [],
    repoUrl: repoUrl || '',
    status: status || 'recruiting',
    difficulty: difficulty || 'intermediate',
    // Coerced from a string because multipart bodies have no booleans.
    aiGenerated: aiGenerated === true || aiGenerated === 'true',
  });

  await project.populate('owner', OWNER_FIELDS);
  res.status(201).json({ success: true, data: project });
});

/**
 * Load a project and assert the caller owns it.
 *
 * WHY a helper: update and delete both need it, and an ownership check that
 * exists in one of them but not the other is the classic way an edit endpoint
 * becomes "anyone can edit anything".
 */
const findOwnedProject = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid project id.');
  const project = await Project.findById(id);
  if (!project) throw new ApiError(404, 'No such project.');
  if (String(project.owner) !== String(user._id)) {
    // 403, not 404: the resource exists, the caller simply may not touch it.
    throw new ApiError(403, 'Only the project owner can do that.');
  }
  return project;
};

// PATCH /api/projects/:id
export const updateProject = asyncHandler(async (req, res) => {
  const project = await findOwnedProject(req.params.id, req.user);

  const { title, summary, description, repoUrl, status, difficulty, coverImageUrl } = req.body;
  if (title !== undefined) project.title = title;
  if (summary !== undefined) project.summary = summary;
  if (description !== undefined) project.description = description;
  if (repoUrl !== undefined) project.repoUrl = repoUrl;
  if (status !== undefined) project.status = status;
  if (difficulty !== undefined) project.difficulty = difficulty;

  const tech = toList(req.body.techStack);
  if (tech) project.techStack = tech;

  // Roles are replaced wholesale, but `filled` is carried over by title so an
  // edit does not wipe out who has already been accepted.
  const roles = toRoles(req.body.rolesNeeded);
  if (roles) {
    project.rolesNeeded = roles.map((role) => {
      const existing = project.rolesNeeded.find((r) => r.title === role.title);
      return { ...role, filled: existing ? existing.filled : 0 };
    });
  }

  if (req.file && cloudinaryEnabled) {
    const result = await uploadBuffer(req.file.buffer, 'devcollab/projects');
    const old = project.coverImage?.publicId;
    project.coverImage = { url: result.secure_url, publicId: result.public_id };
    await destroyImage(old);
  } else if (coverImageUrl !== undefined) {
    project.coverImage = { url: coverImageUrl, publicId: '' };
  }

  await project.save();
  await project.populate('owner', OWNER_FIELDS);
  res.json({ success: true, data: project });
});

// DELETE /api/projects/:id
export const deleteProject = asyncHandler(async (req, res) => {
  const project = await findOwnedProject(req.params.id, req.user);

  // Clean up the children explicitly. WHY: Mongo has no foreign keys and no
  // ON DELETE CASCADE, so without this the comments and applications stay
  // forever, pointing at an id that no longer resolves - and the applications
  // dashboard would render rows with a null project.
  await Promise.all([
    Comment.deleteMany({ project: project._id }),
    Application.deleteMany({ project: project._id }),
    Notification.deleteMany({ project: project._id }),
    destroyImage(project.coverImage?.publicId),
  ]);

  await project.deleteOne();
  res.json({ success: true, message: 'Project deleted.' });
});

// POST /api/projects/:id/like  (toggle)
export const toggleLike = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid project id.');

  const project = await Project.findById(id).select('likes owner title');
  if (!project) throw new ApiError(404, 'No such project.');

  const liked = project.likes.some((uid) => String(uid) === String(req.user._id));

  // Atomic operators again, and the returned document gives us the true count
  // after the write rather than our local guess at it.
  const updated = await Project.findByIdAndUpdate(
    id,
    liked ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } },
    { new: true, select: 'likes' }
  );

  // Only notify on a NEW like, and never for your own project - otherwise
  // un-liking and re-liking would spam the owner's bell.
  if (!liked && String(project.owner) !== String(req.user._id)) {
    const note = await Notification.create({
      recipient: project.owner,
      sender: req.user._id,
      type: 'like',
      project: project._id,
      text: `@${req.user.username} upvoted "${project.title}"`,
    });
    emitToUser(project.owner, 'notification:new', note);
  }

  res.json({ success: true, data: { hasLiked: !liked, likeCount: updated.likes.length } });
});
