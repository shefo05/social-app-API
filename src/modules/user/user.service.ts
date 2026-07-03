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
    const friends = await this._userFriendRepo.getAll({
      $or: [{ user: id }, { friend: id }],
    });
    return { user, friends };
  }
}

export default new UserService(userRepo, userFriendRepo);
