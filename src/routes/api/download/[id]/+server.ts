import { error, redirect } from '@sveltejs/kit';
import { getVideo } from '$lib/server/catalog';
import { presignDownload } from '$lib/server/r2';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const video = await getVideo(params.id);
	if (!video) throw error(404, 'Video not found');
	if (!video.videoKey) throw error(404, 'No downloadable file');

	const ext = video.videoKey.split('.').pop() || 'mp4';
	const filename = `${video.id}.${ext}`;

	const signed = await presignDownload(video.videoKey, filename);
	throw redirect(302, signed);
};
