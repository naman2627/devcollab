import { Router } from 'express';
import {
  searchUsers,
  getUserByUsername,
  updateMe,
  updateAvatar,
  toggleFollow,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { singleImage } from '../middleware/upload.js';

const router = Router();

// Literal paths BEFORE the :username wildcard. WHY: Express matches in
// declaration order, so a later /search would be swallowed by /:username and
// we would spend the demo looking for a user literally named "search".
router.get('/search', searchUsers);

router.patch('/me', protect, updateMe);
router.patch('/me/avatar', protect, singleImage('image'), updateAvatar);

router.post('/:id/follow', protect, toggleFollow);
router.get('/:username', getUserByUsername);

export default router;
