# 360 Video Viewer

A password-gated SvelteKit site that lists 360° videos stored in a Cloudflare R2 bucket, plays them in an interactive equirectangular viewer (gyroscope on phone, click/drag on desktop), and offers direct downloads served straight from R2 via presigned URLs.

## Features

- Mono **equirectangular 360°** playback with Three.js
- **Phone**: gyroscope look-around (with iOS motion-permission prompt) + touch drag + pinch zoom
- **Desktop**: click-and-drag to look, scroll to zoom
- **Single shared password** login (signed httpOnly cookie)
- Auto-built catalog by listing the R2 bucket, with optional `videos.json` metadata overrides
- Downloads streamed **browser → R2** so 2 GB+ files never pass through the server
- **Temporary upload tool** (`/upload`) that pushes very large files straight to R2 using S3 multipart uploads (100 MB chunks, resumable-friendly, no serverless size/time limits)
- Deployable to **Vercel**

## Bucket layout

One folder per video under the `videos/` prefix, containing a single video file
(plus an optional poster):

```
videos/
  beach-sunset/
    beach-sunset.mp4   # the video (any name; first/largest video file is used)
    poster.jpg         # optional thumbnail
  city-rooftop/
    city-rooftop.mp4
    poster.jpg
```

The folder name (`beach-sunset`) becomes the video `id` and a prettified default
title. The easiest way to create this structure is the built-in **/upload** tool,
which names the folder from the title you enter.

### Optional metadata overrides — `src/lib/server/videos.json`

```json
{
  "beach-sunset": { "title": "Beach Sunset", "description": "Shot in 8K on the north shore" },
  "city-rooftop": { "title": "City Rooftop at Night" }
}
```

## Uploading videos

Sign in, click **Upload**, enter a title, choose your 360 MP4, and start. The
file is uploaded directly to R2 in 100 MB parts via presigned multipart URLs, so
2 GB+ files upload reliably without hitting any serverless limits. This tool is
intended as a temporary admin convenience — it lives behind the same password as
the rest of the site.

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token credentials |
| `R2_BUCKET` | Bucket name |
| `R2_ENDPOINT` | Optional; derived from account id if blank |
| `R2_VIDEO_PREFIX` | Optional; defaults to `videos/` |
| `SITE_PASSWORD` | Shared login password |
| `AUTH_SECRET` | Long random string for cookie signing |

## R2 CORS

Presigned playback and downloads happen directly from the browser to R2, so the
bucket needs a CORS policy that allows your site origin. In the Cloudflare R2
dashboard (bucket → Settings → CORS policy):

The `PUT` method and the `ETag` exposed header are required for the multipart
uploader to work.

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-app.vercel.app"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

## Local development

```bash
npm install
npm run dev
```

Visit http://localhost:5173 and sign in with `SITE_PASSWORD`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel (framework auto-detected as SvelteKit).
3. Add all environment variables from `.env.example` in the Vercel project settings.
4. Deploy. Add your production domain to the R2 CORS `AllowedOrigins`.

## Notes

- One video file per folder. If multiple video files exist in a folder, the
  largest one is used.
- The R2 API token used for uploads needs write permissions (Object Read & Write).
