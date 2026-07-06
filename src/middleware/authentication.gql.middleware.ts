import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  verifyToken,
} from "../common";
import authService from "../modules/auth/auth.service";

/**
 * GraphQL counterpart to isAuthenticated (REST) - was previously a
 * separate, weaker implementation: no missing-header guard (crashed on
 * `.split` instead), no try/catch around verifyToken (crashed on an
 * invalid/expired token instead of a clean 401), and critically, no
 * checkUserExist() call at all - a soft-deleted account's still-valid
 * JWT could call addPost/updatePost/deletePost with none of the
 * soft-delete enforcement REST has. Mirrors isAuthenticated exactly now.
 */
export const isAuthGQL = async (context: any) => {
  const authorization = context.headers?.authorization;
  if (!authorization) throw new BadRequestException("send a valid token");
  const token = (
    authorization.startsWith("Bearer ")
      ? authorization.split(" ")[1]
      : authorization
  ) as string;

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new UnauthorizedException("invalid or expired token");
  }

  const userExist = await authService.checkUserExist({ _id: payload.sub });
  if (!userExist) throw new NotFoundException("user not found");

  context.payload = payload;
  context.user = userExist;
};
