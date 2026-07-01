import { env } from '$env/dynamic/private';

function required(name: string, value: string | undefined): string {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

export const R2 = {
	accountId: env.R2_ACCOUNT_ID ?? '',
	accessKeyId: () => required('R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID),
	secretAccessKey: () => required('R2_SECRET_ACCESS_KEY', env.R2_SECRET_ACCESS_KEY),
	bucket: () => required('R2_BUCKET', env.R2_BUCKET),
	// Either provide R2_ENDPOINT directly, or it is derived from the account id.
	endpoint: () =>
		env.R2_ENDPOINT ||
		(env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '')
};

export const AUTH = {
	password: () => required('SITE_PASSWORD', env.SITE_PASSWORD),
	secret: () => required('AUTH_SECRET', env.AUTH_SECRET)
};

/** Prefix in the bucket where per-video folders live. */
export const VIDEO_PREFIX = env.R2_VIDEO_PREFIX ?? 'videos/';
