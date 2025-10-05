import {
  AppError,
  AuthenticatedRequest,
  Logger,
  RedisClient,
  TokenResponse,
  EncryptionServiceImpl,
  JwtService,
  AppDataSource,
  Config,
  UserPayload,
} from '@/common';
import bcrypt from 'bcryptjs';
import { addMinutes } from 'date-fns';
import {
  RegisterDTO,
  LoginDTO,
  SendVerificationDTO,
  VerifyEmailDTO,
  UpdateBasicInfoDTO,
  UpdateAddressDTO,
  UpdateSettingsDTO,
  UpdateAvatarDTO,
  ResetPasswordDTO,
  EmailRegistrationDTO,
  VerifyOtpDTO,
  UpdateProfileDTO,
  SelectRoleDTO,
} from '../validation/auth.validation';
import { EmailService } from '@/core/email.service';
import { RoleEnum } from '@/common/auth/rbac';
import { User, PasswordReset, RefreshToken } from '@/database/entities';
import { UserRepository } from '@/repository/user.repository';
import { generateOTP } from '@/common/helpers/auth';
import { FileUploadService } from '@/core/fileUpload.service';

export class AuthService {
  private logger: Logger;
  private jwt: JwtService;
  private encryptService: EncryptionServiceImpl;
  private emailService: EmailService;
  private redis: RedisClient | null;
  private UserRepository: UserRepository;
  private fileUploadService: FileUploadService;

  constructor(
    jwt: JwtService,
    encryptService: EncryptionServiceImpl,
    emailService: EmailService,
    redis: RedisClient | null,
    UserRepository: UserRepository
  ) {
    this.jwt = jwt;
    this.encryptService = encryptService;
    this.emailService = emailService;
    this.logger = new Logger({
      level: process.env.LOG_LEVEL as any,
      service: 'auth-service',
    });
    this.UserRepository = UserRepository;
    this.fileUploadService = new FileUploadService();
  }

  private generateTokens(User: User): TokenResponse {
    const payload: UserPayload = {
      userId: User.id,
      email: User.email,
      accountStatus: User.accountStatus as any,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload);

    return { accessToken, refreshToken };
  }

  private generateEmailVerificationToken(): string {
    return generateOTP(6).toString();
  }

