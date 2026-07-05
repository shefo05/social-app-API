import { SYS_GENDER, SYS_PROVIDER, SYS_ROLE } from "../enums";

export interface IUser {
  userName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role: SYS_ROLE;
  gender?: SYS_GENDER | undefined;
  provider: SYS_PROVIDER;
  profilePic: string;
  /** Cloudinary public_id for profilePic - for future deletion. */
  profilePicPublicId?: string;
  bio?: string | undefined;
  /**
   * Soft-delete marker. null (or unset) = active account. Set on
   * DELETE /auth/delete-account, cleared on a successful login within the
   * 30-day grace period (reactivation). Once older than 30 days, the
   * scheduled cleanup job hard-deletes the document entirely - see
   * src/common/jobs/cleanup-deleted-accounts.job.ts.
   */
  deletedAt?: Date | null;
}
