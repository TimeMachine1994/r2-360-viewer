<script lang="ts">
	import Viewer360 from '$lib/Viewer360.svelte';
	import { uploadPoster } from '$lib/thumbnail';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let viewer: Viewer360 | undefined = $state();
	let posterState = $state<'idle' | 'saving' | 'saved' | 'failed'>('idle');

	function startDownload() {
		window.location.href = `/api/download/${data.id}`;
	}

	async function setThumbnail() {
		if (!viewer) return;
		posterState = 'saving';
		try {
			const blob = await viewer.captureFrame();
			await uploadPoster(data.id, blob);
			posterState = 'saved';
		} catch {
			posterState = 'failed';
		}
		setTimeout(() => (posterState = 'idle'), 2500);
	}
</script>

<svelte:head>
	<title>{data.title} - 360 Viewer</title>
</svelte:head>

<div class="flex h-full flex-col">
	<header class="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur">
		<a href="/" class="flex items-center gap-2 text-sm text-zinc-300 hover:text-white">
			<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" /></svg>
			Library
		</a>
		<h1 class="truncate text-sm font-medium">{data.title}</h1>
		<div class="flex items-center gap-2">
		<button
			onclick={setThumbnail}
			disabled={posterState === 'saving'}
			class="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-60"
			title="Use the current frame as this video's thumbnail"
		>
			<svg viewBox="0 0 24 24" class="h-4 w-4 fill-current"><path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM9 3L7.2 5H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2h-3.2L15 3H9zm3 15a5 5 0 110-10 5 5 0 010 10z" /></svg>
			{posterState === 'saving'
				? 'Saving…'
				: posterState === 'saved'
					? 'Thumbnail saved'
					: posterState === 'failed'
						? 'Failed'
						: 'Set thumbnail'}
		</button>
		<button
			onclick={startDownload}
			class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500"
		>
			<svg viewBox="0 0 24 24" class="h-4 w-4 fill-current"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" /></svg>
			Download
		</button>
		</div>
	</header>

	<div class="relative flex-1">
		<Viewer360 bind:this={viewer} src={data.streamUrl} poster={data.hasPoster ? `/v/${data.id}/poster` : ''} />
	</div>
</div>
