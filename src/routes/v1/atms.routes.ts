import { Router } from 'express';
import * as reportController from '../../controllers/report.controller';
import { optionalAuth } from '../../middleware/auth';

const router = Router();

router.post('/:atmId/reports', optionalAuth, reportController.submitAtmReport);

export default router;
