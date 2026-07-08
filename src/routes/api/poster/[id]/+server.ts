import { error, json } from '@sveltejs/kit';
import { slugify } from '$lib/server/catalog';
import { putObject } from '$lib/server/r2';
import { VIDEO_PREFIX } from '$lib/server/env';
import type { RequestHandler } from './$types';

const MAX_POSTER_BYTES = 4 * 1024 * 1024; // 4 MB is plenty for a JPEG thumbnail

/** Accepts a JPEG/PNG/WebP body and stores it as the video's poster. */
export const POST: RequestHandler = async ({ params, request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!/^image\/(jpeg|png|webp)$/.test(contentType)) {
		throw error(415, 'Poster must be a JPEG, PNG or WebP image');
	}

	const body = new Uint8Array(await request.arrayBuffer());
	if (body.length === 0) throw error(400, 'Empty poster body');
	if (body.length > MAX_POSTER_BYTES) throw error(413, 'Poster too large (max 4 MB)');

	const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
	const key = `${VIDEO_PREFIX}${slugify(params.id)}/poster.${ext}`;
	await putObject(key, body, contentType);

	return json({ ok: true, key });
};
