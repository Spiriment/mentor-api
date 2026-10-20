/**
 * Pick the Bible Brain fileset to read a chapter from. Only plain text (`text_plain`) can be read
 * by the verses endpoint; the same edition also lists `text_usx` / `text_json` / audio filesets
 * whose ids look alike (e.g. SPNBDAO_ET vs SPNBDAO_ET-usx). Picking by "id contains O / N"
 * landed on the unreadable USX one for the Spanish Old Testament, so Genesis came back empty.
 */
export interface FilesetLike {
  id?: string;
  fileset_id?: string;
  type?: string;
  media_type?: string;
  size?: string;
  set_size_code?: string;
}

const idOf = (f: FilesetLike) => String(f.id || f.fileset_id || '');
const typeOf = (f: FilesetLike) => String(f.type || f.media_type || '').toLowerCase();
const sizeOf = (f: FilesetLike) => String(f.size || f.set_size_code || '').toUpperCase();

/** Returns the fileset id, or null when there is no plain-text fileset covering that Testament. */
export function pickTextFileset(filesets: FilesetLike[], isOldTestament: boolean): string | null {
  const plain = filesets.filter((f) => typeOf(f) === 'text_plain' && idOf(f));
  const wanted = isOldTestament ? 'OT' : 'NT';
  // Exact Testament first, then the complete Bible, then partial sets that include it (e.g. NTP, OTNTP)
  const ranked =
    plain.find((f) => sizeOf(f) === wanted) ||
    plain.find((f) => sizeOf(f) === 'C') ||
    plain.find((f) => sizeOf(f).includes(wanted.charAt(0) + 'T'));
  return ranked ? idOf(ranked) : null;
}
