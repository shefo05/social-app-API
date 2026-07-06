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

  /**
   * Friends-first feed: friends' (and your own) posts rank ahead of
   * everyone else's, newest-first within each tier - not a hard filter
   * with a separate all-or-nothing fallback for zero-friend users
   * anymore. That fallback used to be a distinct code path; it now falls
   * out of the same ranking for free, since "in-network" for a
   * friendless user is just `[userId]` - their own posts (if any) rank
   * first, then everyone else's, with no special-casing needed.
   *
   * Pagination: implemented as a two-tier sort key (in-network first,
   * then createdAt desc) via one aggregation, not as two sequential
   * "finish tier one, then tier two" queries. Deliberately - the
   * alternative (paginate fully through friends' posts, only then start
   * paginating non-friends') means whichever page happens to land on the
   * tier boundary is partially empty (e.g. a user with 3 friends' posts
   * and limit=10 would get a 3-item page 1, even though 7 more posts
   * exist to fill it), and the boundary math has to be reworked in the
   * service layer for every caller. A single sorted sequence with a
   * synthetic rank field sidesteps both problems: every page is fully
   * populated up to `limit` regardless of how many in-network posts
   * exist, and the existing skip/limit/+1-slice hasNext logic applies
   * completely unchanged.
   */
  private async getRankedFeed(
    inNetworkIds: Types.ObjectId[],
    query: ListPostsQueryDTO,
  ) {
    const skip = (query.page - 1) * query.limit;

    const posts = await this._postRepo.model.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },
      // Soft-deleted authors are excluded here, not filtered after the
      // fact - same reasoning as everywhere else in this file: filtering
      // post-pagination would shrink a page below `limit` while hasNext
      // still says there's more.
      { $match: { "author.deletedAt": null } },
      { $addFields: { _inNetwork: { $in: ["$userId", inNetworkIds] } } },
      { $sort: { _inNetwork: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: query.limit + 1 },
      {
        $project: {
          content: 1,
          attachments: 1,
          attachmentPublicIds: 1,
          reactionsCount: 1,
          commentsCount: 1,
          sharesCount: 1,
          createdAt: 1,
          updatedAt: 1,
          userId: {
            _id: "$author._id",
            userName: "$author.userName",
            profilePic: "$author.profilePic",
          },
        },
      },
    ]);

    const hasNext = posts.length > query.limit;
    const data = hasNext ? posts.slice(0, query.limit) : posts;

    return {
      data,
      page: query.page,
      limit: query.limit,
      hasNext,
    };
  }

  async getFeed(userId: Types.ObjectId, query: ListPostsQueryDTO) {
    const relations = await this._userFriendRepo.getAll({
      $or: [{ user: userId }, { friend: userId }],
    });

    const inNetworkIdStrings = new Set<string>([userId.toString()]);
    for (const relation of relations) {
      if (relation.user.equals(userId)) {
        inNetworkIdStrings.add(relation.friend.toString());
      } else {
        inNetworkIdStrings.add(relation.user.toString());
      }
    }

    const inNetworkIds = [...inNetworkIdStrings].map(
      (id) => new Types.ObjectId(id),
    );

    return this.getRankedFeed(inNetworkIds, query);
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
