<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in - 360 Viewer</title>
</svelte:head>

<div class="flex min-h-full items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl">
				360
			</div>
			<h1 class="text-xl font-semibold">360 Video Viewer</h1>
			<p class="mt-1 text-sm text-zinc-400">Enter the password to continue.</p>
		</div>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
			class="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
		>
			<div>
				<label for="password" class="mb-1.5 block text-sm font-medium text-zinc-300">
					Password
				</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
				/>
			</div>

			{#if form?.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-brand-500 disabled:opacity-60"
			>
				{submitting ? 'Checking…' : 'Sign in'}
			</button>
		</form>
	</div>
</div>
