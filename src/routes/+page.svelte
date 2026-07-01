<script lang="ts">
	import { formatBytes } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>360 Video Library</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
	<header class="mb-8 flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">360 Video Library</h1>
			<p class="mt-1 text-sm text-zinc-400">
				{data.videos.length}
				{data.videos.length === 1 ? 'video' : 'videos'} · tap to explore in 360°
			</p>
		</div>
		<div class="flex items-center gap-2">
			<a
				href="/upload"
				class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium transition hover:bg-brand-500"
			>
				Upload
			</a>
			<form method="POST" action="/logout">
				<button
					type="submit"
					class="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
				>
					Sign out
				</button>
			</form>
		</div>
	</header>

	{#if data.videos.length === 0}
		<div class="rounded-2xl border border-dashed border-zinc-800 p-12 text-center">
			<p class="text-zinc-400">No videos found in the bucket yet.</p>
			<a href="/upload" class="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500">
				Upload your first video
			</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.videos as video (video.id)}
				<a
					href="/v/{video.id}"
					class="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 transition hover:border-brand-500/60 hover:bg-zinc-900"
				>
					<div class="relative aspect-video w-full overflow-hidden bg-zinc-800">
						<img
							src="/v/{video.id}/poster"
							alt=""
							loading="lazy"
							class="h-full w-full object-cover transition group-hover:scale-105"
							onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
						/>
						<div
							class="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-medium backdrop-blur"
						>
							360°
						</div>
					</div>
					<div class="flex flex-1 flex-col p-4">
						<h2 class="font-medium leading-tight">{video.title}</h2>
						{#if video.description}
							<p class="mt-1 line-clamp-2 text-sm text-zinc-400">{video.description}</p>
						{/if}
						{#if video.size}
							<p class="mt-auto pt-2 text-xs text-zinc-500">{formatBytes(video.size)}</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
