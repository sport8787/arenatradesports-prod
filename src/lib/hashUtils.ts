/**
 * Safe hash utilities with fallback for environments without WebCrypto
 * (e.g., some mobile browsers in private mode, older WebViews)
 */

/**
 * Simple fallback hash function (djb2 algorithm)
 * Used when crypto.subtle is not available
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to positive hex string
  const positiveHash = hash >>> 0;
  return positiveHash.toString(16).padStart(8, '0');
}

/**
 * Creates a longer hash by running djb2 multiple times with different seeds
 */
function extendedDjb2Hash(str: string, length: number = 32): string {
  let result = '';
  let seed = str;
  
  while (result.length < length) {
    const partialHash = djb2Hash(seed);
    result += partialHash;
    seed = partialHash + str;
  }
  
  return result.slice(0, length);
}

/**
 * Check if WebCrypto is available
 */
function isWebCryptoAvailable(): boolean {
  try {
    return typeof crypto !== 'undefined' && 
           crypto.subtle !== undefined && 
           typeof crypto.subtle.digest === 'function';
  } catch {
    return false;
  }
}

/**
 * Generate SHA-256 hash using WebCrypto with fallback
 * @param input - String to hash
 * @returns Hex string of hash (32 chars for compatibility)
 */
export async function safeHash(input: string): Promise<string> {
  // Try WebCrypto first
  if (isWebCryptoAvailable()) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.slice(0, 32);
    } catch (error) {
      console.warn('[SafeHash] WebCrypto failed, using fallback:', error);
    }
  }
  
  // Fallback to djb2-based hash
  console.log('[SafeHash] Using fallback hash (WebCrypto not available)');
  return extendedDjb2Hash(input, 32);
}

/**
 * Synchronous hash for cases where async is not possible
 * Always uses the fallback algorithm
 */
export function syncHash(input: string): string {
  return extendedDjb2Hash(input, 32);
}
