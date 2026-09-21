import { Router } from 'express';
import * as authController from '../../controllers/auth.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.get('/me', requireAuth, authController.me);
router.get('/profile', requireAuth, authController.me);
router.patch('/profile', requireAuth, authController.updateProfile);

export default router;
