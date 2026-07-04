import { Types } from "mongoose";
import { AddReactionDTO } from "../dto";
import { BadRequestException, NotFoundException, ON_MODEL } from "..";
import { UserReactionRepository } from "../../DB/models/user-reaction/user-reaction.repository";
import { PostRepository } from "../../DB/models/post/post.repository";
import { CommentRepository } from "../../DB/models/comment/comment.repository";
// import { INotificationProvider } from "../notification/notification.interface";
import { ICacheProvider } from "../cache/cache.interface";
import { getRealtimeGateway } from "../realtime-gateway/realtime.gateway";

function toModel(collectionName: string) {
  switch (collectionName) {
    case "posts":
      return ON_MODEL.Post;
    case "comments":
      return ON_MODEL.Comment;

    default:
      throw new BadRequestException("invalid collection");
  }
}

export const addReaction = async (
  addReactionDTO: AddReactionDTO,
  userId: Types.ObjectId,
  repo: PostRepository | CommentRepository,
  // pushNotificationProvider: INotificationProvider,
  cacheProvider: ICacheProvider,
) => {
  const docExist = await repo.getOne({
    _id: addReactionDTO.id,
  });

  if (!docExist)
    throw new NotFoundException(`${repo.model.modelName} not found`);

  const collectionName = docExist.collection.name;
  const userReactionRepo = new UserReactionRepository();

  const modelId = new Types.ObjectId(addReactionDTO.id);

  // Post reactions broadcast to their own post:{id} room; comment
  // reactions still broadcast to the parent post's room, since comments
  // are only ever viewed in the context of a post page - there's no
  // separate "viewing a comment" room.
  const targetType: "post" | "comment" =
    collectionName === "posts" ? "post" : "comment";
  const postId =
    targetType === "post"
      ? modelId.toString()
      : (docExist as unknown as { postId: Types.ObjectId }).postId.toString();

  const emitReaction = (
    reactionsCount: number,
    action: "added" | "removed" | "changed",
  ) => {
    getRealtimeGateway()?.emitToPost(postId, "reaction:new", {
      targetType,
      targetId: modelId.toString(),
      postId,
      reactionsCount,
      userId: userId.toString(),
      reaction: addReactionDTO.reaction,
      action,
    });
  };

  const userReaction = await userReactionRepo.getOne({
    onModel: toModel(collectionName),
    refId: modelId,
    userId,
  });
  // add new reaction
  if (!userReaction) {
    await userReactionRepo.create({
      onModel: toModel(collectionName),
      refId: modelId,
      userId,
      reaction: addReactionDTO.reaction,
    });
    const updated = await repo.updateOne(
      { _id: addReactionDTO.id },
      { $inc: { reactionsCount: 1 } },
    );
    emitReaction(
      updated ? Number(updated.reactionsCount) : Number(docExist.reactionsCount) + 1,
      "added",
    );
    return;
  }
  //remove reaction
  if (userReaction.reaction == addReactionDTO.reaction) {
    await userReactionRepo.deleteOne({ _id: userReaction._id });
    const updated = await repo.updateOne(
      { _id: addReactionDTO.id },
      { $inc: { reactionsCount: -1 } },
    );
    emitReaction(
      updated ? Number(updated.reactionsCount) : Number(docExist.reactionsCount) - 1,
      "removed",
    );
    return;
  }
  //update reaction
  await userReactionRepo.updateOne(
    { _id: userReaction._id },
    { reaction: addReactionDTO.reaction },
  );
  emitReaction(Number(docExist.reactionsCount), "changed");

  return;
};
