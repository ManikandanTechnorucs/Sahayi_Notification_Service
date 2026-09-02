export const DataConversionUtil = {
  parseBigInt(value: string): bigint | null {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  },

  parseBigIntOrThrow(value: string | number | bigint): bigint {
    return BigInt(value);
  },

  bigIntToString(id: bigint): string {
    return id.toString();
  },
} as const;
