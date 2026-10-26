import { Router } from 'express';
import {
  listConversations,
  getThread,
  sendMessage,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect); // private by definition

// /conversations before /:userId, same wildcard-shadowing reason as elsewhere.
router.get('/conversations', listConversations);
router.get('/:userId', getThread);
router.post('/:userId', sendMessage);

export default router;
