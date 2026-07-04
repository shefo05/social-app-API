import mongoose from "mongoose";
import {
  requestRepo,
  RequestRepository,
} from "../../DB/models/request/request.repository";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "../../common";
import {
  userFriendRepo,
  UserFriendRepository,
} from "../../DB/models/user-friend/user-friend.repository";
import { userRepo, UserRepository } from "../../DB/models/user/user.repository";
import { RequestDashboardQueryDTO } from "./request.dto";
import { getRealtimeGateway } from "../../common/realtime-gateway/realtime.gateway";


class RequestService {
  constructor(
    private readonly _requestRepo: RequestRepository,
    private readonly _userFriendRepo: UserFriendRepository,
    private readonly _userRepo: UserRepository,
  ) {}

  async sendRequest(sender: mongoose.Types.ObjectId, receiverId: string) {
    const receiver = new mongoose.Types.ObjectId(receiverId);

    if (sender.toString() === receiver.toString()) {
      throw new BadRequestException("you can't send request to yourself ");
    }

    const userFriendExist = await this._userFriendRepo.getOne({
      $or: [
        { user: sender, friend: receiver },
        { user: receiver, friend: sender },
      ],
    });
    if (userFriendExist)
      throw new BadRequestException("you are alredy friends");

    const requestExist = await this._requestRepo.getOne({
      $or: [
        { sender: sender, receiver: receiver },
        { sender: receiver, receiver: sender },
      ],
    });
    if (requestExist) throw new ConflictException("request already exists");

    const createdRequest = await this._requestRepo.create({
      sender,
      receiver,
    });

    // Unlike REST's getDashboard() (which returns bare sender/receiver
    // ids today - no populate there), populate the sender specifically
    // for this event: an unpopulated id is close to useless for a live
    // notification, which is the entire point of this event existing.
    const senderUser = await this._userRepo.getOne(
      { _id: sender },
      "userName profilePic",
    );
    // Cast: same AbstractRepository<T>.create() generic-return-type gap
    // as post/comment create() - IRequest doesn't model timestamps
    // either, so ._id/.createdAt need a cast regardless.
    const createdRequestDoc = createdRequest as any;
    getRealtimeGateway()?.emitToUser(receiver.toString(), "request:new", {
      _id: createdRequestDoc._id.toString(),
      sender: senderUser
        ? {
            _id: senderUser._id.toString(),
            userName: senderUser.userName,
            profilePic: senderUser.profilePic,
          }
        : { _id: sender.toString() },
      receiver: receiver.toString(),
      createdAt: createdRequestDoc.createdAt,
    });

    return createdRequest;
  }

  async acceptRequest(userId: mongoose.Types.ObjectId, id: string) {
    const reqId = new mongoose.Types.ObjectId(id);

    const requestExist = await this._requestRepo.getOne({ _id: reqId });

    if (!requestExist)
      throw new NotFoundException("request is no longer exist");

    if (!requestExist.receiver.equals(userId)) {
      throw new UnauthorizedException(
        "you are not allowed to accept this request",
      );
    }

    await this._requestRepo.deleteOne({ _id: reqId });

    await this._userFriendRepo.create({
      user: userId,
      friend: requestExist.sender,
    });

    const accepterUser = await this._userRepo.getOne(
      { _id: userId },
      "userName profilePic",
    );
    getRealtimeGateway()?.emitToUser(
      requestExist.sender.toString(),
      "request:accepted",
      {
        _id: reqId.toString(),
        accepter: accepterUser
          ? {
              _id: accepterUser._id.toString(),
              userName: accepterUser.userName,
              profilePic: accepterUser.profilePic,
            }
          : { _id: userId.toString() },
      },
    );
  }

  async declineRequest(userId: mongoose.Types.ObjectId, id: string) {
    const reqId = new mongoose.Types.ObjectId(id);

    const requestExist = await this._requestRepo.getOne({ _id: reqId });
    if (!requestExist)
      throw new NotFoundException("request is no longer exist");

    if (
      !userId.equals(requestExist.sender) &&
      !userId.equals(requestExist.receiver)
    ) {
      throw new UnauthorizedException(
        "you are not allowed to decline this request",
      );
    }

    await this._requestRepo.deleteOne({ _id: reqId });
  }

  async declineRequest2(userId: mongoose.Types.ObjectId, id: string) {
    const reqId = new mongoose.Types.ObjectId(id);

    const { deletedCount } = await this._requestRepo.deleteOne({
      _id: reqId,
      $or: [{ sender: userId }, { receiver: userId }],
    });
    if (deletedCount == 0)
      throw new BadRequestException(
        "request is no longer exist or you are not authorized to decline this request",
      );
  }

  async removeFriend(userId: mongoose.Types.ObjectId, friendId: string) {
    const friend = new mongoose.Types.ObjectId(friendId);

    if (userId.equals(friend))
      throw new BadRequestException("you are not allowed to remove yourself");
    const { deletedCount } = await this._userFriendRepo.deleteOne({
      $or: [
        {
          user: userId,
          friend: friend,
        },
        {
          user: friend,
          friend: userId,
        },
      ],
    });
    if (deletedCount == 0) throw new BadRequestException("you are not friends");
  }

  async getDashboard(
    userId: mongoose.Types.ObjectId,
    query: RequestDashboardQueryDTO,
  ) {
    const [incomingCount, outgoingCount, incomingRecent, outgoingRecent] =
      await Promise.all([
        this._requestRepo.model.countDocuments({ receiver: userId }),
        this._requestRepo.model.countDocuments({ sender: userId }),
        this._requestRepo.getAll(
          { receiver: userId },
          {},
          {
            sort: { createdAt: -1 },
            limit: query.limit,
          },
        ),
        this._requestRepo.getAll(
          { sender: userId },
          {},
          {
            sort: { createdAt: -1 },
            limit: query.limit,
          },
        ),
      ]);

    return {
      incomingCount,
      outgoingCount,
      incomingRecent,
      outgoingRecent,
    };
  }
}

export default new RequestService(requestRepo, userFriendRepo, userRepo);
