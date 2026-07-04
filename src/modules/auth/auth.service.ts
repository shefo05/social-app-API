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
  LoginDTO,
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
import { postRepo, PostRepository } from "../../DB/models/post/post.repository";
import {
  commentRepo,
  CommentRepository,
} from "../../DB/models/comment/comment.repository";


const OTP_TTL_SECONDS = 3 * 60;

class AuthService {
  constructor(
    private _userRepo: UserRepository,
    private _postRepo: PostRepository,
    private _commentRepo: CommentRepository,
    private _mailProvider: IMailProvider,
    private _cacheProvider: ICacheProvider,
  ) {}

  async checkUserExist(filter: QueryFilter<IUser>) {
    return await this._userRepo.getOne(filter);
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

  async login(loginDTO: LoginDTO) {
    const { email, password } = loginDTO;
    const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuv1234567890abcdef";

    const userExist = await this._userRepo.getOne({ email });

    const hash = userExist?.password ?? DUMMY_HASH;
    const matchPassword = await compare(password, hash);

    if (!matchPassword || !userExist)
      throw new BadRequestException("invalid credentials");

    const payloadData: JwtPayload = {
      sub: userExist._id.toString(),
    };
    if (loginDTO.FCM) {
      await this._cacheProvider.addToSet(
        `${userExist._id.toString()}:FCM`,
        loginDTO.FCM,
      );
    }

    return generateTokens(payloadData);
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

  async delete(id: Types.ObjectId) {
    const userPosts = await this._postRepo.getAll({ userId: id }, { _id: 1 });
    const userPostIds = userPosts.map((post) => post._id);

    if (userPostIds.length > 0) {
      await this._commentRepo.deleteMany({ postId: { $in: userPostIds } });
    }

    await this._commentRepo.deleteMany({ userId: id });
    await this._postRepo.deleteMany({ userId: id });

    return await this._userRepo.deleteOne({ _id: id });
  }

 
}

export default new AuthService(
  userRepo,
  postRepo,
  commentRepo,
  sendgridProvider,
  redisCacheProvider,
);
