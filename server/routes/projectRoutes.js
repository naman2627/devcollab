import { Router } from 'express';
import {
  listProjects,
  projectStats,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  toggleLike,
} from '../controllers/projectController.js';
import { listComments, addComment, deleteComment } from '../controllers/commentController.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { singleImage } from '../middleware/upload.js';

const router = Router();

// /stats before /:id, or "stats" would be parsed as a project id and 400.
router.get('/stats', projectStats);

// optionalAuth, not protect: the feed is public, but a logged-in visitor needs
// their own like state and the following tab.
router.get('/', optionalAuth, listProjects);
router.post('/', protect, singleImage('coverImage'), createProject);

router.get('/:id', optionalAuth, getProject);
router.patch('/:id', protect, singleImage('coverImage'), updateProject);
router.delete('/:id', protect, deleteProject);

router.post('/:id/like', protect, toggleLike);

// Comments are nested under their project because they have no life of their
// own - you never list "all comments" in this app.
router.get('/:id/comments', listComments);
router.post('/:id/comments', protect, addComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);

export default router;
