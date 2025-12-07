import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export function signToken(payload: Record<string, any>) {
  return jwt.sign(payload as any, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string | undefined | null) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, any>;
  } catch (err) {
    return null;
  }
}
