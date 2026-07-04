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

// Separate from sendOtpSchema even though the shape is identical today -
// forgot-password is semantically distinct (requires an existing real
// user, not a pending signup) and should be free to evolve independently.
export const forgotPasswordSchema = z.object({
  email: GF.email,
});

export const resetPasswordConfirmSchema = z.object({
  email: GF.email,
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
