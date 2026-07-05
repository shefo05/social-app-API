import cron from "node-cron";
import { Types } from "mongoose";
import { userRepo } from "../../DB/models/user/user.repository";
import { postRepo } from "../../DB/models/post/post.repository";
import { commentRepo } from "../../DB/models/comment/comment.repository";
import { requestRepo } from "../../DB/models/request/request.repository";
import { userFriendRepo } from "../../DB/models/user-friend/user-friend.repository";
import { userReactionRepo } from "../../DB/models/user-reaction/user-reaction.repository";
import { cloudinaryProvider } from "../cloud/cloudinary/init";

const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Permanently erases one account that's past its 30-day soft-delete grace
 * period: reactions (made by them, and made on their posts/comments),
 * comments (their own, and replies-of-replies on their own posts),
 * posts, pending requests, friendships, their Cloudinary avatar (only if
 * it's a real upload - profilePicPublicId is never set for the shared
 * default avatar, see user.model.ts), and finally the user document
 * itself.
 */
async function purgeUser(user: { _id: Types.ObjectId; deletedAt?: Date | null; profilePicPublicId?: string }) {
  const userId = user._id;

  const userPosts = await postRepo.getAll({ userId }, { _id: 1 });
  const userPostIds = userPosts.map((p) => p._id);

  const commentsOnUserPosts =
    userPostIds.length > 0
      ? await commentRepo.getAll({ postId: { $in: userPostIds } }, { _id: 1 })
      : [];
  const userOwnComments = await commentRepo.getAll({ userId }, { _id: 1 });
  const commentIdSet = new Set<string>(
    [...commentsOnUserPosts, ...userOwnComments].map((c) => c._id.toString()),
  );
  const allCommentIds = [...commentIdSet].map((id) => new Types.ObjectId(id));

  // Dangling reactions: made by this user anywhere, or made on any post/
  // comment this user owns (about to be deleted below either way).
  await userReactionRepo.deleteMany({
    $or: [{ userId }, { refId: { $in: [...userPostIds, ...allCommentIds] } }],
  });

  if (userPostIds.length > 0) {
    await commentRepo.deleteMany({ postId: { $in: userPostIds } });
  }
  await commentRepo.deleteMany({ userId });
  await postRepo.deleteMany({ userId });

  await requestRepo.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] });
  await userFriendRepo.deleteMany({ $or: [{ user: userId }, { friend: userId }] });

  if (user.profilePicPublicId) {
    await cloudinaryProvider.deleteFile(user.profilePicPublicId).catch((err) => {
      console.log(`[cleanup] failed to delete avatar for user ${userId}:`, err.message);
    });
  }

  await userRepo.deleteOne({ _id: userId });
  console.log(`[cleanup] permanently deleted user ${userId} (soft-deleted at ${user.deletedAt?.toISOString()})`);
}

export async function purgeExpiredSoftDeletedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);
  const expiredUsers = await userRepo.getAll({
    deletedAt: { $ne: null, $lte: cutoff },
  });

  for (const user of expiredUsers) {
    await purgeUser(user);
  }

  return expiredUsers.length;
}

/**
 * Daily is plenty of granularity for a 30-day grace period. Also runs
 * once immediately at boot: Render's free tier sleeps the service when
 * idle, so a fixed cron time can be silently skipped for days if nothing
 * wakes it up right then - an immediate run on every boot closes that
 * gap, at the cost of a harmless no-op query on deployments with nothing
 * to purge.
 */
export function scheduleAccountCleanupJob() {
  purgeExpiredSoftDeletedAccounts().catch((err) => {
    console.log("[cleanup] initial account purge run failed:", err.message);
  });

  cron.schedule("0 3 * * *", () => {
    purgeExpiredSoftDeletedAccounts().catch((err) => {
      console.log("[cleanup] scheduled account purge run failed:", err.message);
    });
  });
}
