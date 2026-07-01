import { getCatalog } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const videos = await getCatalog();
	return {
		videos: videos.map((v) => ({
			id: v.id,
			title: v.title,
			description: v.description,
			size: v.size
		}))
	};
};
