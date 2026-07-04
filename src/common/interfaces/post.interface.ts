import { Types } from "mongoose";

export interface IPost {
  userId: Types.ObjectId;
  content?: string | undefined;
  attachments?: string[] | undefined;
  /** Cloudinary public_ids, same index order as attachments - for future deletion. */
  attachmentPublicIds?: string[] | undefined;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
}
