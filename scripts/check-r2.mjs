import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const endpoint =
	process.env.R2_ENDPOINT ||
	(process.env.R2_ACCOUNT_ID
		? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
		: '');

console.log('endpoint:', endpoint);
console.log('bucket:', process.env.R2_BUCKET);
console.log('access key id:', (process.env.R2_ACCESS_KEY_ID ?? '').slice(0, 6) + '...');

const client = new S3Client({
	region: 'auto',
	endpoint,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
	}
});

try {
	const res = await client.send(
		new ListObjectsV2Command({
			Bucket: process.env.R2_BUCKET,
			Prefix: process.env.R2_VIDEO_PREFIX || 'videos/',
			MaxKeys: 5
		})
	);
	console.log('LIST OK. Sample keys:');
	for (const o of res.Contents ?? []) console.log(' -', o.Key);
} catch (e) {
	console.error('LIST FAILED:', e.name, '-', e.message, '(HTTP', e.$metadata?.httpStatusCode + ')');
	process.exit(1);
}
