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
    return createdComment;
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

    const comments = await this._commentRepo.getAll(filter);
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
