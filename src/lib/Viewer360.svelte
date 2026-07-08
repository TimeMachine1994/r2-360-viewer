<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { captureVideoFrame } from '$lib/thumbnail';

	let { src, poster = '' }: { src: string; poster?: string } = $props();

	let container: HTMLDivElement;
	let video: HTMLVideoElement;

	let playing = $state(false);
	let loading = $state(true);
	let errored = $state(false);
	let gyroActive = $state(false);
	let gyroSupported = $state(false);
	let needsGyroPermission = $state(false);
	let muted = $state(true);

	// look state (degrees)
	let lon = 0;
	let lat = 0;
	let fov = 75;

	// pointer drag
	let dragging = false;
	let pointerX = 0;
	let pointerY = 0;
	let startLon = 0;
	let startLat = 0;

	// gyro state
	let deviceOrientation: DeviceOrientationEvent | null = null;
	let screenOrientation = 0;

	let renderer: THREE.WebGLRenderer;
	let camera: THREE.PerspectiveCamera;
	let scene: THREE.Scene;
	let raf = 0;

	const zee = new THREE.Vector3(0, 0, 1);
	const euler = new THREE.Euler();
	const q0 = new THREE.Quaternion();
	const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
	const yawQuat = new THREE.Quaternion();
	const yAxis = new THREE.Vector3(0, 1, 0);

	function setGyroQuaternion(
		quaternion: THREE.Quaternion,
		alpha: number,
		beta: number,
		gamma: number,
		orient: number
	) {
		euler.set(beta, alpha, -gamma, 'YXZ');
		quaternion.setFromEuler(euler);
		quaternion.multiply(q1);
		quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
	}

	function deg2rad(d: number) {
		return (d * Math.PI) / 180;
	}

	function onResize() {
		if (!renderer || !camera || !container) return;
		const w = container.clientWidth;
		const h = container.clientHeight;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
	}

	function animate() {
		raf = requestAnimationFrame(animate);
		camera.fov = fov;
		camera.updateProjectionMatrix();

		if (gyroActive && deviceOrientation) {
			const alpha = deviceOrientation.alpha ? deg2rad(deviceOrientation.alpha) : 0;
			const beta = deviceOrientation.beta ? deg2rad(deviceOrientation.beta) : 0;
			const gamma = deviceOrientation.gamma ? deg2rad(deviceOrientation.gamma) : 0;
			const orient = screenOrientation ? deg2rad(screenOrientation) : 0;
			setGyroQuaternion(camera.quaternion, alpha, beta, gamma, orient);
			// apply manual yaw offset from dragging
			yawQuat.setFromAxisAngle(yAxis, deg2rad(lon));
			camera.quaternion.premultiply(yawQuat);
		} else {
			lat = Math.max(-85, Math.min(85, lat));
			const phi = deg2rad(90 - lat);
			const theta = deg2rad(lon);
			const target = new THREE.Vector3(
				Math.sin(phi) * Math.cos(theta),
				Math.cos(phi),
				Math.sin(phi) * Math.sin(theta)
			);
			camera.lookAt(target);
		}

		renderer.render(scene, camera);
	}

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		pointerX = e.clientX;
		pointerY = e.clientY;
		startLon = lon;
		startLat = lat;
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const factor = fov / 75;
		lon = startLon - (e.clientX - pointerX) * 0.2 * factor;
		if (!gyroActive) {
			lat = startLat + (e.clientY - pointerY) * 0.2 * factor;
		}
	}

	function onPointerUp() {
		dragging = false;
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		fov = Math.max(30, Math.min(100, fov + e.deltaY * 0.05));
	}

	// pinch-to-zoom
	let pinchStart = 0;
	let pinchStartFov = 75;
	function onTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			pinchStart = touchDist(e);
			pinchStartFov = fov;
		}
	}
	function onTouchMove(e: TouchEvent) {
		if (e.touches.length === 2 && pinchStart > 0) {
			e.preventDefault();
			const d = touchDist(e);
			fov = Math.max(30, Math.min(100, pinchStartFov * (pinchStart / d)));
		}
	}
	function touchDist(e: TouchEvent) {
		const dx = e.touches[0].clientX - e.touches[1].clientX;
		const dy = e.touches[0].clientY - e.touches[1].clientY;
		return Math.hypot(dx, dy);
	}

	function onDeviceOrientation(e: DeviceOrientationEvent) {
		deviceOrientation = e;
	}

	function onScreenOrientation() {
		screenOrientation = (window.screen?.orientation?.angle ?? 0) as number;
	}

	async function enableGyro() {
		const DOE = window.DeviceOrientationEvent as unknown as {
			requestPermission?: () => Promise<'granted' | 'denied'>;
		};
		if (DOE && typeof DOE.requestPermission === 'function') {
			try {
				const res = await DOE.requestPermission();
				if (res !== 'granted') return;
			} catch {
				return;
			}
		}
		window.addEventListener('deviceorientation', onDeviceOrientation, true);
		window.addEventListener('orientationchange', onScreenOrientation);
		onScreenOrientation();
		gyroActive = true;
		needsGyroPermission = false;
		lon = 0;
	}

	function disableGyro() {
		window.removeEventListener('deviceorientation', onDeviceOrientation, true);
		window.removeEventListener('orientationchange', onScreenOrientation);
		gyroActive = false;
	}

	function toggleGyro() {
		if (gyroActive) disableGyro();
		else enableGyro();
	}

	async function togglePlay() {
		if (!video) return;
		if (video.paused) {
			try {
				await video.play();
				playing = true;
			} catch {
				// autoplay blocked; keep muted and retry
				video.muted = true;
				muted = true;
				await video.play().catch(() => {});
				playing = !video.paused;
			}
		} else {
			video.pause();
			playing = false;
		}
	}

	function toggleMute() {
		if (!video) return;
		video.muted = !video.muted;
		muted = video.muted;
	}

	/** Capture the current video frame as a JPEG blob (exposed to parents). */
	export function captureFrame(): Promise<Blob> {
		return captureVideoFrame(video);
	}

	function recenter() {
		lon = 0;
		lat = 0;
		fov = 75;
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			container.requestFullscreen?.().then(onResize).catch(() => {});
		} else {
			document.exitFullscreen?.();
		}
	}

	onMount(() => {
		gyroSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
		const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown };
		needsGyroPermission = gyroSupported && typeof DOE?.requestPermission === 'function';

		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(fov, container.clientWidth / container.clientHeight, 0.1, 1100);
		camera.position.set(0, 0, 0.01);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(container.clientWidth, container.clientHeight);
		container.appendChild(renderer.domElement);

		const texture = new THREE.VideoTexture(video);
		texture.colorSpace = THREE.SRGBColorSpace;
		const geometry = new THREE.SphereGeometry(500, 60, 40);
		geometry.scale(-1, 1, 1);
		const material = new THREE.MeshBasicMaterial({ map: texture });
		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		video.addEventListener('loadeddata', () => (loading = false));
		video.addEventListener('waiting', () => (loading = true));
		video.addEventListener('playing', () => {
			loading = false;
			playing = true;
		});
		video.addEventListener('pause', () => (playing = false));
		video.addEventListener('error', () => {
			errored = true;
			loading = false;
		});

		const ro = new ResizeObserver(onResize);
		ro.observe(container);
		window.addEventListener('resize', onResize);

		animate();

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			window.removeEventListener('resize', onResize);
			disableGyro();
			texture.dispose();
			geometry.dispose();
			material.dispose();
			renderer.dispose();
		};
	});
