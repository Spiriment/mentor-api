import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickTextFileset } from './bibleFilesets';

describe('pickTextFileset', () => {
  // Real shape of Biblia de América (Spanish) from Bible Brain
  const spanish = [
    { id: 'SPNBDAO_ET-usx', type: 'text_usx', size: 'OT' },
    { id: 'SPNBDAO_ET', type: 'text_plain', size: 'OT' },
    { id: 'SPNBDAN_ET-json', type: 'text_json', size: 'NT' },
    { id: 'SPNBDAN_ET', type: 'text_plain', size: 'NT' },
    { id: 'SPNBDAN2DA', type: 'audio_drama', size: 'NT' },
  ];

  it('picks the plain-text fileset, never USX/JSON/audio', () => {
    assert.equal(pickTextFileset(spanish, true), 'SPNBDAO_ET');
    assert.equal(pickTextFileset(spanish, false), 'SPNBDAN_ET');
  });

  it('uses a complete-Bible fileset for either Testament', () => {
    const rv1909 = [{ id: 'SPNRVC', type: 'text_plain', size: 'C' }];
    assert.equal(pickTextFileset(rv1909, true), 'SPNRVC');
    assert.equal(pickTextFileset(rv1909, false), 'SPNRVC');
  });

  it('returns null when the Testament has no plain text (caller falls back)', () => {
    const ntOnly = [{ id: 'SPNLBV', type: 'text_plain', size: 'NT' }];
    assert.equal(pickTextFileset(ntOnly, true), null);
    assert.equal(pickTextFileset([{ id: 'X_ET-usx', type: 'text_usx', size: 'OT' }], true), null);
  });
});
