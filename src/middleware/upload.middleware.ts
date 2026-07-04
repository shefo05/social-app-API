import type { NextFunction, Request, Response } from "express";
import { cloudinaryProvider } from "../common/cloud/cloudinary/init";

/**
 * Uploads req.files (from multer .array()) to Cloudinary and injects the
 * resulting URLs into req.body.attachments *before* validation middleware
 * runs, so zod schemas that check attachments (e.g. createPostSchema's
 * "content or attachments required" refine) see the real uploaded URLs.
 * Overwrites any client-supplied attachments array when files are present.
 */
export function uploadAttachments(folder: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length > 0) {
        const uploads = await Promise.all(
          files.map((file) => cloudinaryProvider.uploadFile(file, folder)),
        );
        req.body.attachments = uploads.map((upload) => upload.url);
        req.uploadedPublicIds = uploads.map((upload) => upload.publicId);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Same as uploadAttachments, but for a single req.file into req.body.profilePic. */
export function uploadAvatar(folder: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.file) {
        const upload = await cloudinaryProvider.uploadFile(req.file, folder);
        req.body.profilePic = upload.url;
        req.uploadedAvatarPublicId = upload.publicId;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
