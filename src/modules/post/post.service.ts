import mongoose, { Types } from "mongoose";
import { CreatePostDTO, ListPostsQueryDTO, UpdatePostDTO } from "./post.dto";
import { postRepo, PostRepository } from "../../DB/models/post/post.repository";
import { NotFoundException, UnauthorizedException } from "../../common";
import {
  commentRepo,
  CommentRepository,
} from "../../DB/models/comment/comment.repository";
import {
  userFriendRepo,
  UserFriendRepository,
} from "../../DB/models/user-friend/user-friend.repository";
import { userRepo, UserRepository } from "../../DB/models/user/user.repository";

class PostSevice {
  constructor(
    private readonly _postRepo: PostRepository,
    private readonly _commentRepo: CommentRepository,
    private readonly _userFriendRepo: UserFriendRepository,
    private readonly _userRepo: UserRepository,
  ) {}

  private async getPostsByUsers(
    userIds: Types.ObjectId[],
    query: ListPostsQueryDTO,
  ) {
    const skip = (query.page - 1) * query.limit;
    const posts = await this._postRepo.getAll(
      {
        userId: { $in: userIds },
      },
      {},
      {
        sort: { createdAt: -1 },
        skip,
        limit: query.limit + 1,
        // Match getOne()'s populate so feed/my-posts list items carry
        // author name/avatar too - explicit field allowlist since User
        // has no `select: false` on password, so an unqualified populate
        // would otherwise leak the password hash into the response.
        populate: { path: "userId", select: "userName profilePic" },
      },
    );

    const hasNext = posts.length > query.limit;
    const data = hasNext ? posts.slice(0, query.limit) : posts;

    return {
      data,
      page: query.page,
      limit: query.limit,
      hasNext,
    };
  }

  async create(
    createPostDTO: CreatePostDTO,
    userId: Types.ObjectId,
    attachmentPublicIds?: string[],
  ) {
    const createdPost = await this._postRepo.create({
      ...createPostDTO,
      userId,
      ...(attachmentPublicIds ? { attachmentPublicIds } : {}),
    });
    // Same reasoning as the feed/my-posts populate: without this, your
    // own just-created post shows the unpopulated fallback until the
    // feed is refetched, inconsistent with every other post in the list.
    // Cast: see the identical note in comment.service.ts's create().
    return await (createdPost as any).populate({
      path: "userId",
      select: "userName profilePic",
    });
  }

  async getOne(id: mongoose.Types.ObjectId) {
    return await this._postRepo.getOne(
      { _id: id },
      {},
      // Explicit field allowlist, same as every other populate in this
      // file - this one was the odd one out (no select), so GET /post/:id
      // (public, no auth) was returning the full author document
      // including email.
      { populate: { path: "userId", select: "userName profilePic" } },
    );
  }

  async update(
    id: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    updatePostDTO: UpdatePostDTO,
  ) {
    const postUpdated = await this._postRepo.updateOne(
      { _id: id, userId },
      updatePostDTO,
      { returnDocument: "after" },
    );

    if (!postUpdated)
      throw new UnauthorizedException(
        "you are not authorized to update this post",
      );
    return postUpdated;
  }

  async delete(id: Types.ObjectId, userId: Types.ObjectId) {
    {
      const postExist = await this._postRepo.getOne({ _id: id });
      if (!postExist) throw new NotFoundException("post not found");

      await this._commentRepo.deleteMany({ postId: id });

      const { deletedCount } = await this._postRepo.deleteOne({
        _id: id,
        userId,
      });

      return deletedCount;
    }
  }

  async getFeed(userId: Types.ObjectId, query: ListPostsQueryDTO) {
    const relations = await this._userFriendRepo.getAll({
      $or: [{ user: userId }, { friend: userId }],
    });

    // Was friends-only unconditionally: a brand-new user (zero
    // friendships) got a feed of just their own posts - empty for
    // anyone who hasn't posted yet, with no path to ever fill it other
    // than posting into a void. Discovery feed (every active user's
    // posts) for exactly that empty-network case, so there's something
    // to see and someone to send a friend request to from post cards -
    // sendRequest() doesn't require any prior feed relationship anyway.
    // Once the first friendship exists, back to friends-only below -
    // this is a fallback for new users, not a permanent global feed for
    // everyone regardless of network size.
    if (relations.length === 0) {
      const activeUsers = await this._userRepo.getAll(
        { deletedAt: null },
        { _id: 1 },
      );
      return this.getPostsByUsers(
        activeUsers.map((u) => u._id),
        query,
      );
    }

    const feedUserIdStrings = new Set<string>([userId.toString()]);
    for (const relation of relations) {
      if (relation.user.equals(userId)) {
        feedUserIdStrings.add(relation.friend.toString());
      } else {
        feedUserIdStrings.add(relation.user.toString());
      }
    }

    const feedUserIds = [...feedUserIdStrings].map(
      (id) => new Types.ObjectId(id),
    );

    // Filter out soft-deleted friends *before* the paginated posts query,
    // not via a post-populate match+filter - filtering after the fact
    // would shrink a page below `limit` while the +1-slice hasNext logic
    // still says there's more, which there might not be. The requesting
    // user's own id needs no such check: isAuthenticated already rejects
    // a soft-deleted account before this ever runs.
    const activeUsers = await this._userRepo.getAll(
      { _id: { $in: feedUserIds }, deletedAt: null },
      { _id: 1 },
    );
    const activeUserIds = activeUsers.map((u) => u._id);

    return this.getPostsByUsers(activeUserIds, query);
  }

  async getMyPosts(userId: Types.ObjectId, query: ListPostsQueryDTO) {
    return this.getPostsByUsers([userId], query);
  }

  /**
   * Backs GET /post/user/:id (public profile posts). Unlike getMyPosts,
   * the target isn't the authenticated caller, so it isn't already
   * guaranteed active by isAuthenticated - 404 up front for a
   * nonexistent or soft-deleted target, matching GET /user/:id's
   * behavior for the same id. Reuses getPostsByUsers, so population and
   * pagination are identical to the feed.
   */
  async getByUser(targetUserId: Types.ObjectId, query: ListPostsQueryDTO) {
    const targetExists = await this._userRepo.getOne(
      { _id: targetUserId, deletedAt: null },
      { _id: 1 },
    );
    if (!targetExists) throw new NotFoundException("user not found");

    return this.getPostsByUsers([targetUserId], query);
  }
}

export default new PostSevice(postRepo, commentRepo, userFriendRepo, userRepo);
