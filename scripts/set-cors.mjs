import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const endpoint =
	process.env.R2_ENDPOINT ||
	(accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
const bucket = process.env.R2_BUCKET;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

for (const [name, value] of Object.entries({
	R2_BUCKET: bucket,
	R2_ACCESS_KEY_ID: accessKeyId,
	R2_SECRET_ACCESS_KEY: secretAccessKey
})) {
	if (!value) {
		console.error(`Missing required environment variable: ${name}`);
		process.exit(1);
	}
}
if (!endpoint) {
	console.error('Missing R2_ENDPOINT or R2_ACCOUNT_ID');
	process.exit(1);
}

const client = new S3Client({
	region: 'auto',
	endpoint,
	credentials: { accessKeyId, secretAccessKey }
});

// Comma-separated allowed origins, e.g.
//   CORS_ALLOWED_ORIGINS="http://localhost:5173,https://your-app.vercel.app"
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
	.split(',')
	.map((o) => o.trim().replace(/\/$/, ''))
	.filter(Boolean);

if (allowedOrigins.length === 0) {
	console.error('Set CORS_ALLOWED_ORIGINS to a comma-separated list of origins.');
	process.exit(1);
}

const CORSRules = [
	{
		AllowedOrigins: allowedOrigins,
		// GET/HEAD for playback + downloads; PUT for the multipart uploader.
		AllowedMethods: ['GET', 'HEAD', 'PUT'],
		AllowedHeaders: ['*'],
		// ETag is required to finalize multipart uploads; range headers for seeking.
		ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'],
		MaxAgeSeconds: 3600
	}
];

await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules } }));
console.log(`Applied CORS policy to bucket "${bucket}".`);

const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log('Current CORS rules:');
console.log(JSON.stringify(current.CORSRules, null, 2));
