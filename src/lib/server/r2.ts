import {
	AbortMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	S3Client,
	UploadPartCommand,
	type CompletedPart,
	type ListObjectsV2CommandOutput,
	type _Object
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2 } from './env';

let _client: S3Client | null = null;

export function r2(): S3Client {
	if (_client) return _client;
	_client = new S3Client({
		region: 'auto',
		endpoint: R2.endpoint(),
		credentials: {
			accessKeyId: R2.accessKeyId(),
			secretAccessKey: R2.secretAccessKey()
		},
		// R2 does not support the AWS SDK's default request checksums. Leaving them
		// enabled bakes a checksum of an empty body into presigned PUT URLs, which
		// makes every browser part upload fail. Only add checksums when required.
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED'
	});
	return _client;
}

/** Returns true if an object already exists at the given key. */
export async function objectExists(key: string): Promise<boolean> {
	try {
		await r2().send(new HeadObjectCommand({ Bucket: R2.bucket(), Key: key }));
		return true;
	} catch (err) {
		const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
		if (status === 404 || status === 403) return false;
		if ((err as { name?: string })?.name === 'NotFound') return false;
		throw err;
	}
}

/** List every object in the bucket under the given prefix (handles pagination). */
export async function listObjects(prefix: string): Promise<_Object[]> {
	const client = r2();
	const bucket = R2.bucket();
	const out: _Object[] = [];
	let token: string | undefined = undefined;

	do {
		const res: ListObjectsV2CommandOutput = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: token
			})
		);
		if (res.Contents) out.push(...res.Contents);
		token = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (token);

	return out;
}

/** Presigned URL for inline playback (range requests supported by R2). */
export function presignStream(key: string, expiresIn = 60 * 60): Promise<string> {
	return getSignedUrl(
		r2(),
		new GetObjectCommand({ Bucket: R2.bucket(), Key: key }),
		{ expiresIn }
	);
}

/** Presigned URL that forces a download with the given filename. */
export function presignDownload(
	key: string,
	filename: string,
	expiresIn = 60 * 60
): Promise<string> {
	return getSignedUrl(
		r2(),
		new GetObjectCommand({
			Bucket: R2.bucket(),
			Key: key,
			ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`
		}),
		{ expiresIn }
	);
}

// ---------------------------------------------------------------------------
// Multipart upload (for very large files uploaded directly from the browser)
// ---------------------------------------------------------------------------

export async function createMultipartUpload(
	key: string,
	contentType: string
): Promise<string> {
	const res = await r2().send(
		new CreateMultipartUploadCommand({
			Bucket: R2.bucket(),
			Key: key,
			ContentType: contentType || 'application/octet-stream'
		})
	);
	if (!res.UploadId) throw new Error('Failed to create multipart upload');
	return res.UploadId;
}

/** Presigned URL the browser uses to PUT a single part directly to R2. */
export function presignUploadPart(
	key: string,
	uploadId: string,
	partNumber: number,
	expiresIn = 60 * 60 * 6
): Promise<string> {
	return getSignedUrl(
		r2(),
		new UploadPartCommand({
			Bucket: R2.bucket(),
			Key: key,
			UploadId: uploadId,
			PartNumber: partNumber
		}),
		{ expiresIn }
	);
}

export async function completeMultipartUpload(
	key: string,
	uploadId: string,
	parts: CompletedPart[]
): Promise<void> {
	await r2().send(
		new CompleteMultipartUploadCommand({
			Bucket: R2.bucket(),
			Key: key,
			UploadId: uploadId,
			MultipartUpload: {
				Parts: [...parts].sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0))
			}
		})
	);
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
	await r2().send(
		new AbortMultipartUploadCommand({
			Bucket: R2.bucket(),
			Key: key,
			UploadId: uploadId
		})
	);
}
