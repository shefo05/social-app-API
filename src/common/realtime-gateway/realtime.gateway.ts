import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "node:http";
import { verifyToken } from "../utils/jwt.utils";
import authService from "../../modules/auth/auth.service";
import { userFriendRepo } from "../../DB/models/user-friend/user-friend.repository";

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

// Module-level singleton: RealtimeGateway needs the http.Server instance,
// which only exists after app.listen() inside bootstrap() - it can't be a
// top-level provider constructed at import time like sendgridProvider/
// redisCacheProvider are. Services that need to emit import
// getRealtimeGateway() instead of having `io` threaded through every
// call chain.
let currentGateway: RealtimeGateway | null = null;

export class RealtimeGateway {
  private _io: Server;

  /**
   * Presence tracking: userId -> set of connected socket ids. In-memory,
   * not Redis-backed - correct and sufficient for a single server
   * instance (this app's deployment target), but would need a shared
   * store (Redis pub/sub or similar) to stay correct across multiple
   * instances. A Set (not a counter) handles multi-tab correctly: the
   * user is "online" as long as the set is non-empty, and closing one of
   * two tabs just removes one entry instead of flipping them offline.
   */
  private _onlineUsers = new Map<string, Set<string>>();

  constructor(server: HttpServer) {
    this._io = new Server(server, { cors: { origin: "*" } });
    this._registerAuthMiddleware();
    this._registerConnectionHandlers();
    currentGateway = this;
  }

  public get io(): Server {
    return this._io;
  }

  /**
   * Same verifyToken -> checkUserExist -> reject pattern as the REST
   * isAuthenticated middleware, just over the handshake instead of a
   * header. A socket with no/invalid/stale token never completes the
   * connection - there's no legitimate anonymous use of these events.
   */
  private _registerAuthMiddleware() {
    this._io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) return next(new Error("unauthorized: token required"));

        const payload = verifyToken(token);
        const userExist = await authService.checkUserExist({
          _id: payload.sub,
        });
        if (!userExist) return next(new Error("unauthorized: user not found"));

        socket.data.userId = userExist._id.toString();
        next();
      } catch {
        next(new Error("unauthorized: invalid token"));
      }
    });
  }

  /**
   * Room strategy:
   * - `user:{userId}` - every socket auto-joins its own on connect, from
   *   the verified JWT (never client-supplied). Used for direct
   *   notifications (friend requests) that should reach someone
   *   regardless of what page they're on.
   * - `post:{postId}` - opt-in, joined only while a client is actually
   *   viewing that post's detail page. Posts have no read-side
   *   authorization (GET /post/:id needs no auth either), so joining
   *   doesn't check anything beyond a well-formed id.
   * Socket.IO leaves every room automatically on disconnect - no manual
   * cleanup needed.
   */
  private _registerConnectionHandlers() {
    this._io.on("connection", (socket: Socket) => {
      const userId = socket.data.userId as string;
      socket.join(`user:${userId}`);
      this._handlePresenceConnect(userId, socket.id);

      socket.on("post:join", (payload: { postId?: string }) => {
        if (payload?.postId && OBJECT_ID_REGEX.test(payload.postId)) {
          socket.join(`post:${payload.postId}`);
        }
      });

      socket.on("post:leave", (payload: { postId?: string }) => {
        if (payload?.postId && OBJECT_ID_REGEX.test(payload.postId)) {
          socket.leave(`post:${payload.postId}`);
        }
      });

      socket.on("disconnect", () => {
        this._handlePresenceDisconnect(userId, socket.id);
      });
    });
  }

  /**
   * First socket for this user -> online transition, broadcast to
   * friends only (via their `user:{id}` rooms), never globally. A
   * second/third tab just adds to the existing set with no broadcast.
   */
  private async _handlePresenceConnect(userId: string, socketId: string) {
    const isFirstConnection = !this._onlineUsers.has(userId);
    let sockets = this._onlineUsers.get(userId);
    if (!sockets) {
      sockets = new Set();
      this._onlineUsers.set(userId, sockets);
    }
    sockets.add(socketId);

    if (isFirstConnection) {
      const friendIds = await this._getFriendIds(userId);
      for (const friendId of friendIds) {
        this.emitToUser(friendId, "presence:online", { userId });
      }
    }
  }

  /** Last socket for this user closing -> offline transition. */
  private async _handlePresenceDisconnect(userId: string, socketId: string) {
    const sockets = this._onlineUsers.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size > 0) return;

    this._onlineUsers.delete(userId);
    const friendIds = await this._getFriendIds(userId);
    for (const friendId of friendIds) {
      this.emitToUser(friendId, "presence:offline", { userId });
    }
  }

  private async _getFriendIds(userId: string): Promise<string[]> {
    const relations = await userFriendRepo.getAll({
      $or: [{ user: userId }, { friend: userId }],
    });
    return relations.map((r) =>
      r.user.toString() === userId ? r.friend.toString() : r.user.toString(),
    );
  }

  isOnline(userId: string): boolean {
    return (this._onlineUsers.get(userId)?.size ?? 0) > 0;
  }

  emitToPost(postId: string, event: string, payload: unknown) {
    this._io.to(`post:${postId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this._io.to(`user:${userId}`).emit(event, payload);
  }
}

export function getRealtimeGateway(): RealtimeGateway | null {
  return currentGateway;
}
