import { createHmac, timingSafeEqual } from 'node:crypto';
import { AUTH } from './env';

export const COOKIE_NAME = 'r2v_auth';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(value: string): string {
	return createHmac('sha256', AUTH.secret()).update(value).digest('hex');
}

/** Create a signed token of the form `<issuedAt>.<signature>`. */
export function createToken(): string {
	const issued = String(Date.now());
	return `${issued}.${sign(issued)}`;
}

export function verifyToken(token: string | undefined): boolean {
	if (!token) return false;
	const dot = token.indexOf('.');
	if (dot === -1) return false;
	const issued = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expected = sign(issued);
	if (sig.length !== expected.length) return false;
	try {
		return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
	} catch {
		return false;
	}
}

/** Constant-time-ish password check. */
export function checkPassword(input: string): boolean {
	const expected = AUTH.password();
	const a = Buffer.from(input);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export const cookieOptions = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: true,
	maxAge: MAX_AGE
};
