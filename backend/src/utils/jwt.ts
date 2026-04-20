import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthPayload } from '../types';

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    subject: payload.sub,
  });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthPayload & jwt.JwtPayload;
    return {
      sub: decoded.sub,
      role: decoded.role,
      profileId: decoded.profileId,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}
