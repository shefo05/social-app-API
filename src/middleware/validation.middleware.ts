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

    // Was validating but discarding the parsed result, so req.body
    // stayed exactly as the client sent it - any extra field zod would
    // have silently stripped (e.g. "role", "password", "deletedAt" on a
    // schema that never declared them) survived untouched into whatever
    // the controller/service does with req.body next. Reassigning here
    // makes that stripping actually take effect.
    req.body = result.data;
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
  // Same parity as isvalid() above - callers should use this return
  // value instead of their original `args`, even though GraphQL's own
  // argument schema already prevents undeclared fields from arriving in
  // `args` in the first place (this is about consistency, not closing a
  // real gap the way the REST version's fix does).
  return result.data;
};
