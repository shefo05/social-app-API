import { Types } from "mongoose";
import { AddReactionDTO } from "../dto";
import { BadRequestException, NotFoundException, ON_MODEL } from "..";
import { UserReactionRepository } from "../../DB/models/user-reaction/user-reaction.repository";
import { PostRepository } from "../../DB/models/post/post.repository";
import { CommentRepository } from "../../DB/models/comment/comment.repository";
// import { INotificationProvider } from "../notification/notification.interface";
import { ICacheProvider } from "../cache/cache.interface";

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
    await repo.updateOne(
      { _id: addReactionDTO.id },
      { $inc: { reactionsCount: 1 } },
    );
    // const fcmTokens = await cacheProvider.getAllSet(
    //   `${docExist.userId.toString()}:FCM`,
    // );
    // if (fcmTokens) {
    //   await pushNotificationProvider.sendAll(fcmTokens, {
    //     title: `your ${repo.model.modelName} you shared`,
    //     body: `${userId.toString()} has react to your ${repo.model.modelName} by ${addReactionDTO.reaction}`,
    //   });
    // }
    return;
  }
  //remove reaction
  if (userReaction.reaction == addReactionDTO.reaction) {
    await userReactionRepo.deleteOne({ _id: userReaction._id });
    repo.updateOne(
      { _id: addReactionDTO.id },
      { $inc: { reactionsCount: -1 } },
    );
    return;
  }
  //update reaction
  await userReactionRepo.updateOne(
    { _id: userReaction._id },
    { reaction: addReactionDTO.reaction },
  );
  // const fcmTokens = await cacheProvider.getAllSet(
  //   `${docExist.userId.toString()}:FCM`,
  // );
  // if (fcmTokens) {
  //   await pushNotificationProvider.sendAll(fcmTokens, {
  //     title: `your ${repo.model.modelName} you shared`,
  //     body: `${userId.toString()} has react to your ${repo.model.modelName} by ${addReactionDTO.reaction}`,
  //   });
  // }

  return;
};
