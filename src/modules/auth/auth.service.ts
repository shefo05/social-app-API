import { JwtPayload } from "jsonwebtoken";
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
} from "../../common";
import { generateTokens } from "../../common/utils/jwt.utils";
import { userRepo, UserRepository } from "../../DB/models/user/user.repository";
import {
  ForgotPasswordDTO,
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

  async signup(signupDTO: SignupDTO) {
    let { email, password, phoneNumber } = signupDTO;
    const userExist = await this._userRepo.getOne({ email });

    if (userExist) throw new ConflictException("user already exist !");
    signupDTO.password = await hash(password);

    if (phoneNumber) signupDTO.phoneNumber = encryption(phoneNumber);

    const otp = generateOTP();

    await this._mailProvider.send(
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

    await this._userRepo.create(JSON.parse(userData));

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
    await this._mailProvider.send(
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
    await this._mailProvider.send(
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
