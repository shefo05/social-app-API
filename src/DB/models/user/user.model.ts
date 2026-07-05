import { model, Schema } from "mongoose";
import { IUser, SYS_GENDER, SYS_PROVIDER, SYS_ROLE } from "../../../common";
import { DEFAULT_AVATAR_URL } from "../../../config";

const schema = new Schema<IUser>(
  {
    userName: {
      type: String,
      required: true,
      minLength: 2,
      maxLength: 20,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: String,
    password: {
      type: String,
      required: function () {
        if (this.provider == SYS_PROVIDER.google) return false;
        return true;
      },
      // Excluded from every query result by default (find/findOne/
      // findOneAndUpdate/populate all respect this) - fixes every read
      // path in one place instead of patching each call site
      // individually. login() is the one legitimate place that still
      // needs it and opts back in explicitly with "+password".
      select: false,
    },
    role: {
      type: Number,
      enum: SYS_ROLE,
      default: SYS_ROLE.user,
    },
    gender: {
      type: Number,
      enum: SYS_GENDER,
    },
    provider: {
      type: Number,
      enum: SYS_PROVIDER,
      default: SYS_PROVIDER.system,
    },
    // Schema-level default: applies whenever a document is created
    // without an explicit profilePic (signup, seed script, anything else)
    // - one place, not a fallback repeated at every read site. Existing
    // users who predate this field were backfilled once directly (see
    // the account-cleanup job report); this only covers new documents.
    profilePic: { type: String, default: DEFAULT_AVATAR_URL },
    profilePicPublicId: String,
    bio: { type: String, maxLength: 160 },
    // null = active. Set on delete-account, cleared on reactivation
    // (login within the 30-day grace period). Indexed for the daily
    // cleanup job's range query.
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", schema);
