import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignmentNotificationText, newAssignments } from './sessionAssignments';

test('newAssignments: only what was added', () => {
  assert.deepEqual(newAssignments(null, ['Read John 3', ' Pray daily ']), ['Read John 3', 'Pray daily']);
  assert.deepEqual(newAssignments(['Read John 3'], ['read john 3 ', 'Pray daily']), ['Pray daily']);
  assert.deepEqual(newAssignments(['A', 'B'], ['A', 'B']), []);
  assert.deepEqual(newAssignments(['A'], []), []);
  assert.deepEqual(newAssignments([], ['', '  ', 'X', 'x', 42 as any]), ['X']);
  assert.deepEqual(newAssignments('junk', undefined), []);
});

test('assignmentNotificationText: one quoted, several counted, long ones shortened', () => {
  assert.deepEqual(assignmentNotificationText('Daniel', ['Please send the video']), {
    title: 'New assignment',
    body: 'Daniel gave you an assignment: "Please send the video"',
  });
  assert.equal(assignmentNotificationText('', ['a', 'b']).body, 'Your mentor gave you 2 new assignments');
  const long = assignmentNotificationText('D', ['x'.repeat(200)]).body;
  assert.ok(long.length < 120 && long.endsWith('…"'));
});
