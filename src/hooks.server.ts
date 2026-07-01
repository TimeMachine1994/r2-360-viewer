import { redirect, type Handle } from '@sveltejs/kit';
import { COOKIE_NAME, verifyToken } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(COOKIE_NAME);
	event.locals.authed = verifyToken(token);

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));

	if (!event.locals.authed && !isPublic) {
		const redirectTo = encodeURIComponent(path + event.url.search);
		throw redirect(303, `/login?redirectTo=${redirectTo}`);
	}

	return resolve(event);
};
