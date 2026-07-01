import { VIDEO_PREFIX } from './env';
import { listObjects } from './r2';
import overrides from './videos.json';

export interface VideoMeta {
	id: string;
	title: string;
	description?: string;
	posterKey?: string;
	videoKey?: string;
	size?: number;
}

interface OverrideEntry {
	title?: string;
	description?: string;
}

const META: Record<string, OverrideEntry> = overrides as Record<string, OverrideEntry>;

function prettify(id: string): string {
	return id
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

/**
 * Build the catalog by listing objects under VIDEO_PREFIX and grouping them by
 * the first path segment after the prefix (the video id). Recognises
 * `compressed.*`, `original.*` and `poster.*` files, with sensible fallbacks.
 */
export async function getCatalog(): Promise<VideoMeta[]> {
	const objects = await listObjects(VIDEO_PREFIX);
	const groups = new Map<string, VideoMeta>();

	for (const obj of objects) {
		const key = obj.Key;
		if (!key || key.endsWith('/')) continue;

		const rest = key.slice(VIDEO_PREFIX.length);
		const slash = rest.indexOf('/');
		if (slash === -1) continue; // not in a per-video folder
		const id = rest.slice(0, slash);
		const filename = rest.slice(slash + 1);

		let entry = groups.get(id);
		if (!entry) {
			entry = { id, title: META[id]?.title ?? prettify(id), description: META[id]?.description };
			groups.set(id, entry);
		}

		const base = filename.toLowerCase();
		if (IMAGE_EXT.test(base) && base.startsWith('poster')) {
			entry.posterKey = key;
		} else if (VIDEO_EXT.test(base)) {
			// One video file per folder. If several exist, keep the largest.
			if (!entry.videoKey || (obj.Size ?? 0) > (entry.size ?? 0)) {
				entry.videoKey = key;
				entry.size = obj.Size;
			}
		}
	}

	// Only surface videos that have a playable file.
	return [...groups.values()]
		.filter((v) => v.videoKey)
		.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getVideo(id: string): Promise<VideoMeta | undefined> {
	const catalog = await getCatalog();
	return catalog.find((v) => v.id === id);
}

/** Turn an arbitrary string into a safe folder id. */
export function slugify(input: string): string {
	return (
		input
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/[\s_-]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80) || 'video'
	);
}

/** Sanitize a filename, preserving its extension. */
export function sanitizeFilename(name: string): string {
	const dot = name.lastIndexOf('.');
	const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'mp4';
	const base = dot > 0 ? name.slice(0, dot) : name;
	return `${slugify(base)}.${ext || 'mp4'}`;
}

/** Build the object key for an uploaded video. */
export function buildVideoKey(id: string, filename: string): string {
	return `${VIDEO_PREFIX}${slugify(id)}/${sanitizeFilename(filename)}`;
}
