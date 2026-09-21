import bcrypt from 'bcryptjs';
import { User, UserPreference } from '../models';
import { signAccessToken } from '../utils/jwt';
import { sendOtpEmail } from './email.service';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatUser(user: { _id: unknown; name: string; email: string; avatar?: string | null; createdAt?: Date }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  
  if (existing) {
    if (existing.isActive) {
      throw new AuthError('Email already registered', 409);
    } else {
      // User registered but didn't verify. Overwrite password and generate new OTP.
      const passwordHash = await bcrypt.hash(input.password, 10);
      const otpCode = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      existing.name = input.name.trim();
      existing.passwordHash = passwordHash;
      existing.otpCode = otpCode;
      existing.otpExpiresAt = otpExpiresAt;
      await existing.save();

      await sendOtpEmail(existing.email, otpCode);

      return {
        success: true,
        message: 'OTP has been sent to your email. Please verify to activate your account.',
        email: existing.email,
      };
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const otpCode = generateOtp();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const user = await User.create({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    passwordHash,
    isActive: false, // Must verify OTP first
    otpCode,
    otpExpiresAt,
  });

  await UserPreference.create({ userId: user._id });

  await sendOtpEmail(user.email, otpCode);

  return {
    success: true,
    message: 'OTP has been sent to your email. Please verify to activate your account.',
    email: user.email,
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() });
  if (!user || !user.passwordHash) {
    throw new AuthError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    // Generate new OTP and resend
    const otpCode = generateOtp();
    user.otpCode = otpCode;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOtpEmail(user.email, otpCode);

    throw new AuthError('Please verify your account first. An OTP was sent to your email.', 403);
  }

  const token = signAccessToken({ userId: String(user._id), email: user.email });
  return { token, user: formatUser(user) };
}

export async function googleLoginUser(input: {
  idToken?: string;
  email: string;
  name: string;
  avatar?: string | null;
  googleId?: string;
}) {
  const cleanEmail = input.email.toLowerCase().trim();
  let user = await User.findOne({ email: cleanEmail });

  if (!user) {
    user = await User.create({
      name: input.name.trim() || 'Google User',
      email: cleanEmail,
      avatar: input.avatar ?? null,
      isActive: true,
      authProvider: 'google',
      googleId: input.googleId,
    });

    await UserPreference.create({ userId: user._id });
  } else {
    let updated = false;
    if (!user.isActive) {
      user.isActive = true;
      user.otpCode = undefined;
      user.otpExpiresAt = undefined;
      updated = true;
    }
    if (input.avatar && !user.avatar) {
      user.avatar = input.avatar;
      updated = true;
    }
    if (input.googleId && !user.googleId) {
      user.googleId = input.googleId;
      updated = true;
    }
    if (updated) {
      await user.save();
    }
  }

  const token = signAccessToken({ userId: String(user._id), email: user.email });
  return { token, user: formatUser(user) };
}

export async function getUserById(userId: string) {
  const user = await User.findOne({ _id: userId, isActive: true }).select('name email avatar createdAt');
  if (!user) return null;
  return formatUser(user);
}

export async function updateUserProfile(userId: string, input: { name?: string; avatar?: string | null }) {
  const updateData: { name?: string; avatar?: string | null } = {};
  if (input.name !== undefined && input.name.trim()) {
    updateData.name = input.name.trim();
  }
  if (input.avatar !== undefined) {
    updateData.avatar = input.avatar;
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, isActive: true },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!user) {
    throw new AuthError('User not found', 404);
  }

  return {
    success: true,
    message: 'Profile updated successfully',
    user: formatUser(user),
  };
}

export async function verifyOtpCode(input: { email: string; otp: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() });
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  if (user.isActive) {
    throw new AuthError('Account is already active', 400);
  }

  if (!user.otpCode || user.otpCode !== input.otp) {
    throw new AuthError('Invalid OTP code', 400);
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    throw new AuthError('OTP code has expired', 400);
  }

  // Activate user and clear OTP
  user.isActive = true;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const token = signAccessToken({ userId: String(user._id), email: user.email });
  return {
    success: true,
    message: 'Account verified successfully',
    token,
    user: formatUser(user),
  };
}

export async function resendOtpCode(input: { email: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() });
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  if (user.isActive) {
    throw new AuthError('Account is already active', 400);
  }

  const otpCode = generateOtp();
  user.otpCode = otpCode;
  user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save();

  await sendOtpEmail(user.email, otpCode);

  return {
    success: true,
    message: 'A new OTP has been sent to your email.',
  };
}
