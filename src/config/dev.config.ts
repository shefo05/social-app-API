export const DB_URL = process.env.DB_URL as string;
export const REDIS_URL = process.env.REDIS_URL as string;

export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY as string;
// Must exactly match a verified Single Sender (or domain sender) in SendGrid -
// no safe default exists, unlike Resend's sandbox address.
export const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL as string;

export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME as string;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY as string;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET as string;

// Shared fallback avatar - a single Cloudinary asset uploaded once (see
// public/avatarr.png), never assigned a per-user profilePicPublicId so the
// account-cleanup job never destroys it.
export const DEFAULT_AVATAR_URL = process.env.DEFAULT_AVATAR_URL as string;

// Google OAuth client id - used as both the frontend's Google Identity
// Services client id and the backend's expected token `audience`. No
// client secret needed: the frontend gets an ID token directly (Google
// Identity Services / One Tap), and google-auth-library only needs the
// client id to verify that token's signature and audience.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;