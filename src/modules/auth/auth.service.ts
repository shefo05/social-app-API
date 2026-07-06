import { JwtPayload } from "jsonwebtoken";
import { TokenPayload } from "google-auth-library";
import {
  BadRequestException,
  compare,
  ConflictException,
  encryption,
  generateOTP,
  hash,
  IUser,
  otpEmailTemplate,
  sendgridProvider,
  NotFoundException,
  UnauthorizedException,
  SYS_PROVIDER,
  SYS_ROLE,
  verifyGoogleIdToken,
} from "../../common";
import { generateTokens } from "../../common/utils/jwt.utils";
import { userRepo, UserRepository } from "../../DB/models/user/user.repository";
import {
  ForgotPasswordDTO,
  GoogleAuthDTO,
  LoginDTO,
  ResetPasswordConfirmDTO,
  ResetPasswordDTO,
  SendOtpDTO,
  SignupDTO,
  UpdateUserDTO,
  VerifyAccountDTO,
} from "./auth.dto";
import { QueryFilter } from "mongoose";
import { IMailProvider } from "../../common/email/mail.interface";
import { ICacheProvider } from "../../common/cache/cache.interface";
import { redisCacheProvider } from "../../common/cache/redis/init";
import { Types } from "mongoose";

const OTP_TTL_SECONDS = 3 * 60;

/**
 * Google's `name` can be missing, or longer than userName's 20-char
 * schema limit, or (very rarely) shorter than its 2-char minimum -
 * derive something that always satisfies both bounds rather than
 * letting an edge-case name crash user creation with a Mongoose
 * validation error.
 */
function deriveGoogleUserName(payload: TokenPayload): string {
  const fullName =
    payload.name?.trim() ||
    `${payload.given_name ?? ""} ${payload.family_name ?? ""}`.trim();
  const emailLocalPart = payload.email!.split("@")[0] ?? "user";
  let candidate = fullName.length >= 2 ? fullName : emailLocalPart;
  if (candidate.length < 2) candidate = `${candidate}User`;
  return candidate.slice(0, 20);
}

class AuthService {
  constructor(
    private _userRepo: UserRepository,
    private _mailProvider: IMailProvider,
    private _cacheProvider: ICacheProvider,
  ) {}

  /**
   * "Is this a valid, currently-active session?" - used by isAuthenticated,
   * the socket handshake middleware, and the GraphQL `user` query. Merging
   * deletedAt: null here (rather than at each call site) means a
   * soft-deleted account is rejected everywhere a session is checked, in
   * one place - the only way back in is login(), which reactivates.
   */
  async checkUserExist(filter: QueryFilter<IUser>) {
    return await this._userRepo.getOne({ ...filter, deletedAt: null });
  }

  /**
   * signup()/sendOTP()/forgotPassword() weren't wrapping the mail-provider
   * call at all - a SendGrid failure (bad key, rate limit, network blip)
   * bubbled up as a raw, un-normalized 500 with the provider's own
   * internal error message exposed to the client. Normalizes to a clean,
   * generic error instead.
   */
  private async sendMail(email: string, subject: string, html: string) {
    try {
      await this._mailProvider.send(email, subject, html);
    } catch (err) {
      console.log("mail provider send failed:", (err as Error).message);
      throw new BadRequestException("failed to send email, please try again");
    }
  }

  async signup(signupDTO: SignupDTO) {
    let { email, password, phoneNumber } = signupDTO;
    const userExist = await this._userRepo.getOne({ email });

    if (userExist) throw new ConflictException("user already exist !");
    signupDTO.password = await hash(password);

    if (phoneNumber) signupDTO.phoneNumber = encryption(phoneNumber);

    const otp = generateOTP();

    await this.sendMail(
      email,
      "Your verification code",
      otpEmailTemplate({ otp, expiryMinutes: OTP_TTL_SECONDS / 60 }),
    );

    // await setIntoCache(`${email}:otp`, otp, 3 * 60);
    await this._cacheProvider.set(`${email}:otp`, otp, OTP_TTL_SECONDS);

    // await setIntoCache(email, JSON.stringify(signupDTO), 3 * 24 * 60 * 60);
    await this._cacheProvider.set(
      email,
      JSON.stringify(signupDTO),
      3 * 24 * 60 * 60,
    );
  }

  async verifyAccount(verifyAccoutDTO: VerifyAccountDTO) {
    const { email } = verifyAccoutDTO;
    // const userData = await getFromCache(email);
    const userData = await this._cacheProvider.get(email);

    if (!userData) throw new NotFoundException("user not found !");

    // const otp = await getFromCache(`${email}:otp`);
    const otp = await this._cacheProvider.get(`${email}:otp`);

    if (!otp) throw new BadRequestException("expired otp!");

    if (otp != verifyAccoutDTO.otp)
      throw new BadRequestException("invalid otp!");

    try {
      await this._userRepo.create(JSON.parse(userData));
    } catch (err) {
      // signup()'s existence check is a check-then-write race, not a
      // real guarantee - two verifyAccount() calls for the same email
      // landing close together (double-submit, two tabs/devices) can
      // both pass that check and both reach create() here. The email
      // field's unique index is the actual backstop; this converts
      // Mongo's raw E11000 duplicate-key error into the same clean,
      // specific message signup()'s own check already uses, instead of
      // it falling through to the generic "something went wrong".
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException("user already exist !");
      }
      throw err;
    }

