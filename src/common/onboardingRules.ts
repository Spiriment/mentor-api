/**
 * Mentees must give their church (denomination + church name) or say they don't attend one yet;
 * the app saves that answer as words ("None" / "Not attending a church yet"), so both are
 * non-empty either way. Returns the problem, or null when it's fine.
 */
export function menteeChurchInfoProblem(profile: {
  churchDenomination?: string | null;
  churchName?: string | null;
}): string | null {
  const filled = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;
  if (!filled(profile.churchDenomination) || !filled(profile.churchName)) {
    return "Please add your church and denomination (or tick \"I don't attend a church yet\") to finish setting up your account.";
  }
  return null;
}
