import { error, json } from '@sveltejs/kit';
import { completeMultipartUpload } from '$lib/server/r2';
import type { RequestHandler } from './$types';

interface PartInput {
	PartNumber: number;
	ETag: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const key = String(body?.key ?? '');
	const uploadId = String(body?.uploadId ?? '');
	const parts: PartInput[] = Array.isArray(body?.parts) ? body.parts : [];

	if (!key || !uploadId || parts.length === 0) {
		throw error(400, 'Missing key, uploadId or parts');
	}

	await completeMultipartUpload(
		key,
		uploadId,
		parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }))
	);

	return json({ ok: true, key });
};
