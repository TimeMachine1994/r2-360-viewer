import { error } from '@sveltejs/kit';
import { getVideo } from '$lib/server/catalog';
import { presignStream } from '$lib/server/r2';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const video = await getVideo(params.id);
	if (!video) throw error(404, 'Video not found');

	if (!video.videoKey) throw error(404, 'No playable file for this video');

	const streamUrl = await presignStream(video.videoKey);

	return {
		id: video.id,
		title: video.title,
		description: video.description,
		streamUrl,
		hasPoster: Boolean(video.posterKey)
	};
};
