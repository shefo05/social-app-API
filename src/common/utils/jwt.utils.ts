import jwt, { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { StringValue } from "ms";
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } from "../../config";
const generateToken = (
  payload: Record<string, unknown>,
  secret: string,
  expireTime: number | StringValue,
): string => {
  const tokenPayload = {
    ...payload,
    jti: randomUUID(),
  };

  const token = jwt.sign(tokenPayload, secret, {
    expiresIn: expireTime,
  });
  return token;
};

export function generateTokens(payload: JwtPayload) {
  const accessToken = generateToken(payload, JWT_ACCESS_SECRET, 3600);

  const refreshToken = generateToken(payload, JWT_REFRESH_SECRET, "1y");

  return { accessToken, refreshToken };
}

export function verifyToken(token: string, secret = JWT_ACCESS_SECRET) {
  const payload = jwt.verify(token, secret);
  return payload;
}
