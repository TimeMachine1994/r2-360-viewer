import { error, json } from '@sveltejs/kit';
import { presignUploadPart } from '$lib/server/r2';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const key = String(body?.key ?? '');
	const uploadId = String(body?.uploadId ?? '');
	const partNumbers: number[] = Array.isArray(body?.partNumbers) ? body.partNumbers : [];

	if (!key || !uploadId || partNumbers.length === 0) {
		throw error(400, 'Missing key, uploadId or partNumbers');
	}

	const urls = await Promise.all(
		partNumbers.map(async (partNumber) => ({
			partNumber,
			url: await presignUploadPart(key, uploadId, partNumber)
		}))
	);

	return json({ urls });
};
