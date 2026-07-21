import { Router } from 'express';
import authRoutes from './auth.routes';
import locationsRoutes from './locations.routes';
import meRoutes from './me.routes';
import * as geocodeController from '../../controllers/geocode.controller';
import * as locationController from '../../controllers/location.controller';

const router = Router();

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.get('/providers', locationController.listProviders);
router.get('/location-types', locationController.listLocationTypes);
router.get('/cities', locationController.listCities);
router.get('/geocode/reverse', geocodeController.getReverseGeocode);
router.use('/locations', locationsRoutes);

export default router;
