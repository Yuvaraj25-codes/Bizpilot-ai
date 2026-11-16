import type { CurrencyCode } from '../../shared/types.ts';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

export function formatMoney(
  amount: number,
  currency: CurrencyCode = 'USD',
  masked = false
): string {
  if (masked) {
    const sym = CURRENCY_SYMBOLS[currency] || '$';
    return `${sym}••,•••.••`;
  }
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const sym = CURRENCY_SYMBOLS[currency] || '$';
  return amount < 0 ? `-${sym}${formatted}` : `${sym}${formatted}`;
}

export function formatCompactMoney(
  amount: number,
  currency: CurrencyCode = 'USD',
  masked = false
): string {
  if (masked) {
    const sym = CURRENCY_SYMBOLS[currency] || '$';
    return `${sym}•••`;
  }
  const sym = CURRENCY_SYMBOLS[currency] || '$';
  if (Math.abs(amount) >= 1000) {
    return `${amount < 0 ? '-' : ''}${sym}${(Math.abs(amount) / 1000).toFixed(1)}k`;
  }
  return `${amount < 0 ? '-' : ''}${sym}${Math.abs(amount).toFixed(0)}`;
}

export function maskPhone(phone: string, publicMode: boolean): string {
  if (!publicMode) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '•••-••••';
  const last4 = digits.slice(-4);
  return `+• (•••) •••-${last4}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
