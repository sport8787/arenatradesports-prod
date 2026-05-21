/**
 * Google Ads conversion helper.
 * Conversion: Compra — AW-18134679461/btaiCKiGg7EcEKX_pMdD
 */
export const GOOGLE_ADS_ID = 'AW-18134679461';
export const GOOGLE_ADS_CONVERSION_LABEL = 'btaiCKiGg7EcEKX_pMdD';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function fireAdsConversion(value = 1.0, transactionId = '') {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', 'conversion', {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`,
      value,
      currency: 'BRL',
      transaction_id: transactionId,
    });
  } catch (e) {
    console.warn('[GoogleAds] fireAdsConversion falhou:', e);
  }
}
