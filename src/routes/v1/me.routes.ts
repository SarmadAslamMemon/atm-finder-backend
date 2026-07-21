import { Router } from 'express';
import * as userController from '../../controllers/user.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/saved-locations', userController.getSavedLocations);
router.get('/saved-location-ids', userController.getSavedLocationIds);
router.post('/saved-locations/:locationId', userController.saveLocation);
router.delete('/saved-locations/:locationId', userController.unsaveLocation);

router.get('/preferences', userController.getPreferences);
router.patch('/preferences', userController.updatePreferences);

export default router;
