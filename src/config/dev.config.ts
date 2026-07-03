export const DB_URL = process.env.DB_URL as string;
export const SEND_MAIL_USER = process.env.SEND_MAIL_USER;
export const SEND_MAIL_PASS = process.env.SEND_MAIL_PASS;
export const REDIS_URL = process.env.REDIS_URL as string;

export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

export const S3_REGION = process.env.S3_REGION as string;
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
export const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID as string;
export const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY as string;