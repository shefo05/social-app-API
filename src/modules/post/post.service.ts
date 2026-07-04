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
import { after } from "node:test";

class PostSevice {
  constructor(
    private readonly _postRepo: PostRepository,
    private readonly _commentRepo: CommentRepository,
    private readonly _userFriendRepo: UserFriendRepository,
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

  async create(createPostDTO: CreatePostDTO, userId: Types.ObjectId) {
    const createdPost = await this._postRepo.create({ ...createPostDTO, userId });
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
      { populate: { path: "userId" } },
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

    return this.getPostsByUsers(feedUserIds, query);
  }

  async getMyPosts(userId: Types.ObjectId, query: ListPostsQueryDTO) {
    return this.getPostsByUsers([userId], query);
  }
}

export default new PostSevice(postRepo, commentRepo, userFriendRepo);
