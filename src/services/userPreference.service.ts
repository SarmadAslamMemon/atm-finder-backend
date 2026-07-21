import { UserPreference } from '../models';

export async function getUserPreferences(userId: string) {
  let prefs = await UserPreference.findOne({ userId }).lean();
  if (!prefs) {
    prefs = (await UserPreference.create({ userId })).toObject();
  }

  return {
    defaultCity: prefs.defaultCity ?? null,
    defaultRadius: prefs.defaultRadius,
    notificationsEnabled: prefs.notificationsEnabled,
  };
}

export async function updateUserPreferences(
  userId: string,
  input: {
    defaultCity?: string | null;
    defaultRadius?: string;
    notificationsEnabled?: boolean;
  }
) {
  const update: Record<string, unknown> = {};
  if (input.defaultCity !== undefined) update.defaultCity = input.defaultCity || undefined;
  if (input.defaultRadius !== undefined) update.defaultRadius = input.defaultRadius;
  if (input.notificationsEnabled !== undefined) update.notificationsEnabled = input.notificationsEnabled;

  const prefs = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, new: true }
  ).lean();

  return {
    defaultCity: prefs?.defaultCity ?? null,
    defaultRadius: prefs?.defaultRadius ?? '3km',
    notificationsEnabled: prefs?.notificationsEnabled ?? true,
  };
}
