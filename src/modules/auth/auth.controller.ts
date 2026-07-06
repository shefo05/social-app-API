import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import authService from "./auth.service";
import { authLimiter, isAuthenticated, isvalid, uploadAvatar } from "../../middleware";
import { multerUploadFile } from "../../common";
import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  resetPasswordConfirmSchema,
  resetPasswordSchema,
  sendOtpSchema,
  signupSchema,
  updateUserSchema,
  verifyAccountSchema,
} from "./auth.validation";

const router = Router();

router.post(
  "/signup",
  authLimiter,
  isvalid(signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.signup(req.body);
    return res.status(201).json({
      message: "user created successfully",
      success: true,
    });
  },
);

router.post(
  "/verify-account",
  authLimiter,
  isvalid(verifyAccountSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.verifyAccount(req.body);
    return res.status(200).json({
      message: "user verified successfully",
      success: true,
    });
  },
);

router.post(
  "/send-otp",
  authLimiter,
  isvalid(sendOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.sendOTP(req.body);
    return res.status(200).json({
      message: "OTP sent successfully",
      success: true,
    });
  },
);

router.patch(
  "/reset-password",
  isvalid(resetPasswordSchema),
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.resetPassword(req.body, req.user);
    return res.status(200).json({
      message: "password updated successfully",
      success: true,
    });
  },
);

// Unauthenticated recovery path - resetPassword above requires a valid
// session, which a locked-out user doesn't have by definition.
router.post(
  "/forgot-password",
  authLimiter,
  isvalid(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.forgotPassword(req.body);
    return res.status(200).json({
      message: "OTP sent successfully",
      success: true,
    });
  },
);

router.post(
  "/reset-password-confirm",
  authLimiter,
  isvalid(resetPasswordConfirmSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.resetPasswordConfirm(req.body);
    return res.status(200).json({
      message: "password updated successfully",
      success: true,
    });
  },
);

router.post(
  "/login",
  authLimiter,
  isvalid(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const tokens = await authService.login(req.body);
    return res.status(200).json({
      message: "user loggedin successfully",
      success: true,
      data: tokens,
    });
  },
);

router.post(
  "/google",
  authLimiter,
  isvalid(googleAuthSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await authService.googleAuth(req.body);
    return res.status(200).json({
      message: "user loggedin successfully",
      success: true,
      data: result,
    });
  },
);

router.patch(
  "/update",
  // isAuthenticated first: it only reads the Authorization header, so it
  // doesn't need multer to have parsed the body first. Was running last,
  // so an unauthenticated/invalid-token request still paid for multer
  // parsing the whole multipart body and a full Cloudinary upload before
  // ever being rejected - real bandwidth/storage/cost for zero valid
  // credentials required.
  isAuthenticated,
  multerUploadFile().single("avatar"),
  uploadAvatar("avatars"),
  isvalid(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const updatedUser = await authService.update(
      req.user._id,
      req.body,
      req.uploadedAvatarPublicId,
    );
    return res.status(200).json({
      message: "password updated successfully",
      success: true,
      date: { updatedUser },
    });
  },
);

router.post(
  "/logout",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.logout(req.user._id, "");
    return res.sendStatus(204);
  },
);

// Soft-delete: marks deletedAt and immediately hides the account (and
// everything it owns) everywhere - see softDelete()'s doc comment. Logging
// back in within 30 days reactivates it; the scheduled cleanup job hard-
// deletes it once the grace period passes.
router.delete(
  "/delete-account",
  isAuthenticated,
  async (req: Request, res: Response, next: NextFunction) => {
    await authService.softDelete(req.user._id);
    return res.sendStatus(204);
  },
);

export default router;
