export const MIN_USER_AGE = 15;
export const YOUTH_DISCOUNT_MIN_AGE = 15;
export const YOUTH_DISCOUNT_MAX_AGE = 18;
export const YOUTH_DISCOUNT_PERCENT = 30;

export function calcAge(birthday: Date | string): number {
  const dob = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Why someone can't finish onboarding, or null when they can: a birthday is required and the
 * user must be at least MIN_USER_AGE. Enforced server-side so no app path (or old build) can
 * finish onboarding without it.
 */
export function onboardingAgeProblem(birthday: Date | string | null | undefined): string | null {
  if (!birthday || Number.isNaN(new Date(birthday).getTime())) {
    return 'Please add your date of birth to finish setting up your account.';
  }
  if (calcAge(birthday) < MIN_USER_AGE) {
    return `You must be at least ${MIN_USER_AGE} years old to use Spiriment`;
  }
  return null;
}

export function getYouthDiscountPercent(birthday: Date | string | null | undefined): number | null {
  if (!birthday) return null;
  const age = calcAge(birthday);
  if (age >= YOUTH_DISCOUNT_MIN_AGE && age <= YOUTH_DISCOUNT_MAX_AGE) {
    return YOUTH_DISCOUNT_PERCENT;
  }
  return null;
}
