// TEMPORARY diagnostics endpoint - remove after debugging.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { listObjects } from '$lib/server/r2';
import type { RequestHandler } from './$types';

function shape(value: string | undefined) {
	if (value === undefined) return { present: false };
	return {
		present: true,
		length: value.length,
		firstCharCode: value.charCodeAt(0),
		lastCharCode: value.charCodeAt(value.length - 1),
		trimmedLength: value.trim().length
	};
}

export const GET: RequestHandler = async () => {
	const vars = {
		R2_ACCOUNT_ID: shape(env.R2_ACCOUNT_ID),
		R2_ACCESS_KEY_ID: shape(env.R2_ACCESS_KEY_ID),
		R2_SECRET_ACCESS_KEY: shape(env.R2_SECRET_ACCESS_KEY),
		R2_BUCKET: shape(env.R2_BUCKET),
		R2_ENDPOINT: shape(env.R2_ENDPOINT),
		R2_VIDEO_PREFIX: shape(env.R2_VIDEO_PREFIX)
	};

	let list: Record<string, unknown>;
	try {
		const objects = await listObjects(env.R2_VIDEO_PREFIX ?? 'videos/');
		list = { ok: true, count: objects.length };
	} catch (err) {
		const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
		list = { ok: false, name: e.name, message: e.message, httpStatus: e.$metadata?.httpStatusCode };
	}

	return json({ vars, list });
};
