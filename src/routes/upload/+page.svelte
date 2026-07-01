<script lang="ts">
	import { formatBytes } from '$lib/format';

	const PART_SIZE = 100 * 1024 * 1024; // 100 MB
	const CONCURRENCY = 3;

	type ItemStatus = 'pending' | 'uploading' | 'done' | 'error' | 'skipped' | 'canceled';

	interface QueueItem {
		localId: number;
		file: File;
		title: string;
		status: ItemStatus;
		uploaded: number;
		message: string;
		resultId: string;
		key?: string;
		uploadId?: string;
	}

	const CANCELLED = '__cancelled__';

	let items = $state<QueueItem[]>([]);
	let running = $state(false);
	let cancelled = $state(false);
	let overwrite = $state(false);
	let fileInput: HTMLInputElement;

	const activeXhrs = new Set<XMLHttpRequest>();
	let localSeq = 0;

	const totalBytes = $derived(items.reduce((sum, it) => sum + it.file.size, 0));
	const uploadedBytes = $derived(items.reduce((sum, it) => sum + it.uploaded, 0));
	const overallProgress = $derived(totalBytes ? Math.min(100, (uploadedBytes / totalBytes) * 100) : 0);
	const doneCount = $derived(items.filter((it) => it.status === 'done').length);
	const clearableCount = $derived(
		items.filter((it) => it.status === 'done' || it.status === 'skipped').length
	);
	const hasPending = $derived(
		items.some((it) => it.status === 'pending' || it.status === 'error' || it.status === 'canceled')
	);

	function titleFromName(name: string): string {
		const dot = name.lastIndexOf('.');
		return dot > 0 ? name.slice(0, dot) : name;
	}

	function itemProgress(it: QueueItem): number {
		return it.file.size ? Math.min(100, (it.uploaded / it.file.size) * 100) : 0;
	}

	function onFilesChange(e: Event) {
		const picked = Array.from((e.target as HTMLInputElement).files ?? []);
		for (const file of picked) {
			// Avoid duplicates by name+size.
			if (items.some((it) => it.file.name === file.name && it.file.size === file.size)) continue;
			items.push({
				localId: ++localSeq,
				file,
				title: titleFromName(file.name),
				status: 'pending',
				uploaded: 0,
				message: '',
				resultId: ''
			});
		}
		sortBySizeAsc();
		// allow re-selecting the same files later
		if (fileInput) fileInput.value = '';
	}

	function sortBySizeAsc() {
		// Smallest files first.
		items.sort((a, b) => a.file.size - b.file.size);
	}

	function removeItem(localId: number) {
		if (running) return;
		items = items.filter((it) => it.localId !== localId);
	}

	function clearFinished() {
		items = items.filter((it) => it.status !== 'done' && it.status !== 'skipped');
	}

	function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<string> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			activeXhrs.add(xhr);
			const cleanup = () => activeXhrs.delete(xhr);
			xhr.open('PUT', url, true);
			let last = 0;
			xhr.upload.onprogress = (ev) => {
				onProgress(ev.loaded - last);
				last = ev.loaded;
			};
			xhr.onload = () => {
				cleanup();
				if (xhr.status >= 200 && xhr.status < 300) {
					const etag = xhr.getResponseHeader('ETag');
					if (!etag) {
						reject(new Error('Missing ETag — check R2 CORS ExposeHeaders.'));
						return;
					}
					onProgress(blob.size - last);
					resolve(etag);
				} else {
					reject(new Error(`Part upload failed (${xhr.status})`));
				}
			};
			xhr.onerror = () => {
				cleanup();
				reject(new Error('Network error during part upload'));
			};
			xhr.onabort = () => {
				cleanup();
				reject(new Error(CANCELLED));
			};
			xhr.send(blob);
		});
	}

	async function uploadItem(item: QueueItem) {
		const file = item.file;
		item.status = 'uploading';
		item.message = '';
		item.uploaded = 0;
		item.resultId = '';

		const id = item.title.trim() || file.name;
		const totalParts = Math.ceil(file.size / PART_SIZE);

		let key = '';
		let uploadId = '';

		try {
			const createRes = await fetch('/api/upload/create', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, filename: file.name, contentType: file.type, overwrite })
			});
			if (!createRes.ok) throw new Error(await createRes.text());
			const created = await createRes.json();
			if (created.exists) {
				item.status = 'skipped';
				item.uploaded = file.size;
				item.resultId = created.key.split('/')[1] ?? '';
				item.message = 'Already in bucket — skipped';
				return;
			}
			({ key, uploadId } = created);
			item.key = key;
			item.uploadId = uploadId;

			const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
			const partRes = await fetch('/api/upload/part', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key, uploadId, partNumbers })
			});
			if (!partRes.ok) throw new Error(await partRes.text());
			const { urls } = (await partRes.json()) as { urls: { partNumber: number; url: string }[] };
			const urlMap = new Map(urls.map((u) => [u.partNumber, u.url]));

			const parts: { PartNumber: number; ETag: string }[] = new Array(totalParts);
			let next = 0;

			async function worker() {
				while (next < totalParts) {
					const index = next++;
					const partNumber = index + 1;
					const start = index * PART_SIZE;
					const blob = file.slice(start, Math.min(start + PART_SIZE, file.size));
					const url = urlMap.get(partNumber)!;
					const etag = await putPart(url, blob, (delta) => (item.uploaded += delta));
					parts[index] = { PartNumber: partNumber, ETag: etag };
				}
			}

			await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalParts) }, worker));

			const completeRes = await fetch('/api/upload/complete', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key, uploadId, parts })
			});
			if (!completeRes.ok) throw new Error(await completeRes.text());
			const done = await completeRes.json();

			item.uploaded = file.size;
			item.status = 'done';
			item.resultId = key.split('/')[1] ?? '';
			item.message = `Saved to ${done.key}`;
		} catch (err) {
			const wasCancelled = err instanceof Error && err.message === CANCELLED;
			item.status = wasCancelled ? 'canceled' : 'error';
			item.message = wasCancelled ? 'Canceled' : err instanceof Error ? err.message : 'Upload failed';
			if (key && uploadId) {
				fetch('/api/upload/abort', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ key, uploadId })
				}).catch(() => {});
			}
		} finally {
			item.key = undefined;
			item.uploadId = undefined;
		}
	}

	async function startAll() {
		if (running) return;
		running = true;
		cancelled = false;
		// Process smallest first; errors don't stop the queue.
		sortBySizeAsc();
		for (const item of items) {
			if (cancelled) break;
			if (item.status === 'pending' || item.status === 'error' || item.status === 'canceled') {
				await uploadItem(item);
			}
		}
		running = false;
		cancelled = false;
	}

	function cancelAll() {
		cancelled = true;
		// Abort any in-flight part uploads; the current item's multipart upload is
		// aborted server-side inside uploadItem's catch handler.
		for (const xhr of activeXhrs) xhr.abort();
	}
