import bcrypt from 'bcryptjs';
import { User, UserPreference } from '../models';
import { signAccessToken } from '../utils/jwt';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function formatUser(user: { _id: unknown; name: string; email: string; createdAt?: Date }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new AuthError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await User.create({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    passwordHash,
  });

  await UserPreference.create({ userId: user._id });

  const token = signAccessToken({ userId: String(user._id), email: user.email });
  return { token, user: formatUser(user) };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email.toLowerCase().trim(), isActive: true });
  if (!user) {
    throw new AuthError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError('Invalid email or password', 401);
  }

  const token = signAccessToken({ userId: String(user._id), email: user.email });
  return { token, user: formatUser(user) };
}

export async function getUserById(userId: string) {
  const user = await User.findOne({ _id: userId, isActive: true }).select('name email createdAt');
  if (!user) return null;
  return formatUser(user);
}
