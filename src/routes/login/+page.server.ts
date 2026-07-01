import { fail, redirect } from '@sveltejs/kit';
import { checkPassword, COOKIE_NAME, cookieOptions, createToken } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.authed) {
		throw redirect(303, url.searchParams.get('redirectTo') || '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const password = String(data.get('password') ?? '');

		if (!password || !checkPassword(password)) {
			return fail(401, { error: 'Incorrect password.' });
		}

		cookies.set(COOKIE_NAME, createToken(), cookieOptions);

		const redirectTo = url.searchParams.get('redirectTo');
		const target = redirectTo ? decodeURIComponent(redirectTo) : '/';
		throw redirect(303, target.startsWith('/') ? target : '/');
	}
};