</script>

<div
	bind:this={container}
	class="relative h-full w-full touch-none overflow-hidden bg-black select-none"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	onpointerleave={onPointerUp}
	onwheel={onWheel}
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	role="application"
	aria-label="360 degree video viewer"
>
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		{src}
		{poster}
		class="hidden"
		crossorigin="anonymous"
		playsinline
		loop
		muted={muted}
		preload="auto"
	></video>

	{#if loading && !errored}
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<div class="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
		</div>
	{/if}

	{#if errored}
		<div class="absolute inset-0 flex items-center justify-center p-6 text-center">
			<p class="text-sm text-red-300">Could not load this video. The link may have expired — reload the page.</p>
		</div>
	{/if}

	{#if !playing && !errored}
		<button
			onclick={togglePlay}
			class="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
			aria-label="Play video"
		>
			<span class="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
				<svg viewBox="0 0 24 24" class="ml-1 h-9 w-9 fill-current"><path d="M8 5v14l11-7z" /></svg>
			</span>
		</button>
	{/if}

	<!-- control bar -->
	<div class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
		<div class="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/55 p-1.5 backdrop-blur">
			<button onclick={togglePlay} class="ctl" aria-label={playing ? 'Pause' : 'Play'}>
				{#if playing}
					<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
				{:else}
					<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M8 5v14l11-7z" /></svg>
				{/if}
			</button>
			<button onclick={toggleMute} class="ctl" aria-label={muted ? 'Unmute' : 'Mute'}>
				{#if muted}
					<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z" opacity=".4" /><path d="M19 12l3 3-1.5 1.5L17.5 13.5 14.5 16.5 13 15l3-3-3-3 1.5-1.5L17.5 10.5 20.5 7.5 22 9z" /></svg>
				{:else}
					<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8v8a4.5 4.5 0 002.5-4zM14 1.2v2.1a7 7 0 010 13.4v2.1A9 9 0 0014 1.2z" /></svg>
				{/if}
			</button>
			{#if gyroSupported}
				<button onclick={toggleGyro} class="ctl {gyroActive ? 'text-brand-400' : ''}" aria-label="Toggle motion controls">
					<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm0-13a5 5 0 100 10 5 5 0 000-10z" /></svg>
				</button>
			{/if}
			<button onclick={recenter} class="ctl" aria-label="Recenter view">
				<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 3h-2.1a7 7 0 00-5.9-5.9V3h-2v2.1A7 7 0 005.1 11H3v2h2.1A7 7 0 0011 18.9V21h2v-2.1a7 7 0 005.9-5.9H21v-2z" /></svg>
			</button>
			<button onclick={toggleFullscreen} class="ctl" aria-label="Toggle fullscreen">
				<svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
			</button>
		</div>
	</div>

	{#if needsGyroPermission && !gyroActive}
		<button
			onclick={enableGyro}
			class="pointer-events-auto absolute right-4 top-4 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium shadow hover:bg-brand-500"
		>
			Enable motion
		</button>
	{/if}
</div>

<style>
	.ctl {
		display: flex;
		height: 2.5rem;
		width: 2.5rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		color: white;
		transition: background-color 0.15s;
	}
	.ctl:hover {
		background-color: rgba(255, 255, 255, 0.15);
	}
</style>
