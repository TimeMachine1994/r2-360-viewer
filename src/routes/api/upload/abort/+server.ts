import { json } from '@sveltejs/kit';
import { abortMultipartUpload } from '$lib/server/r2';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const key = String(body?.key ?? '');
	const uploadId = String(body?.uploadId ?? '');

	if (key && uploadId) {
		await abortMultipartUpload(key, uploadId).catch(() => {});
	}

	return json({ ok: true });
};
