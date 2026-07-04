import { model, Schema } from "mongoose";
import { IUser, SYS_GENDER, SYS_PROVIDER, SYS_ROLE } from "../../../common";

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
    profilePic: String,
    profilePicPublicId: String,
  },
  { timestamps: true },
);

export const User = model<IUser>("User", schema);
