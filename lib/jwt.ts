import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

const JWT_SECRET: Secret = (process.env.JWT_SECRET || "dev_jwt_secret_change_me") as Secret;
const JWT_EXPIRES_IN: SignOptions["expiresIn"] = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export function signToken(payload: Record<string, any>) {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload as any, JWT_SECRET, options);
}

export function verifyToken(token: string | undefined | null) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, any>;
  } catch (err) {
    return null;
  }
}
