import { error, json } from '@sveltejs/kit';
import { buildVideoKey } from '$lib/server/catalog';
import { createMultipartUpload, objectExists } from '$lib/server/r2';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const id = String(body?.id ?? '').trim();
	const filename = String(body?.filename ?? '').trim();
	const contentType = String(body?.contentType ?? 'application/octet-stream');
	const overwrite = body?.overwrite === true;

	if (!id || !filename) throw error(400, 'Missing id or filename');

	const key = buildVideoKey(id, filename);

	// Skip files that already exist unless the client explicitly wants to overwrite.
	if (!overwrite && (await objectExists(key))) {
		return json({ key, exists: true });
	}

	const uploadId = await createMultipartUpload(key, contentType);

	return json({ key, uploadId, exists: false });
};
