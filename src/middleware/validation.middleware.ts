import { Request, Response, NextFunction } from "express";
import { ZodObject } from "zod";
import { BadRequestException } from "../common";

export const isvalid = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync(req.body);
    if (!result.success) {
      const errMessages = result.error.issues.map((issue) => ({
        path: issue.path[0],
        message: issue.message,
      }));
      throw new BadRequestException("validation error", errMessages);
    }

    next();
  };
};

export const isvalidGQL = async (schema: ZodObject, args: unknown) => {
  const result = await schema.safeParseAsync(args);
  if (!result.success) {
    const errMessages = result.error.issues.map((issue) => ({
      path: issue.path[0],
      message: issue.message,
    }));
    throw new BadRequestException("validation error", errMessages);
  }
  return;
};
