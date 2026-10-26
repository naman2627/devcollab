import { Router } from 'express';
import {
  apply,
  decideApplication,
  receivedApplications,
  sentApplications,
} from '../controllers/applicationController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Nothing here is public - every route is about one identified person's
// applications, so protect is applied to the whole router rather than repeated
// five times (and so a new route added later cannot forget it).
router.use(protect);

router.get('/received', receivedApplications);
router.get('/sent', sentApplications);
router.post('/', apply);
router.patch('/:id', decideApplication);

export default router;
