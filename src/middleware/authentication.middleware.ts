import type { NextFunction, Request, Response } from "express";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  verifyToken,
} from "../common";
import authService from "../modules/auth/auth.service";

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { authorization } = req.headers;
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
    // jwt.verify throws a raw JsonWebTokenError/TokenExpiredError with no
    // `.cause`, which the global error handler would otherwise default to
    // 500. Normalize it to a real 401 so clients can tell "session is dead"
    // apart from generic server errors and ownership-check 401s.
    throw new UnauthorizedException("invalid or expired token");
  }

  const userExist = await authService.checkUserExist({ _id: payload.sub });
  if (!userExist) throw new NotFoundException("user not found");

  req.user = userExist;
  next();
};
