import z from "zod";
import { generalFields as GF } from "../../common";

export const signupSchema = z.object({
  email: GF.email,
  gender: GF.gender,
  password: GF.password,
  userName: GF.userName,
  phoneNumber: GF.phoneNumber,
});

export const loginSchema = z.object({
  email: GF.email,
  password: GF.password,
  FCM: z.string().optional(),
});
export const verifyAccountSchema = z.object({
  email: GF.email,
  otp: GF.otp,
});

export const sendOtpSchema = z.object({
  email: GF.email,
});

export const resetPasswordSchema = z.object({
  otp: GF.otp,
  newPassword: GF.password,
});
export const updateUserSchema = z.object({
  email: GF.email.optional(),
  phoneNumber: GF.phoneNumber.optional(),
  userName: GF.userName.optional(),
  // Set by the uploadAvatar() middleware before this schema runs, not a
  // client-supplied field - without it here, zod strips it silently
  // since z.object() drops unrecognized keys by default.
  profilePic: z.string().optional(),
});
