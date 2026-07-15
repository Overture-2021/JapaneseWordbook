import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, mergeProgress } from '../lib/storage';

const progress = (words = {}, daily = {}) => ({ words, daily });
const stat = (seen, correct, wrong, lastSeen) => ({ seen, correct, wrong, lastSeen });

describe('mergeProgress', () => {
  it('is idempotent — repeated auto-syncs do not inflate counters', () => {
    const p = progress(
      { 'n5-001': stat(3, 2, 1, '2026-07-15T00:00:00.000Z') },
      { '2026-07-15': { seen: 3, correct: 2 } },
    );
    expect(mergeProgress(p, p)).toEqual(p);
  });

  it('unions words practised on different devices', () => {
    const local = progress({ 'n5-001': stat(2, 2, 0, 'a') });
    const remote = progress({ 'n5-002': stat(1, 0, 1, 'b') });
    expect(Object.keys(mergeProgress(local, remote).words).sort()).toEqual([
      'n5-001',
      'n5-002',
    ]);
  });

  it('keeps the more-practised record for a shared word', () => {
    const local = progress({ 'n5-001': stat(5, 5, 0, 'a') });
    const remote = progress({ 'n5-001': stat(2, 0, 2, 'b') });
    expect(mergeProgress(local, remote).words['n5-001']).toEqual(stat(5, 5, 0, 'a'));
  });

  it('never produces an incoherent record (correct + wrong stays == seen)', () => {
    // Same seen and timestamp, opposite splits: must pick one whole record,
    // not max each field into correct=3 + wrong=3 with seen=3.
    const local = progress({ 'n5-001': stat(3, 3, 0, 'a') });
    const remote = progress({ 'n5-001': stat(3, 0, 3, 'a') });
    const { seen, correct, wrong } = mergeProgress(local, remote).words['n5-001'];
    expect(correct + wrong).toBe(seen);
  });

  it('is order-independent', () => {
    const a = progress({ 'n5-001': stat(4, 3, 1, 'x') }, { d: { seen: 4, correct: 3 } });
    const b = progress({ 'n5-001': stat(2, 2, 0, 'y') }, { d: { seen: 6, correct: 1 } });
    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a));
  });

  it('treats empty progress as the identity element', () => {
    const local = progress({ 'n5-001': stat(1, 1, 0, 'a') });
    expect(mergeProgress(local, EMPTY_PROGRESS)).toEqual(local);
    expect(mergeProgress(EMPTY_PROGRESS, local)).toEqual(local);
  });
});
