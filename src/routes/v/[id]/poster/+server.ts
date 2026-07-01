import { error, redirect } from '@sveltejs/kit';
import { getVideo } from '$lib/server/catalog';
import { presignStream } from '$lib/server/r2';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const video = await getVideo(params.id);
	if (!video?.posterKey) throw error(404, 'No poster');
	const url = await presignStream(video.posterKey, 60 * 60);
	throw redirect(302, url);
};
