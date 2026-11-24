/**
 * Assignments in `next` that weren't in `previous` (compared trimmed, case-insensitive), so
 * saving notes again or editing the summary doesn't notify the mentee a second time.
 */
export function newAssignments(previous: unknown, next: unknown): string[] {
  const clean = (list: unknown) =>
    (Array.isArray(list) ? list : []).filter((a): a is string => typeof a === 'string').map((a) => a.trim()).filter(Boolean);
  const before = new Set(clean(previous).map((a) => a.toLowerCase()));
  const seen = new Set<string>();
  return clean(next).filter((a) => {
    const key = a.toLowerCase();
    if (before.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Push/in-app text for new assignments, e.g. 'Daniel gave you an assignment: "Read John 3"' */
export function assignmentNotificationText(mentorFirstName: string, added: string[]) {
  const who = mentorFirstName.trim() || 'Your mentor';
  if (added.length === 1) {
    const text = added[0].length > 90 ? `${added[0].slice(0, 87).trimEnd()}…` : added[0];
    return { title: 'New assignment', body: `${who} gave you an assignment: "${text}"` };
  }
  return { title: 'New assignments', body: `${who} gave you ${added.length} new assignments` };
}
