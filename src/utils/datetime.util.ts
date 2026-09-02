export const DateTimeUtil = {
  toISOString(date: Date): string {
    return date.toISOString();
  },

  toISOStringOrNull(date: Date | null | undefined): string | null {
    return date?.toISOString() ?? null;
  },

  now(): Date {
    return new Date();
  },
} as const;