  register = async (data: RegisterDTO): Promise<any> => {
    const existingUser = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        password: true,
        isEmailVerified: true,
      },
    });

    if (existingUser) {
      if (existingUser.isEmailVerified) {
        throw new AppError('Email already registered and verified', 409);
      } else {
        await this.sendVerificationEmail(data.email, 'User');
        return {
          message:
            'Verification email sent. Please check your email to complete registration.',
        };
      }
    }

    const passwordHash = await this.encryptService.hash(data.password);
    const verificationToken = this.generateEmailVerificationToken();
    const tokenExpiry = addMinutes(new Date(), 10);

    const User = this.UserRepository.create({
      email: data.email,
      password: passwordHash,
      otpToken: verificationToken,
      otpTokenExpiry: tokenExpiry,
    });

    const savedUser = await this.UserRepository.save(User);

    await this.UserRepository.save(savedUser);

    await this.sendVerificationEmail(data.email, 'User');

    this.logger.info('User registered successfully, verification email sent', {
      email: data.email,
    });

    const tokens = this.generateTokens(User);
    return {
      ...tokens,
      accountStatus: savedUser.accountStatus,
    };
  };

  private async sendVerificationEmail(
    email: string,
    firstName: string
  ): Promise<void> {
    const User = await this.UserRepository.findOne({
      where: { email },
      select: {
        id: true,
        otpToken: true,
        otpTokenExpiry: true,
      },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    if (
      !User.otpToken ||
      !User.otpTokenExpiry ||
      User.otpTokenExpiry < new Date()
    ) {
      const verificationToken = this.generateEmailVerificationToken();
      const tokenExpiry = addMinutes(new Date(), 10);

      await this.UserRepository.update(User.id, {
        otpToken: verificationToken,
        otpTokenExpiry: tokenExpiry,
      });

      User.otpToken = verificationToken;
    }

    await this.emailService.sendEmailVerificationEmail(
      email,
      firstName,
      User.otpToken!
    );

    this.logger.info('Verification email sent', { email });
  }

  resendVerificationEmail = async (
    data: SendVerificationDTO
  ): Promise<void> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        firstName: true,
        isEmailVerified: true,
      },
    });

    if (!User) {
      this.logger.warn('Resend verification attempt for non-existent email', {
        email: data.email,
      });
      return;
    }

    if (User.isEmailVerified) {
      this.logger.warn(
        'Resend verification attempt for already verified email',
        {
          email: data.email,
        }
      );
      throw new AppError('Email already verified', 400);
    }

    await this.sendVerificationEmail(data.email, User.firstName || '');
  };

  verifyEmail = async (data: VerifyEmailDTO): Promise<TokenResponse> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        otpToken: true,
        otpTokenExpiry: true,
        isEmailVerified: true,
      },
    });

    if (!User) {
      throw new AppError('Invalid verification request', 400);
    }

    if (User.isEmailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    if (!User.otpToken || !User.otpTokenExpiry) {
      throw new AppError('No verification token found', 400);
    }

    if (User.otpTokenExpiry < new Date()) {
      throw new AppError('Verification token has expired', 400);
    }

    if (User.otpToken !== data.token) {
      throw new AppError('Invalid verification token', 400);
    }

    await this.UserRepository.update(User.id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    await this.UserRepository.update(User.id, {
      otpToken: null as any,
      otpTokenExpiry: null as any,
    });

    this.logger.info('Email verified successfully', { email: data.email });

    const tokens = this.generateTokens(User);
    return {
      ...tokens,
      isEmailVerified: User.isEmailVerified,
      accountStatus: User.accountStatus,
    };
  };

  login = async (data: LoginDTO): Promise<TokenResponse> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        password: true,
        isActive: true,
        isEmailVerified: true,
        isOnboardingComplete: true,
        otpToken: true,
        otpTokenExpiry: true,
      },
    });

    if (!User) {
      this.logger.warn('Login attempt with non-existent email', {
        email: data.email,
      });
      throw new AppError('Invalid email or password', 401);
    }

    if (!User.isActive) {
      this.logger.warn('Login attempt for inactive User', {
        email: data.email,
      });
      throw new AppError('Account is inactive', 401);
    }

    const isValidPassword = await bcrypt.compare(
      data.password,
      User.password || ''
    );

    if (!isValidPassword) {
      this.logger.warn('Login attempt with invalid password', {
        email: data.email,
      });
      throw new AppError('Invalid email or password', 401);
    }

    if (!User.isEmailVerified) {
      this.logger.warn('Login attempt for unverified email', {
        email: data.email,
      });

      if (User.otpToken) {
        if (User.otpTokenExpiry && User.otpTokenExpiry < new Date()) {
          await this.sendVerificationEmail(data.email, User.firstName || '');
        } else {
          throw new AppError(
            'Please verify your email before logging in, Verification token has been sent to your email',
            401
          );
        }
      } else {
        await this.sendVerificationEmail(data.email, User.firstName || '');
        throw new AppError(
          'Please verify your email before logging in, Verification token has been sent to your email',
          401
        );
      }
    }

    this.logger.info('User logged in successfully', {
      email: data.email,
    });
    const tokens = this.generateTokens(User);
    return {
      ...tokens,
      user: {
        id: User.id,
        email: User.email,
        firstName: User.firstName,
        lastName: User.lastName,
        role: User.role,
        isVerified: User.isEmailVerified,
        isOnboardingComplete: User.isOnboardingComplete,
      },
      token: tokens.accessToken, // Add token alias for frontend compatibility
    };
  };

  updateBasicInfo = async (userId: string, data: UpdateBasicInfoDTO) => {
    const User = await this.UserRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    const updateData: Partial<User> = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.middleName !== undefined) updateData.middleName = data.middleName;

    if (data.gender !== undefined) updateData.gender = data.gender;

    await this.UserRepository.update(userId, updateData);

    this.logger.info('User basic info updated', {
      userId,
      updatedFields: Object.keys(updateData),
    });

    return {
      message: 'Basic information updated successfully',
    };
  };

  updateAddress = async (userId: string, data: UpdateAddressDTO) => {
    const User = await this.UserRepository.findOne({
      where: { id: userId },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    const updateData: Partial<User> = {};

    if (data.address !== undefined) updateData.address = data.address;

    await this.UserRepository.update(userId, updateData);

    this.logger.info('User address updated', {
      userId,
      updatedFields: Object.keys(updateData),
    });

    return { message: 'Address updated successfully' };
  };

  getProfile = async (userId: string) => {
    const User = await this.UserRepository.findOne({
      where: { id: userId },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    return User;
  };

  refreshToken = async (refreshToken: string): Promise<TokenResponse> => {
    const decoded = this.jwt.verify<UserPayload>(refreshToken);

    const User = await this.UserRepository.findOne({
      where: { id: decoded.userId },
    });

    if (!User) {
      this.logger.warn('Token refresh attempt for non-existent User', {
        userId: decoded.userId,
      });
      throw new AppError('User not found', 401);
    }

    if (!User.isActive) {
      this.logger.warn('Token refresh attempt for inactive User', {
        userId: decoded.userId,
      });
      throw new AppError('Account is inactive', 401);
    }

    this.logger.info('Token refreshed successfully', { email: User.email });
    return this.generateTokens(User);
  };

  logout = async (refreshToken: string): Promise<void> => {
    const decoded = this.jwt.verify<UserPayload>(refreshToken);

    const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
    await refreshTokenRepository.delete({
      userId: decoded.userId,
      token: refreshToken,
    });

    this.logger.info('User logged out successfully', {
      userId: decoded.userId,
    });
  };

  forgotPassword = async (email: string): Promise<void> => {
    const User = await this.UserRepository.findOne({
      where: { email },
    });

    if (!User) {
      this.logger.warn('Forgot password attempt for non-existent email', {
        email,
      });
      return;
    }

    const token = generateOTP().toString();
    const expiresAt = addMinutes(new Date(), 15);

    const passwordResetRepository = AppDataSource.getRepository(PasswordReset);
    const passwordReset = passwordResetRepository.create({
      token,
      userId: User.id,
      expiresAt,
    });

    await passwordResetRepository.save(passwordReset);
    await this.emailService.sendPasswordResetEmail(
      email,
      User.firstName || '',
      token
    );

    this.logger.info('Password reset email sent', { email, token });
  };

  resetPassword = async ({
    token,
    password,
    email,
  }: ResetPasswordDTO): Promise<void> => {
    const passwordResetRepository = AppDataSource.getRepository(PasswordReset);

    const User = await this.UserRepository.findOne({
      where: { email },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    const passwordReset = await passwordResetRepository.findOne({
      where: { token, used: false, userId: User.id },
    });

    if (!passwordReset) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    if (passwordReset.expiresAt < new Date()) {
      throw new AppError('Reset token has expired', 400);
    }

    const passwordHash = await this.encryptService.hash(password);

    await this.UserRepository.update(passwordReset.userId, {
      password: passwordHash,
    });
    await passwordResetRepository.update(passwordReset.id, { used: true });

    this.logger.info('Password reset successful', {
      userId: passwordReset.userId,
    });
  };

  verifyResetOtp = async ({
    token,
    email,
  }: ResetPasswordDTO): Promise<string> => {
    const passwordResetRepository = AppDataSource.getRepository(PasswordReset);

    const User = await this.UserRepository.findOne({
      where: { email },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    const passwordReset = await passwordResetRepository.findOne({
      where: { token, used: false, userId: User.id },
    });

    if (!passwordReset) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    return 'Password reset token is valid';
  };

  // Mentor App specific methods
  emailRegistration = async (data: EmailRegistrationDTO): Promise<any> => {
    const existingUser = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        otpToken: true,
        otpTokenExpiry: true,
      },
    });

    if (existingUser && existingUser.isEmailVerified) {
      throw new AppError('Email already registered and verified', 409);
    }

    const verificationToken = this.generateEmailVerificationToken();
    const tokenExpiry = addMinutes(new Date(), 10);

    if (existingUser && !existingUser.isEmailVerified) {
      // Update existing user with new OTP
      await this.UserRepository.update(existingUser.id, {
        otpToken: verificationToken,
        otpTokenExpiry: tokenExpiry,
      });
    } else {
      // Create new user
      const User = this.UserRepository.create({
        email: data.email,
        otpToken: verificationToken,
        otpTokenExpiry: tokenExpiry,
        isEmailVerified: false,
      });

      await this.UserRepository.save(User);
    }

    // Send OTP email
    await this.emailService.sendEmailVerificationEmail(
      data.email,
      'User',
      verificationToken
    );

    this.logger.info('OTP sent successfully', { email: data.email });

    return {
      message: 'Verification code sent to your email',
    };
  };

  verifyOtp = async (data: VerifyOtpDTO): Promise<any> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        otpToken: true,
        otpTokenExpiry: true,
        isEmailVerified: true,
      },
    });

    if (!User) {
      throw new AppError('Invalid verification request', 400);
    }

    if (!User.otpToken || !User.otpTokenExpiry) {
      throw new AppError('No verification token found', 400);
    }

    if (User.otpTokenExpiry < new Date()) {
      throw new AppError('Verification token has expired', 400);
    }

    if (User.otpToken !== data.otp.toString()) {
      throw new AppError('Invalid verification code', 400);
    }

    // Mark email as verified and clear OTP
    await this.UserRepository.update(User.id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      otpToken: null as any,
      otpTokenExpiry: null as any,
    });

    this.logger.info('OTP verified successfully', { email: data.email });

    // Generate and return tokens
    const tokens = this.generateTokens(User);
    return {
      ...tokens,
      message: 'Email verified successfully',
    };
  };

  updateUserProfile = async (data: UpdateProfileDTO): Promise<any> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
      },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    if (!User.isEmailVerified) {
      throw new AppError('Email not verified', 400);
    }

    // Parse birthday string to Date
    const birthday = new Date(data.birthday);

    await this.UserRepository.update(User.id, {
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      country: data.country,
      countryCode: data.countryCode,
      birthday: birthday,
    });

    this.logger.info('User profile updated', { email: data.email });

    return {
      message: 'Profile updated successfully',
    };
  };

  selectRole = async (data: SelectRoleDTO): Promise<any> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!User) {
      throw new AppError('User not found', 404);
    }

    if (!User.isEmailVerified) {
      throw new AppError('Email not verified', 400);
    }

    // Update user role and mark onboarding as complete
    await this.UserRepository.update(User.id, {
      role: data.role,
      isOnboardingComplete: true,
    });

    // Get updated user for token generation
    const updatedUser = await this.UserRepository.findOne({
      where: { id: User.id },
    });

    if (!updatedUser) {
      throw new AppError('User not found after update', 500);
    }

    this.logger.info('Role selected successfully', {
      email: data.email,
      role: data.role,
    });

    const tokens = this.generateTokens(updatedUser);
    return {
      ...tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isVerified: updatedUser.isEmailVerified,
        isOnboardingComplete: updatedUser.isOnboardingComplete,
      },
    };
  };
}
