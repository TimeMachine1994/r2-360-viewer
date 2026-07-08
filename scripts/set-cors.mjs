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

const CORSRules = [
	{
		AllowedOrigins: ['*'],
		AllowedMethods: ['GET', 'HEAD'],
		AllowedHeaders: ['*'],
		ExposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag'],
		MaxAgeSeconds: 3600
	}
];

await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules } }));
console.log(`Applied CORS policy to bucket "${bucket}".`);

const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log('Current CORS rules:');
console.log(JSON.stringify(current.CORSRules, null, 2));
