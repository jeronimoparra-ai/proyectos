import { calculateSM2 } from '../utils/sm2';

describe('calculateSM2', () => {
  describe('quality >= 3 (correct recall)', () => {
    it('sets interval to 1 on first repetition', () => {
      const result = calculateSM2(4, 2.5, 0, 0);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it('sets interval to 6 on second repetition', () => {
      const result = calculateSM2(4, 2.5, 1, 1);
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('multiplies interval by ease factor on subsequent repetitions', () => {
      const result = calculateSM2(4, 2.5, 6, 2);
      expect(result.interval).toBe(15); // round(6 * 2.5) = 15
      expect(result.repetitions).toBe(3);
    });
  });

  describe('quality < 3 (incorrect recall)', () => {
    it('resets repetitions to 0 and interval to 1', () => {
      const result = calculateSM2(2, 2.5, 10, 3);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });
  });

  describe('ease factor adjustments', () => {
    it('increases ease factor for perfect recall (quality=5)', () => {
      const result = calculateSM2(5, 2.5, 0, 0);
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });

    it('decreases ease factor for low quality (quality=0)', () => {
      const result = calculateSM2(0, 2.5, 0, 0);
      expect(result.easeFactor).toBeLessThan(2.5);
    });

    it('never goes below 1.3', () => {
      let ef = 1.3;
      for (let i = 0; i < 10; i++) {
        const result = calculateSM2(0, ef, 0, 0);
        ef = result.easeFactor;
      }
      expect(ef).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe('nextReviewAt', () => {
    it('returns a future ISO date string', () => {
      const result = calculateSM2(4, 2.5, 0, 0);
      const nextDate = new Date(result.nextReviewAt);
      expect(nextDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('sets correct number of days in future', () => {
      const result = calculateSM2(4, 2.5, 0, 0);
      const nextDate = new Date(result.nextReviewAt);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 1);
      expect(nextDate.getDate()).toBe(expectedDate.getDate());
    });
  });
});
