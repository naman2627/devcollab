import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

/**
 * Rate limit only the credential endpoints.
 *
 * WHY here and not globally: 20 attempts per 15 minutes would be absurd for
 * the feed, but it is exactly right for login, where unlimited attempts means
 * free offline-speed password guessing against a live account.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again in a few minutes.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', protect, me);

export default router;
