<script lang="ts">
	import Viewer360 from '$lib/Viewer360.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function startDownload() {
		window.location.href = `/api/download/${data.id}`;
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
		<button
			onclick={startDownload}
			class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500"
		>
			<svg viewBox="0 0 24 24" class="h-4 w-4 fill-current"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" /></svg>
			Download
		</button>
	</header>

	<div class="relative flex-1">
		<Viewer360 src={data.streamUrl} poster={data.hasPoster ? `/v/${data.id}/poster` : ''} />
	</div>
</div>
