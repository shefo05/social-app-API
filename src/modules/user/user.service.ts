import { Types } from "mongoose";
import {
  userFriendRepo,
  UserFriendRepository,
} from "../../DB/models/user-friend/user-friend.repository";
import { userRepo, UserRepository } from "../../DB/models/user/user.repository";
import { getRealtimeGateway } from "../../common/realtime-gateway/realtime.gateway";
import { NotFoundException } from "../../common";

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

  /**
   * Public profile for GET /user/:id - an explicit field *allowlist* via
   * projection (not an exclude-list), so a new sensitive field added to
   * IUser later is excluded by default instead of accidentally leaking
   * until someone remembers to blocklist it here too. 404s for both "no
   * such id" and "soft-deleted" - from an outside viewer's perspective
   * those are the same thing, and distinguishing them would leak that a
   * given id used to belong to someone.
   */
  async getPublicProfile(id: Types.ObjectId) {
    const user = await this._userRepo.getOne(
      { _id: id, deletedAt: null },
      "userName profilePic bio createdAt",
    );
    if (!user) throw new NotFoundException("user not found");
    return user;
  }

  /**
   * Backs GET /user/search?q=. Same field allowlist as getPublicProfile,
   * minus createdAt (not useful in a results dropdown). userName has no
   * text index, so this is a $regex scan - fine at this app's scale, but
   * would need a real text/Atlas Search index before it'd hold up on a
   * userName-heavy table. `q` is regex-escaped so a query containing
   * regex metacharacters (".*", "(", etc.) is matched literally instead
   * of being interpreted as a pattern - both for correctness (a name
   * with a literal "." shouldn't behave like a wildcard) and safety (an
   * attacker-supplied pattern can't trigger catastrophic backtracking).
   */
  async search(searcherId: Types.ObjectId, q: string, limit: number) {
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return await this._userRepo.getAll(
      {
        userName: { $regex: escapedQuery, $options: "i" },
        _id: { $ne: searcherId },
        deletedAt: null,
      },
      "userName profilePic bio",
      { limit, sort: { userName: 1 } },
    );
  }
}

export default new UserService(userRepo, userFriendRepo);
