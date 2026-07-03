import type { NextFunction, Request, Response } from "express";
import { BadRequestException, NotFoundException, verifyToken } from "../common";
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
  const payload = verifyToken(token);

  const userExist = await authService.checkUserExist({ _id: payload.sub });
  if (!userExist) throw new NotFoundException("user not found");

  req.user = userExist;
  next();
};
