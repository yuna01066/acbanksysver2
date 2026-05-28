const getCrypto = () => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generator is not available in this environment.');
  }
  return cryptoApi;
};

export const secureRandomInt = (maxExclusive: number) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer.');
  }

  const cryptoApi = getCrypto();
  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const values = new Uint32Array(1);

  do {
    cryptoApi.getRandomValues(values);
  } while (values[0] >= limit);

  return values[0] % maxExclusive;
};

export const secureRandomIntInclusive = (minInclusive: number, maxInclusive: number) => {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive) || maxInclusive < minInclusive) {
    throw new Error('Invalid secure random integer range.');
  }

  return minInclusive + secureRandomInt(maxInclusive - minInclusive + 1);
};

export const secureRandomNumericString = (
  minInclusive: number,
  maxInclusive: number,
  width: number,
) => String(secureRandomIntInclusive(minInclusive, maxInclusive)).padStart(width, '0');

export const secureRandomToken = (byteLength = 8) => {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new Error('byteLength must be a positive integer.');
  }

  const values = new Uint8Array(byteLength);
  getCrypto().getRandomValues(values);
  return Array.from(values, value => value.toString(16).padStart(2, '0')).join('');
};
