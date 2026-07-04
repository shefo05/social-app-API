import z from "zod";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordConfirmSchema,
  resetPasswordSchema,
  sendOtpSchema,
  signupSchema,
  updateUserSchema,
  verifyAccountSchema,
} from "./auth.validation";

// export interface SignupDTO {
//   email: string;
//   password: string;
//   userName: string;
//   phoneNumber?: string;
//   gender: SYS_GENDER;
// }

export type SignupDTO = z.infer<typeof signupSchema>;

// export interface LoginDTO {
//   email: string;
//   password: string;
// }
export type LoginDTO = z.infer<typeof loginSchema>;

// export interface VerifyAccountDTO {
//   otp: string;
//   email: string;
// }
export type VerifyAccountDTO = z.infer<typeof verifyAccountSchema>;

// export interface SendOtpDTO {
//   email: string;
// }
export type SendOtpDTO = z.infer<typeof sendOtpSchema>;

// export interface ResetPasswordDTO {
//   otp: string;
//   newPassword: string;
// }
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;

export type UpdateUserDTO = z.infer<typeof updateUserSchema>;

export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordConfirmDTO = z.infer<typeof resetPasswordConfirmSchema>;
