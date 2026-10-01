import { createHmac, timingSafeEqual } from 'node:crypto';
export function token(kind, id, secret, now = Date.now()) {
  if (!secret || secret.length < 32) throw new Error('Demo access is not configured');
  const expiry = Math.floor(now / 1000) + 3600;
  const payload = `${kind}:${id}:${expiry}`;
  return `${expiry}.${createHmac('sha256', secret).update(payload).digest('hex')}`;
}
export function valid(value, kind, id, secret, now = Date.now()) {
  if (!secret || secret.length < 32 || !/^\d{10}\.[a-f0-9]{64}$/.test(value || '')) return false;
  const [expiry, signature] = value.split('.');
  if (Number(expiry) <= Math.floor(now / 1000) || Number(expiry) > Math.floor(now / 1000) + 3600) return false;
  const expected = createHmac('sha256', secret).update(`${kind}:${id}:${expiry}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