</script>

<svelte:head>
	<title>Upload - 360 Viewer</title>
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-8">
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-semibold tracking-tight">Upload 360 videos</h1>
		<a href="/" class="text-sm text-zinc-400 hover:text-white">Library</a>
	</header>

	<p class="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
		Temporary bulk upload tool. Files go directly to R2 in 100&nbsp;MB chunks, so very large
		files (2&nbsp;GB+) work without timing out. Files upload one at a time, <strong>smallest
		first</strong>.
	</p>

	<div class="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
		<div>
			<label for="files" class="mb-1.5 block text-sm font-medium text-zinc-300">Video files</label>
			<input
				id="files"
				bind:this={fileInput}
				onchange={onFilesChange}
				type="file"
				accept="video/*"
				multiple
				disabled={running}
				class="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
			/>
			<p class="mt-1 text-xs text-zinc-500">Pick multiple files. Edit each title below if needed.</p>
			<label class="mt-3 flex items-center gap-2 text-xs text-zinc-400">
				<input type="checkbox" bind:checked={overwrite} disabled={running} class="accent-brand-500" />
				Overwrite files that already exist (otherwise duplicates are skipped)
			</label>
		</div>

		{#if items.length > 0}
			<div>
				<div class="mb-1 flex justify-between text-xs text-zinc-400">
					<span>Overall · {doneCount}/{items.length} done</span>
					<span>{overallProgress.toFixed(1)}% · {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}</span>
				</div>
				<div class="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
					<div class="h-full bg-brand-500 transition-all" style="width: {overallProgress}%"></div>
				</div>
			</div>

			<ul class="space-y-2">
				{#each items as item (item.localId)}
					<li class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
						<div class="flex items-center gap-3">
							<div class="min-w-0 flex-1">
								{#if item.status === 'pending'}
									<input
										bind:value={item.title}
										type="text"
										disabled={running}
										class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm outline-none focus:border-brand-500"
									/>
								{:else}
									<div class="truncate text-sm font-medium">{item.title}</div>
								{/if}
								<div class="mt-0.5 truncate text-xs text-zinc-500">
									{item.file.name} · {formatBytes(item.file.size)}
								</div>
							</div>

							<div class="flex shrink-0 items-center gap-2">
								{#if item.status === 'pending'}
									<span class="text-xs text-zinc-500">Queued</span>
									<button
										onclick={() => removeItem(item.localId)}
										disabled={running}
										aria-label="Remove"
										class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
									>
										<svg viewBox="0 0 24 24" class="h-4 w-4 fill-current"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" fill="none" /></svg>
									</button>
								{:else if item.status === 'uploading'}
									<span class="text-xs text-brand-400">{itemProgress(item).toFixed(0)}%</span>
								{:else if item.status === 'done'}
									<a href="/v/{item.resultId}" class="text-xs font-medium text-green-400 underline">View →</a>
								{:else if item.status === 'skipped'}
									<a href="/v/{item.resultId}" class="text-xs font-medium text-amber-400 underline">Skipped →</a>
								{:else if item.status === 'canceled'}
									<span class="text-xs text-zinc-400">Canceled</span>
								{:else if item.status === 'error'}
									<span class="text-xs text-red-400">Failed</span>
								{/if}
							</div>
						</div>

						{#if item.status === 'uploading' || item.status === 'done'}
							<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
								<div
									class="h-full transition-all {item.status === 'done' ? 'bg-green-500' : 'bg-brand-500'}"
									style="width: {itemProgress(item)}%"
								></div>
							</div>
						{/if}

						{#if item.status === 'error'}
							<p class="mt-2 text-xs text-red-300">{item.message}</p>
						{:else if item.status === 'skipped'}
							<p class="mt-2 text-xs text-amber-300">{item.message}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<div class="flex flex-wrap gap-3">
			{#if running}
				<button
					onclick={cancelAll}
					disabled={cancelled}
					class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
				>
					{cancelled ? 'Canceling…' : 'Cancel'}
				</button>
			{:else}
				<button
					onclick={startAll}
					disabled={!hasPending}
					class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold hover:bg-brand-500 disabled:opacity-60"
				>
					Start upload
				</button>
			{/if}
			{#if clearableCount > 0 && !running}
				<button
					onclick={clearFinished}
					class="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm hover:bg-zinc-800"
				>
					Clear finished
				</button>
			{/if}
		</div>
	</div>
</div>
