import { Router } from 'express';
import * as locationController from '../../controllers/location.controller';
import * as reportController from '../../controllers/report.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.get('/nearby', locationController.getNearby);
router.get('/bbox', locationController.getInBbox);
router.post('/:id/reports', requireAuth, reportController.createReport);
router.get('/:id', locationController.getById);

export default router;
