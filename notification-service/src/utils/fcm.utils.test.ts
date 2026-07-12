import {
  isPermanentFcmError,
  parseChildReminderId,
  getReminderPhaseField,
  stringifyDataPayload,
} from '../utils/fcm.utils';

describe('fcm.utils', () => {
  describe('isPermanentFcmError', () => {
    it('returns true for registration-token-not-registered', () => {
      expect(isPermanentFcmError('messaging/registration-token-not-registered')).toBe(true);
    });

    it('returns true for invalid-registration-token', () => {
      expect(isPermanentFcmError('invalid-registration-token')).toBe(true);
    });

    it('returns false for temporary errors', () => {
      expect(isPermanentFcmError('messaging/server-unavailable')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isPermanentFcmError(undefined)).toBe(false);
    });
  });

  describe('stringifyDataPayload', () => {
    it('converts values to strings and drops undefined', () => {
      expect(
        stringifyDataPayload({
          childReminderId: '4',
          phase: undefined,
          count: '10' as string,
        })
      ).toEqual({
        childReminderId: '4',
        count: '10',
      });
    });
  });

  describe('getReminderPhaseField', () => {
    it('maps reminder phases to database fields', () => {
      expect(getReminderPhaseField('reminder.before')).toBe('BeforeNotificationSent');
      expect(getReminderPhaseField('reminder.on-time')).toBe('OnTimeNotificationSent');
      expect(getReminderPhaseField('reminder.after')).toBe('AfterNotificationSent');
      expect(getReminderPhaseField('other')).toBeNull();
    });
  });

  describe('parseChildReminderId', () => {
    it('parses valid childReminderId', () => {
      expect(parseChildReminderId({ childReminderId: '42' })).toBe(42);
    });

    it('returns null when missing or invalid', () => {
      expect(parseChildReminderId({})).toBeNull();
      expect(parseChildReminderId({ childReminderId: 'abc' })).toBeNull();
    });
  });
});
