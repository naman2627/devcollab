import mongoose from 'mongoose';
import Application from '../models/Application.js';
import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { readPaging, paginated } from '../utils/pagination.js';
import { emitToUser } from '../sockets/index.js';

// POST /api/applications
export const apply = asyncHandler(async (req, res) => {
  const { project: projectId, roleTitle, message } = req.body;

  if (!mongoose.isValidObjectId(projectId)) throw new ApiError(400, 'Invalid project id.');
  if (!roleTitle) throw new ApiError(400, 'Pick a role to apply for.');

  const project = await Project.findById(projectId).select('owner title rolesNeeded status');
  if (!project) throw new ApiError(404, 'No such project.');

  if (String(project.owner) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot apply to your own project.');
  }
  if (project.status === 'completed') {
    throw new ApiError(400, 'This project is finished and no longer recruiting.');
  }

  const role = project.rolesNeeded.find((r) => r.title === roleTitle);
  if (!role) throw new ApiError(400, 'That role does not exist on this project.');
  if (role.filled >= role.count) throw new ApiError(400, 'That role is already filled.');

  // No duplicate check here on purpose. The unique {project, applicant} index
  // does it atomically and the error handler turns E11000 into a 409 - see the
  // comment in models/Application.js for why a controller check would be racy.
  const application = await Application.create({
    project: projectId,
    applicant: req.user._id,
    roleTitle,
    message: message || '',
  });

  const note = await Notification.create({
    recipient: project.owner,
    sender: req.user._id,
    type: 'application',
    project: project._id,
    text: `@${req.user.username} applied for ${roleTitle} on "${project.title}"`,
  });
  emitToUser(project.owner, 'notification:new', note);

  await application.populate([
    { path: 'applicant', select: 'name username avatar skills' },
    { path: 'project', select: 'title' },
  ]);

  res.status(201).json({ success: true, data: application });
});

/**
 * PATCH /api/applications/:id  { status: 'accepted' | 'rejected' }
 *
 * Accepting is the one multi-document write in the app: it flips the
 * application, adds the user to collaborators[], and bumps role.filled.
 */
export const decideApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid application id.');
  if (!['accepted', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Status must be "accepted" or "rejected".');
  }

  const application = await Application.findById(id).populate('applicant', 'name username');
  if (!application) throw new ApiError(404, 'No such application.');

  const project = await Project.findById(application.project);
  if (!project) throw new ApiError(404, 'That project no longer exists.');

  // Only the project owner decides. Checked against the PROJECT, not against
  // anything in the request body, so a crafted payload cannot bypass it.
  if (String(project.owner) !== String(req.user._id)) {
    throw new ApiError(403, 'Only the project owner can decide applications.');
  }

  // Idempotence guard: without it, clicking Accept twice would add the person
  // to collaborators once but increment role.filled twice, permanently
  // over-filling the role.
  if (application.status !== 'pending') {
    throw new ApiError(409, `This application was already ${application.status}.`);
  }

  application.status = status;
  await application.save();

  if (status === 'accepted') {
    const role = project.rolesNeeded.find((r) => r.title === application.roleTitle);
    if (role && role.filled < role.count) role.filled += 1;

    // $addToSet semantics by hand, since we already have the document loaded.
    if (!project.collaborators.some((uid) => String(uid) === String(application.applicant._id))) {
      project.collaborators.push(application.applicant._id);
    }

    // A project with every role filled is no longer recruiting. Derived rather
    // than asked of the owner, so the feed filter stays truthful by itself.
    const allFilled =
      project.rolesNeeded.length > 0 && project.rolesNeeded.every((r) => r.filled >= r.count);
    if (allFilled && project.status === 'recruiting') project.status = 'in-progress';

    await project.save();
  }

  const note = await Notification.create({
    recipient: application.applicant._id,
    sender: req.user._id,
    type: 'application-status',
    project: project._id,
    text:
      status === 'accepted'
        ? `You were accepted as ${application.roleTitle} on "${project.title}"`
        : `Your application for ${application.roleTitle} on "${project.title}" was declined`,
  });
  emitToUser(application.applicant._id, 'notification:new', note);

  res.json({ success: true, data: application });
});

// GET /api/applications/received - applications on projects I own.
export const receivedApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = readPaging(req.query, { defaultLimit: 10 });

  // Two steps rather than an aggregation $lookup. WHY: the owner's project
  // list is short (a handful of ids), so an $in filter on an indexed field is
  // both faster and far easier to defend in a viva than a pipeline.
  const myProjects = await Project.find({ owner: req.user._id }).select('_id').lean();
  const filter = { project: { $in: myProjects.map((p) => p._id) } };
  if (req.query.status) filter.status = req.query.status;

  const [total, applications] = await Promise.all([
    Application.countDocuments(filter),
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('applicant', 'name username avatar skills githubUrl')
      .populate('project', 'title status')
      .lean(),
  ]);

  res.json(paginated({ page, limit, total, data: applications }));
});

// GET /api/applications/sent - applications I made.
export const sentApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = readPaging(req.query, { defaultLimit: 10 });
  const filter = { applicant: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const [total, applications] = await Promise.all([
    Application.countDocuments(filter),
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'project',
        select: 'title status owner coverImage',
        populate: { path: 'owner', select: 'name username avatar' },
      })
      .lean(),
  ]);

  res.json(paginated({ page, limit, total, data: applications }));
});
