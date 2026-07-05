import { _QueryFilter, QueryFilter, Types } from "mongoose";
import { CreateCommentDTO, UpdateCommentDTO } from "./comment.dto";
import { postRepo, PostRepository } from "../../DB/models/post/post.repository";
import {
  IComment,
  IPost,
  NotFoundException,
  UnauthorizedException,
} from "../../common";
import {
  commentRepo,
  CommentRepository,
} from "../../DB/models/comment/comment.repository";
import { getRealtimeGateway } from "../../common/realtime-gateway/realtime.gateway";

export class CommentService {
  constructor(
    private readonly _postRepo: PostRepository,
    private readonly _commentRepo: CommentRepository,
  ) {}

  async getOne(filter: QueryFilter<IComment>) {
    return await this._commentRepo.getOne(
      filter,
      {},
      {
        populate: [
          { path: "userId" },
          { path: "postId", populate: { path: "userId" } },
        ],
      },
    );
  }

  async create(
    createCommentDTO: CreateCommentDTO,
    params: any,
    userId: Types.ObjectId,
  ) {
    if (params.postId) {
      const postExist = await this._postRepo.getOne({ _id: params.postId });
      if (!postExist) throw new NotFoundException("post not available");
    }
    // const postExist = await this._postRepo.getOne({ _id: params.postId });
    // if (!postExist) throw new NotFoundException("post not available");

    let parentCommentExist = undefined;
    if (params.parentId) {
      parentCommentExist = await this._commentRepo.getOne({
        _id: params.parentId,
      });
      if (!parentCommentExist)
        throw new NotFoundException("comment not available");
    }

    let postId = params.postId || parentCommentExist?.postId;
    const createdComment = await this._commentRepo.create({
      ...createCommentDTO,
      ...params,
      userId,
      postId,
    });

    this._postRepo.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });
    // Without this, the comment you just posted shows as unpopulated
    // (frontend falls back to "Someone") until the list is refetched,
    // while every other comment in the same list already shows a name.
    // Cast: AbstractRepository<T>.create()'s generic return type doesn't
    // collapse to a concrete Mongoose Document, so .populate()'s
    // overloads don't resolve - a TS inference gap, not a runtime issue.
    const populatedComment = await (createdComment as any).populate({
      path: "userId",
      select: "userName profilePic",
    });

    // Broadcast to everyone currently viewing this post - same populated
    // shape as the REST create response, so the frontend can push it
    // straight into state with no refetch.
    getRealtimeGateway()?.emitToPost(
      postId.toString(),
      "comment:new",
      populatedComment,
    );

    return populatedComment;
  }

  // async addReaction(addReactionDTO:AddR)
  async getAll(params: any) {
    // GET /comment/:postId (no parentId segment) is the frontend's only
    // call today - it fetches the full flat list and builds the
    // top-level/reply tree client-side by parentId. Filtering on
    // `parentId: undefined` here matched only documents where that field
    // is unset (i.e. top-level comments only, since replies always have
    // it set), silently dropping every reply from the response even
    // though it was created and counted. Only filter on parentId when
    // the caller actually asked for a specific parent's replies.
    const filter: QueryFilter<IComment> = { postId: params.postId };
    if (params.parentId !== undefined) filter.parentId = params.parentId;

    // `match` nulls out userId when that author is soft-deleted (rather
    // than dropping the comment document); filtered out below. No
    // pagination here (full list, no limit/skip), so filtering after
    // populate doesn't create the page-size/hasNext mismatch that a
    // paginated list would - unlike post.service.ts's getFeed(), which
    // pre-filters user ids for exactly that reason. Accepted side effect:
    // a hidden comment can orphan its replies in the client-side
    // parentId tree, same as if it had been deleted outright.
    const commentsRaw = await this._commentRepo.getAll(
      filter,
      {},
      {
        populate: {
          path: "userId",
          select: "userName profilePic",
          match: { deletedAt: null },
        },
      },
    );
    const comments = commentsRaw.filter((c: any) => c.userId);
    if (comments.length == 0) throw new NotFoundException("no comments exist");
    return comments;
  }

  async update(
    id: Types.ObjectId,
    userId: Types.ObjectId,
    updateCommentDTO: UpdateCommentDTO,
  ) {
    const commentExist = await this._commentRepo.getOne(
      { _id: id },
      {},
      { populate: [{ path: "postId" }] },
    );
    if (!commentExist) throw new NotFoundException("comment is not available");
    const commentAuthor = commentExist.userId.toString();
    if (userId.toString() != commentAuthor) {
      throw new UnauthorizedException(
        "you are not authorized to update this comment",
      );
    }

    return await this._commentRepo.updateOne({ _id: id }, updateCommentDTO);
  }

  async delete(id: Types.ObjectId, userId: Types.ObjectId) {
    const commentExist = await this._commentRepo.getOne(
      { _id: id },
      {},
      { populate: [{ path: "postId" }] },
    );
    if (!commentExist) throw new NotFoundException("comment is not available");

    const commentAuthor = commentExist.userId.toString();

    const postAuthor = (commentExist.postId as IPost[])[0]?.userId.toString();
    // const postExist = await this._postRepo.getOne({ _id: commentExist.postId });
    // const postAuthor = postExist?.userId;

    if (userId.toString() != commentAuthor && userId.toString() != postAuthor) {
      throw new UnauthorizedException(
        "you are not authorized to delete this comment",
      );
    }

    await this._commentRepo.deleteOne({ _id: id });
  }
}

export default new CommentService(postRepo, commentRepo);