    // await deleteFromCache(`${email}:otp`);
    await this._cacheProvider.delete(`${email}:otp`);

    // await deleteFromCache(email);
    await this._cacheProvider.delete(email);
  }

  async sendOTP(sendOtpDTO: SendOtpDTO) {
    const { email } = sendOtpDTO;
    const userExistDB = await this._userRepo.getOne({ email });

    // const userExistCache = await getFromCache(email);
    const userExistCache = await this._cacheProvider.get(email);

    if (!userExistCache && !userExistDB)
      throw new NotFoundException("user not found");

    // const otpExist = await getFromCache(`${email}:otp`);
    const otpExist = await this._cacheProvider.get(`${email}:otp`);
    if (otpExist)
      throw new BadRequestException(
        `you already have a valid otp, wait ${OTP_TTL_SECONDS / 60} minutes`,
      );
    const otp = generateOTP();
    await this.sendMail(
      email,
      "Your verification code",
      otpEmailTemplate({ otp, expiryMinutes: OTP_TTL_SECONDS / 60 }),
    );
    // await setIntoCache(`${email}:otp`, otp, 3 * 60);
    await this._cacheProvider.set(`${email}:otp`, otp, OTP_TTL_SECONDS);
  }

  async resetPassword(resetPasswordDTO: ResetPasswordDTO, user: IUser) {
    const { newPassword } = resetPasswordDTO;
    const { email } = user;
    // const userExist = await this._userRepo.getOne({ email });

    // if (!userExist) throw new NotFoundException("user not found");

    // const otp = await getFromCache(`${email}:otp`);
    const otp = await this._cacheProvider.get(`${email}:otp`);

    if (otp != resetPasswordDTO.otp)
      throw new BadRequestException("invalid OTP");

    const password = await hash(newPassword);
    await this._userRepo.updateOne({ email }, { password });

    // await deleteFromCache(`${email}:otp`);
    await this._cacheProvider.delete(`${email}:otp`);
  }

  /**
   * Unauthenticated recovery path for a locked-out user - resetPassword()
   * above requires an already-valid session, which is exactly what
   * someone who forgot their password doesn't have.
   *
   * Uses a distinct `${email}:reset-otp` cache key rather than reusing
   * signup's `${email}:otp`. The two flows are mutually exclusive today
   * (signup only sets its key for emails with no existing user; this
   * only fires for emails that already have one), so reusing the key
   * would happen to be safe - but "happens to be safe because two other
   * methods' preconditions currently don't overlap" is exactly the kind
   * of implicit coupling that breaks silently if either flow changes
   * later. A separate key costs nothing and removes that dependency.
   */
  async forgotPassword(forgotPasswordDTO: ForgotPasswordDTO) {
    const { email } = forgotPasswordDTO;
    const userExist = await this._userRepo.getOne({ email });
    if (!userExist) throw new NotFoundException("user not found");

    const otpExist = await this._cacheProvider.get(`${email}:reset-otp`);
    if (otpExist)
      throw new BadRequestException(
        `you already have a valid otp, wait ${OTP_TTL_SECONDS / 60} minutes`,
      );

    const otp = generateOTP();
    await this.sendMail(
      email,
      "Reset your password",
      otpEmailTemplate({ otp, expiryMinutes: OTP_TTL_SECONDS / 60 }),
    );
    await this._cacheProvider.set(`${email}:reset-otp`, otp, OTP_TTL_SECONDS);
  }

  async resetPasswordConfirm(resetPasswordConfirmDTO: ResetPasswordConfirmDTO) {
    const { email, otp, newPassword } = resetPasswordConfirmDTO;
    const cachedOtp = await this._cacheProvider.get(`${email}:reset-otp`);

    if (cachedOtp != otp) throw new BadRequestException("invalid OTP");

    const password = await hash(newPassword);
    await this._userRepo.updateOne({ email }, { password });

    await this._cacheProvider.delete(`${email}:reset-otp`);
  }

  async login(loginDTO: LoginDTO) {
    const { email, password } = loginDTO;
    const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuv1234567890abcdef";

    // Deliberately *not* routed through checkUserExist() here - that helper
    // excludes soft-deleted accounts, but login is exactly the path that
    // must still find them (to verify the password) in order to reactivate
    // them. An account past its 30-day grace period has already been
    // hard-deleted by the cleanup job, so it's simply absent here and
    // falls through to the same generic "invalid credentials" as any
    // other unknown email - deliberately not distinguishing "wrong
        // password" from "this account no longer exists" to avoid leaking
    // account history.
    const userExist = await this._userRepo.getOne({ email }, "+password");

    const hash = userExist?.password ?? DUMMY_HASH;
    const matchPassword = await compare(password, hash);

    if (!matchPassword || !userExist)
      throw new BadRequestException("invalid credentials");

    // Reactivation: a successful login within the grace period clears the
    // soft-delete marker. Existing friendships/posts/comments were never
    // touched while deleted (only hidden from queries), so they reappear
    // immediately - no separate "restore" step needed.
    const reactivated = userExist.deletedAt != null;
    if (reactivated) {
      await this._userRepo.updateOne({ _id: userExist._id }, { deletedAt: null });
    }

    const payloadData: JwtPayload = {
      sub: userExist._id.toString(),
    };
    if (loginDTO.FCM) {
      await this._cacheProvider.addToSet(
        `${userExist._id.toString()}:FCM`,
        loginDTO.FCM,
      );
    }

    return { ...generateTokens(payloadData), reactivated };
  }

  /**
   * Frontend gets an ID token from Google Identity Services and sends it
   * here - nothing about Google's OAuth flow (redirects, auth codes,
   * client secret) touches the backend, only a signed JWT to verify.
   *
   * Deliberate choice: match purely by email and log in whatever account
   * is found, regardless of its `provider`. A password-based account
   * with the same (Google-verified) email is auto-linked rather than
   * rejected - rejecting would mean "sorry, log in with the password you
   * forgot you set," a worse and less secure outcome than trusting
   * Google's own email verification (checked below via email_verified).
   * `provider` therefore records "how this account was first created,"
   * not "the only way in" - an existing password stays untouched and
   * still works.
   */
  async googleAuth(googleAuthDTO: GoogleAuthDTO) {
    let payload: TokenPayload;
    try {
      payload = await verifyGoogleIdToken(googleAuthDTO.idToken);
    } catch {
      // google-auth-library throws a raw Error (malformed token, bad
      // signature, wrong audience, expired) with no `.cause` - same
      // problem isAuthenticated already normalizes for jwt.verify, so it
      // doesn't fall through to the global handler's 500 default.
      throw new UnauthorizedException("invalid or expired Google token");
    }
    if (!payload.email) throw new BadRequestException("invalid Google token");
    if (!payload.email_verified) {
      throw new UnauthorizedException("Google account email is not verified");
    }

    const { email } = payload;

    let user = await this._userRepo.getOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // No password field at all here - the schema only requires one
      // when provider != google (see user.model.ts). login()'s
      // "+password" fetch on a passwordless account comes back
      // undefined, falls back to the same DUMMY_HASH used for unknown
      // emails, and bcrypt.compare() just returns false - a clean
      // "invalid credentials" rather than a crash, with no extra code
      // needed here or in login().
      user = (await this._userRepo.create({
        userName: deriveGoogleUserName(payload),
        email,
        provider: SYS_PROVIDER.google,
        role: SYS_ROLE.user,
        // Google's own picture is more personalized than our generic
        // default - fall through to the schema default only if absent.
        ...(payload.picture ? { profilePic: payload.picture } : {}),
      })) as any;
    }

    // Same reactivation semantics as password login(): a soft-deleted
    // account signing back in via Google within the grace period is
    // still just as much "them" as one signing back in with a password.
    const reactivated = user!.deletedAt != null;
    if (reactivated) {
      await this._userRepo.updateOne({ _id: user!._id }, { deletedAt: null });
    }

    if (googleAuthDTO.FCM) {
      await this._cacheProvider.addToSet(`${user!._id.toString()}:FCM`, googleAuthDTO.FCM);
    }

    return {
      ...generateTokens({ sub: user!._id.toString() }),
      reactivated,
      isNewUser,
    };
  }

  /**
   *
   * @param userId >> from accessToken
   * @param fcm >> FE
   */
  async logout(userId: Types.ObjectId, fcm: string) {
    await this._cacheProvider.rmSet(`${userId.toString()}:FCM`, fcm);
  }

  async update(
    id: Types.ObjectId,
    updateUserDTO: UpdateUserDTO,
    avatarPublicId?: string,
  ) {
    const update = avatarPublicId
      ? { ...updateUserDTO, profilePicPublicId: avatarPublicId }
      : updateUserDTO;
    return await this._userRepo.updateOne({ _id: id }, update);
  }

  /**
   * Soft-delete: marks the account, doesn't touch it or anything it
   * owns. Posts/comments/friendships/requests are hidden from every
   * relevant query (see the deletedAt filters swept across post/comment/
   * request/user services) but not removed - if the user logs back in
   * within 30 days, login() clears deletedAt and everything reappears
   * exactly as it was. Only the scheduled cleanup job
   * (src/common/jobs/cleanup-deleted-accounts.job.ts) actually deletes
   * data, once the grace period has passed.
   */
  async softDelete(id: Types.ObjectId) {
    await this._userRepo.updateOne({ _id: id }, { deletedAt: new Date() });
  }
}

export default new AuthService(userRepo, sendgridProvider, redisCacheProvider);
