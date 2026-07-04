import { Types } from "mongoose";
import {
  userFriendRepo,
  UserFriendRepository,
} from "../../DB/models/user-friend/user-friend.repository";
import { userRepo, UserRepository } from "../../DB/models/user/user.repository";

class UserService {
  constructor(
    private _userRepo: UserRepository,
    private _userFriendRepo: UserFriendRepository,
  ) {}

  async profile(id: Types.ObjectId) {
    const user = await this._userRepo.getOne({ _id: id });
    // Same populate as the request events/dashboard - friend cards were
    // showing raw truncated ids with nothing else to render.
    const friends = await this._userFriendRepo.getAll(
      { $or: [{ user: id }, { friend: id }] },
      {},
      {
        populate: [
          { path: "user", select: "userName profilePic" },
          { path: "friend", select: "userName profilePic" },
        ],
      },
    );
    return { user, friends };
  }
}

export default new UserService(userRepo, userFriendRepo);
