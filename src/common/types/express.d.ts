import { UserDocument } from "./user.type";

// export interface Request{
//     user: IUser;
// }

declare module "express-serve-static-core" {
  interface Request {
    user: UserDocument;
    /** Cloudinary public_ids for req.body.attachments, set by uploadAttachments() */
    uploadedPublicIds?: string[];
    /** Cloudinary public_id for req.body.profilePic, set by uploadAvatar() */
    uploadedAvatarPublicId?: string;
  }
}
