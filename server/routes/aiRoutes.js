import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { describe, aiStatus } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

/**
 * Tighter limit than anything else in the API.
 *
 * WHY: every call to this route costs real money at Google. 10 drafts per
 * 10 minutes per IP is generous for a human writing one project page and
 * useless to anyone looping the endpoint to burn the key.
 */
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'AI drafting limit reached. Try again in a few minutes.' },
});

router.get('/status', aiStatus);
router.post('/describe', protect, aiLimiter, describe);

export default router;
