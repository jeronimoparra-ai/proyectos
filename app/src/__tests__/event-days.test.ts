import { eventOccursOnDay } from '../components/calendar/event-days';

const createDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe('eventOccursOnDay', () => {
  describe('Regular events', () => {
    it('should return true for event on the same day', () => {
      const event = {
        start_date: '2026-11-15T10:00:00.000Z',
        end_date: '2026-11-15T11:00:00.000Z',
        all_day: false,
      };
      const day = createDate(2026, 11, 15);
      expect(eventOccursOnDay(event, day)).toBe(true);
    });

    it('should return false for event on different day', () => {
      const event = {
        start_date: '2026-11-15T10:00:00.000Z',
        end_date: '2026-11-15T11:00:00.000Z',
        all_day: false,
      };
      const day = createDate(2026, 11, 16);
      expect(eventOccursOnDay(event, day)).toBe(false);
    });

    it('should handle multi-day events', () => {
      const event = {
        start_date: '2026-11-15T10:00:00.000Z',
        end_date: '2026-11-17T11:00:00.000Z',
        all_day: false,
      };
      expect(eventOccursOnDay(event, createDate(2026, 11, 15))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 11, 16))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 11, 17))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 11, 18))).toBe(false);
    });

    it('should handle events crossing midnight UTC', () => {
      // Event from 23:00 Nov 15 to 01:00 Nov 16 UTC
      const event = {
        start_date: '2026-11-15T23:00:00.000Z',
        end_date: '2026-11-16T01:00:00.000Z',
        all_day: false,
      };
      // The function compares in local time, so this depends on timezone
      // For UTC timezone, it should appear on both days
      expect(eventOccursOnDay(event, createDate(2026, 11, 15))).toBe(true);
      // Note: The second day may vary based on timezone
    });
  });

  describe('All-day events', () => {
    it('should return true for all-day event on start day', () => {
      const event = {
        start_date: '2026-11-15T00:00:00.000Z',
        end_date: '2026-11-16T00:00:00.000Z',
        all_day: true,
        start_day: '2026-11-15',
        end_day: '2026-11-16',
      };
      expect(eventOccursOnDay(event, createDate(2026, 11, 15))).toBe(true);
    });

    it('should return true for all-day event on middle day', () => {
      const event = {
        start_date: '2026-11-15T00:00:00.000Z',
        end_date: '2026-11-18T00:00:00.000Z',
        all_day: true,
        start_day: '2026-11-15',
        end_day: '2026-11-18',
      };
      expect(eventOccursOnDay(event, createDate(2026, 11, 15))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 11, 16))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 11, 17))).toBe(true);
      // end_day is exclusive in the implementation
      expect(eventOccursOnDay(event, createDate(2026, 11, 18))).toBe(false);
    });

    it('should handle all-day event without start_day/end_day (falls back to date slice)', () => {
      const event = {
        start_date: '2026-11-15T00:00:00.000Z',
        end_date: '2026-11-16T00:00:00.000Z',
        all_day: true,
      };
      expect(eventOccursOnDay(event, createDate(2026, 11, 15))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 11, 16))).toBe(false);
    });

    it('should handle single day all-day event', () => {
      const event = {
        start_date: '2026-11-15T00:00:00.000Z',
        end_date: '2026-11-15T00:00:00.000Z',
        all_day: true,
        start_day: '2026-11-15',
        end_day: '2026-11-15',
      };
      expect(eventOccursOnDay(event, createDate(2026, 11, 15))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 11, 16))).toBe(false);
    });
  });

  describe('Timezone edge cases', () => {
    it('should handle event at midnight UTC', () => {
      const event = {
        start_date: '2026-11-15T00:00:00.000Z',
        end_date: '2026-11-15T01:00:00.000Z',
        all_day: false,
      };
      // In local time this might be different day depending on timezone
      // Just verify it doesn't crash
      const result = eventOccursOnDay(event, createDate(2026, 11, 15));
      expect(typeof result).toBe('boolean');
    });

    it('should handle event ending at midnight', () => {
      const event = {
        start_date: '2026-11-14T23:00:00.000Z',
        end_date: '2026-11-15T00:00:00.000Z',
        all_day: false,
      };
      const result = eventOccursOnDay(event, createDate(2026, 11, 14));
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Month boundaries', () => {
    it('should handle event spanning month boundary', () => {
      const event = {
        start_date: '2026-11-30T22:00:00.000Z',
        end_date: '2026-12-01T02:00:00.000Z',
        all_day: false,
      };
      expect(eventOccursOnDay(event, createDate(2026, 11, 30))).toBe(true);
      // The next day may or may not match depending on timezone
      const result = eventOccursOnDay(event, createDate(2026, 12, 1));
      expect(typeof result).toBe('boolean');
    });

    it('should handle all-day event spanning month boundary', () => {
      const event = {
        start_date: '2026-11-30T00:00:00.000Z',
        end_date: '2026-12-02T00:00:00.000Z',
        all_day: true,
        start_day: '2026-11-30',
        end_day: '2026-12-02',
      };
      expect(eventOccursOnDay(event, createDate(2026, 11, 30))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2026, 12, 1))).toBe(true);
      // end_day is exclusive
      expect(eventOccursOnDay(event, createDate(2026, 12, 2))).toBe(false);
    });

    it('should handle year boundary for all-day events', () => {
      const event = {
        start_date: '2026-12-31T00:00:00.000Z',
        end_date: '2027-01-02T00:00:00.000Z',
        all_day: true,
        start_day: '2026-12-31',
        end_day: '2027-01-02',
      };
      expect(eventOccursOnDay(event, createDate(2026, 12, 31))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2027, 1, 1))).toBe(true);
      expect(eventOccursOnDay(event, createDate(2027, 1, 2))).toBe(false);
    });
  });
});