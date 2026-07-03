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

export function getYouthDiscountPercent(birthday: Date | string | null | undefined): number | null {
  if (!birthday) return null;
  const age = calcAge(birthday);
  if (age >= YOUTH_DISCOUNT_MIN_AGE && age <= YOUTH_DISCOUNT_MAX_AGE) {
    return YOUTH_DISCOUNT_PERCENT;
  }
  return null;
}
