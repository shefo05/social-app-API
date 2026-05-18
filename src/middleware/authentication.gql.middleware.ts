import { JwtPayload } from "jsonwebtoken";
import { BadRequestException, verifyToken } from "../common";

export const isAuthGQL = (context: any) => {
  const authorization = context.headers.authorization;
  const token = authorization.split(" ")[1];

  // console.log(authorization);
  if (!token) throw new BadRequestException("token is required");


  
  context.payload = verifyToken(token);
  // console.log(context.payload);
  
  return;
};
