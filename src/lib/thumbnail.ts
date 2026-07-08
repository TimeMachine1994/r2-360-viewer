/** Utilities for generating video poster thumbnails in the browser. */

const JPEG_QUALITY = 0.82;

/** Draw the current frame of a video element to a JPEG blob. */
export function captureVideoFrame(video: HTMLVideoElement, maxWidth = 1280): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const w = video.videoWidth;
		const h = video.videoHeight;
		if (!w || !h) {
			reject(new Error('Video has no decoded frame yet'));
			return;
		}
		const scale = Math.min(1, maxWidth / w);
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(w * scale);
		canvas.height = Math.round(h * scale);
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			reject(new Error('Could not create canvas context'));
			return;
		}
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('Could not encode thumbnail'))),
			'image/jpeg',
			JPEG_QUALITY
		);
	});
}

/**
 * Generate a JPEG thumbnail from a local video File by seeking a couple of
 * seconds in and capturing that frame. Fails gracefully (rejects) if the
 * browser cannot decode the file (e.g. HEVC in Chrome).
 */
export function thumbnailFromFile(file: File, seekSeconds = 2, maxWidth = 1280): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const video = document.createElement('video');
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.src = url;

		const cleanup = () => {
			video.removeAttribute('src');
			video.load();
			URL.revokeObjectURL(url);
		};
		const fail = (msg: string) => {
			cleanup();
			reject(new Error(msg));
		};

		const timer = setTimeout(() => fail('Timed out generating thumbnail'), 20000);

		video.onerror = () => {
			clearTimeout(timer);
			fail('Browser could not decode this video');
		};
		video.onloadedmetadata = () => {
			const t = Math.min(seekSeconds, (video.duration || seekSeconds) * 0.25);
			video.currentTime = Number.isFinite(t) ? t : 0;
		};
		video.onseeked = async () => {
			try {
				const blob = await captureVideoFrame(video, maxWidth);
				clearTimeout(timer);
				cleanup();
				resolve(blob);
			} catch (err) {
				clearTimeout(timer);
				fail(err instanceof Error ? err.message : 'Thumbnail capture failed');
			}
		};
	});
}

/** Upload a poster blob for the given video id. */
export async function uploadPoster(id: string, blob: Blob): Promise<void> {
	const res = await fetch(`/api/poster/${encodeURIComponent(id)}`, {
		method: 'POST',
		headers: { 'content-type': blob.type || 'image/jpeg' },
		body: blob
	});
	if (!res.ok) throw new Error(await res.text());
}
