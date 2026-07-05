import { Types } from "mongoose";
import {
  userFriendRepo,
  UserFriendRepository,
} from "../../DB/models/user-friend/user-friend.repository";
import { userRepo, UserRepository } from "../../DB/models/user/user.repository";
import { getRealtimeGateway } from "../../common/realtime-gateway/realtime.gateway";

class UserService {
  constructor(
    private _userRepo: UserRepository,
    private _userFriendRepo: UserFriendRepository,
  ) {}

  async profile(id: Types.ObjectId) {
    const user = await this._userRepo.getOne({ _id: id });
    // Same populate as the request events/dashboard - friend cards were
    // showing raw truncated ids with nothing else to render. `match`
    // nulls out the populated side when that account is soft-deleted;
    // filtered out below so deleted accounts don't appear in friends
    // lists during their grace period.
    const friendsRaw = await this._userFriendRepo.getAll(
      { $or: [{ user: id }, { friend: id }] },
      {},
      {
        populate: [
          { path: "user", select: "userName profilePic", match: { deletedAt: null } },
          { path: "friend", select: "userName profilePic", match: { deletedAt: null } },
        ],
      },
    );
    const friends = friendsRaw.filter((f: any) => f.user && f.friend);
    return { user, friends };
  }

  private async _friendIds(id: Types.ObjectId): Promise<Types.ObjectId[]> {
    const relations = await this._userFriendRepo.getAll({
      $or: [{ user: id }, { friend: id }],
    });
    return relations.map((r) => (r.user.equals(id) ? r.friend : r.user));
  }

  /**
   * Backs GET /user/online-friends - the initial snapshot the frontend
   * reads before/independently of the socket connecting (see
   * RealtimeGateway's presence doc comment for why this is a REST
   * endpoint rather than a connect-time event). A soft-deleted friend
   * can never show as online: their socket handshake is rejected by the
   * same checkUserExist() that gates isAuthenticated, so they're never
   * in the gateway's online set to begin with - no extra filtering
   * needed here.
   */
  async getOnlineFriends(id: Types.ObjectId) {
    const friendIds = await this._friendIds(id);
    const gateway = getRealtimeGateway();
    if (!gateway) return [];
    return friendIds
      .filter((friendId) => gateway.isOnline(friendId.toString()))
      .map((friendId) => friendId.toString());
  }
}

export default new UserService(userRepo, userFriendRepo);
