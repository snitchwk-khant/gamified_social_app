import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

async function runHaptic(action) {
  try {
    await action();
  } catch {
    // Haptics are best-effort. Unsupported devices and browsers should stay silent.
  }
}

export function lightImpact() {
  return runHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
}

export function mediumImpact() {
  return runHaptic(() => Haptics.impact({ style: ImpactStyle.Medium }));
}

export function heavyImpact() {
  return runHaptic(() => Haptics.impact({ style: ImpactStyle.Heavy }));
}

export function successNotification() {
  return runHaptic(() => Haptics.notification({ type: NotificationType.Success }));
}

export function warningNotification() {
  return runHaptic(() => Haptics.notification({ type: NotificationType.Warning }));
}

export function errorNotification() {
  return runHaptic(() => Haptics.notification({ type: NotificationType.Error }));
}

export const haptics = {
  buttonTap: lightImpact,
  copy: lightImpact,
  follow: lightImpact,
  like: lightImpact,
  save: lightImpact,
  commentSent: mediumImpact,
  postPublished: mediumImpact,
  profileUpdated: mediumImpact,
  uploadCompleted: mediumImpact,
  achievementUnlocked: heavyImpact,
  levelUp: heavyImpact,
  rewardClaimed: heavyImpact,
  targetCompleted: heavyImpact,
  error: errorNotification,
  heavyImpact,
  lightImpact,
  mediumImpact,
  successNotification,
  warningNotification,
};

export default haptics;
