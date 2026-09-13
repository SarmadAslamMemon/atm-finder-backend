import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AuthError, getUserById, loginUser, registerUser, verifyOtpCode, resendOtpCode, updateUserProfile } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await registerUser(body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    throw err;
  }
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body);
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    throw err;
  }
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await getUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json({ user });
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const resendOtpSchema = z.object({
  email: z.string().email(),
});

export const verifyOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = verifyOtpSchema.parse(req.body);
    const result = await verifyOtpCode(body);
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    throw err;
  }
});

export const resendOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = resendOtpSchema.parse(req.body);
    const result = await resendOtpCode(body);
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    throw err;
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  avatar: z.string().nullable().optional(),
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = updateProfileSchema.parse(req.body);
    const result = await updateUserProfile(req.user!.userId, body);
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    throw err;
  }
});
