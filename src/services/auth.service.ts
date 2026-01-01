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
  GoogleSignInDTO,
} from '../validation/auth.validation';
import { EmailService } from '@/core/email.service';
import { RoleEnum } from '@/common/auth/rbac';
import { User, PasswordReset, RefreshToken } from '@/database/entities';
import { UserRepository } from '@/repository/user.repository';
import { generateOTP } from '@/common/helpers/auth';
import { FileUploadService } from '@/core/fileUpload.service';
import { StatusCodes } from 'http-status-codes';
import { OAuth2Client } from 'google-auth-library';

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
      User.otpToken!,
      false
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
        firstName: User.firstName || '',
        lastName: User.lastName || '',
        role: User.role || '',
        isVerified: User.isEmailVerified || false,
        isOnboardingComplete: User.isOnboardingComplete || false,
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
        firstName: true,
        isEmailVerified: true,
        otpToken: true,
        otpTokenExpiry: true,
      },
    });

    const verificationToken = this.generateEmailVerificationToken();
    const tokenExpiry = addMinutes(new Date(), 10);

    // If user exists and is verified, treat this as a login request
    if (existingUser && existingUser.isEmailVerified) {
      // Generate and send OTP for login
      await this.UserRepository.update(existingUser.id, {
        otpToken: verificationToken,
        otpTokenExpiry: tokenExpiry,
      });

      // Send OTP email for login (non-blocking - don't await)
      this.emailService.sendEmailVerificationEmail(
        data.email,
        existingUser.firstName || 'User',
        verificationToken,
        false
      ).then(() => {
      this.logger.info('Login OTP sent to existing user', { email: data.email });
      }).catch((emailError: any) => {
        // Log email error but don't fail login - user can request OTP again
        const errorObj = emailError instanceof Error ? emailError : new Error(String(emailError));
        this.logger.error('Failed to send login OTP email', errorObj, {
          email: data.email,
          errorCode: emailError.code,
        });
      });

      return {
        message: 'Verification code sent to your email',
        isExistingUser: true,
        isEmailVerified: true,
      };
    }

    // New user or unverified user - registration flow
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
        timezone: 'UTC', // Explicitly set timezone to avoid database issues
      });

      await this.UserRepository.save(User);
    }

    // Send OTP email for registration (non-blocking - don't await)
    // This allows the API to respond immediately while email is sent in background
    this.emailService.sendEmailVerificationEmail(
      data.email,
      existingUser?.firstName || 'User',
      verificationToken,
      false
    ).then(() => {
    this.logger.info('Registration OTP sent successfully', { email: data.email });
    }).catch((emailError: any) => {
      // Log email error but don't fail registration - user can request OTP again
      const errorObj = emailError instanceof Error ? emailError : new Error(String(emailError));
      this.logger.error('Failed to send registration OTP email', errorObj, {
        email: data.email,
        errorCode: emailError.code,
      });
    });

    return {
      message: 'Verification code sent to your email',
      isExistingUser: false,
      isEmailVerified: false,
    };
  };

  verifyOtp = async (data: VerifyOtpDTO): Promise<any> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isEmailVerified: true,
        isOnboardingComplete: true,
        otpToken: true,
        otpTokenExpiry: true,
        emailVerifiedAt: true,
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

    const isExistingVerifiedUser = User.isEmailVerified;

    // If user is already verified, this is a login - just clear OTP
    // If user is not verified, this is registration - mark as verified
    if (isExistingVerifiedUser) {
      // Login flow - just clear OTP
      await this.UserRepository.update(User.id, {
        otpToken: null as any,
        otpTokenExpiry: null as any,
      });
      this.logger.info('Login OTP verified successfully', { email: data.email });
    } else {
      // Registration flow - mark email as verified and clear OTP
      await this.UserRepository.update(User.id, {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        otpToken: null as any,
        otpTokenExpiry: null as any,
      });
      this.logger.info('Registration OTP verified successfully', { email: data.email });
    }

    // Check profile table for onboarding completion status (in case User table is not updated)
    let isOnboardingComplete = User.isOnboardingComplete || false;
    if (User.role && !isOnboardingComplete) {
      try {
        if (User.role === 'mentee') {
          const MenteeProfile = await this.UserRepository.manager.getRepository('MenteeProfile').findOne({
            where: { userId: User.id },
            select: ['isOnboardingComplete'],
          });
          if (MenteeProfile?.isOnboardingComplete) {
            isOnboardingComplete = true;
            // Update User table to sync
            await this.UserRepository.update(User.id, { isOnboardingComplete: true });
          }
        } else if (User.role === 'mentor') {
          const MentorProfile = await this.UserRepository.manager.getRepository('MentorProfile').findOne({
            where: { userId: User.id },
            select: ['isOnboardingComplete'],
          });
          if (MentorProfile?.isOnboardingComplete) {
            isOnboardingComplete = true;
            // Update User table to sync
            await this.UserRepository.update(User.id, { isOnboardingComplete: true });
          }
        }
      } catch (profileError) {
        this.logger.warn('Error checking profile onboarding status', { error: profileError });
        // Continue with User table value if profile check fails
      }
    }

    // Generate and return tokens
    const tokens = this.generateTokens(User);
    
    // Return user data for existing users (login flow) so frontend knows role and onboarding status
    const response: any = {
      ...tokens,
      message: isExistingVerifiedUser 
        ? 'Login successful' 
        : 'Email verified successfully',
      isExistingUser: isExistingVerifiedUser,
    };
    
    // Include user data if user exists, so frontend knows role and onboarding status
    if (User) {
      response.user = {
        id: User.id,
        email: User.email,
        firstName: User.firstName || '',
        lastName: User.lastName || '',
        role: User.role || '',
        isVerified: User.isEmailVerified || false,
        isOnboardingComplete: isOnboardingComplete,
        mentorApprovalStatus: User.mentorApprovalStatus,
      };
    }
    
    return response;
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

    // Update user role - do NOT mark onboarding as complete yet
    // Onboarding will be marked complete after role-specific onboarding is finished
    await this.UserRepository.update(User.id, {
      role: data.role,
      isOnboardingComplete: false, // Keep false until role-specific onboarding is complete
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

  /**
   * Send login OTP
   * Checks if user exists, then sends OTP for login
   */
  sendLoginOtp = async (data: { email: string }): Promise<any> => {
    // Check if user exists
    const existingUser = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isEmailVerified: true,
        otpToken: true,
        otpTokenExpiry: true,
      },
    });

    if (!existingUser) {
      throw new AppError(
        'No account found with this email address. Please sign up first.',
        StatusCodes.NOT_FOUND
      );
    }

    if (!existingUser.isActive) {
      throw new AppError('Account is inactive', StatusCodes.FORBIDDEN);
    }

    if (!existingUser.isEmailVerified) {
      throw new AppError(
        'Email not verified. Please verify your email first.',
        StatusCodes.BAD_REQUEST
      );
    }

    // Generate OTP
    const verificationToken = this.generateEmailVerificationToken();
    const tokenExpiry = addMinutes(new Date(), 10);

    // Save OTP to user
    await this.UserRepository.update(existingUser.id, {
      otpToken: verificationToken,
      otpTokenExpiry: tokenExpiry,
    });

    // Send OTP email (with isLogin = true)
    await this.emailService.sendEmailVerificationEmail(
      data.email,
      existingUser.firstName || 'User',
      verificationToken,
      true // isLogin = true
    );

    this.logger.info('Login OTP sent successfully', { email: data.email });

    return {
      success: true,
      message: 'Verification code sent to your email. Please check your inbox.',
    };
  };

  /**
   * Verify login OTP and return tokens
   */
  verifyLoginOtp = async (data: {
    email: string;
    otp: string;
  }): Promise<TokenResponse> => {
    const User = await this.UserRepository.findOne({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        isOnboardingComplete: true,
        otpToken: true,
        otpTokenExpiry: true,
      },
    });

    if (!User) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND);
    }

    if (!User.isActive) {
      throw new AppError('Account is inactive', StatusCodes.FORBIDDEN);
    }

    if (!User.isEmailVerified) {
      throw new AppError('Email not verified', StatusCodes.BAD_REQUEST);
    }

    // Verify OTP
    if (!User.otpToken || !User.otpTokenExpiry) {
      throw new AppError(
        'No verification code found. Please request a new code.',
        StatusCodes.BAD_REQUEST
      );
    }

    if (User.otpTokenExpiry < new Date()) {
      throw new AppError(
        'Verification code has expired. Please request a new code.',
        StatusCodes.BAD_REQUEST
      );
    }

    if (User.otpToken !== data.otp) {
      throw new AppError('Invalid verification code', StatusCodes.UNAUTHORIZED);
    }

    // Clear OTP after successful verification
    await this.UserRepository.update(User.id, {
      otpToken: null as any,
      otpTokenExpiry: null as any,
    });

    this.logger.info('Login OTP verified successfully', { email: data.email });

    // Generate tokens
    const tokens = this.generateTokens(User);

    return {
      ...tokens,
      user: {
        id: User.id,
        email: User.email,
        firstName: User.firstName || '',
        lastName: User.lastName || '',
        role: User.role || '',
        isVerified: User.isEmailVerified || false,
        isOnboardingComplete: User.isOnboardingComplete || false,
      },
      token: tokens.accessToken,
    };
  };

  googleSignIn = async (data: GoogleSignInDTO): Promise<TokenResponse> => {
    try {
      // Initialize Google OAuth client
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        this.logger.error('GOOGLE_CLIENT_ID is not configured');
        throw new AppError('Google authentication is not configured', 500);
      }

      const client = new OAuth2Client(clientId);

      // Verify the ID token
      const ticket = await client.verifyIdToken({
        idToken: data.idToken,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new AppError('Invalid Google token', 401);
      }

      // Extract user information from Google payload
      const googleId = payload.sub;
      const email = payload.email;
      const emailVerified = payload.email_verified || false;
      const firstName = payload.given_name || '';
      const lastName = payload.family_name || '';
      const profilePicture = payload.picture || null;

      if (!email) {
        throw new AppError('Email not provided by Google', 400);
      }

      // Check if user exists by email
      // Note: If you add googleId field to User entity, you can search by it too
      let user = await this.UserRepository.findOne({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isOnboardingComplete: true,
          password: true,
        },
      });

      if (user) {
        // User exists - update fields if needed
        const updateData: any = {};

        // Mark email as verified if Google says it's verified
        if (emailVerified && !user.isEmailVerified) {
          updateData.isEmailVerified = true;
        }

        // Update name if not set
        if (!user.firstName && firstName) {
          updateData.firstName = firstName;
        }
        if (!user.lastName && lastName) {
          updateData.lastName = lastName;
        }

        if (Object.keys(updateData).length > 0) {
          await this.UserRepository.update(user.id, updateData);
        }

        if (!user.isActive) {
          throw new AppError('Account is inactive', 401);
        }
      } else {
        // Create new user
        const newUser = this.UserRepository.create({
          email,
          firstName,
          lastName,
          isEmailVerified: emailVerified,
          isActive: true,
          // Set a random password (user won't use it, but field is required)
          password: await bcrypt.hash(
            `google_${googleId}_${Date.now()}`,
            10
          ),
        });

        user = await this.UserRepository.save(newUser);
        this.logger.info('New user created via Google Sign-In', {
          userId: user.id,
          email: user.email,
        });
      }

      // Generate JWT tokens
      const tokens = this.generateTokens(user);

      // Fetch full user data for response
      const fullUser = await this.UserRepository.findOne({
        where: { id: user.id },
      });

      if (!fullUser) {
        throw new AppError(
          'User not found after creation/update',
          StatusCodes.INTERNAL_SERVER_ERROR
        );
      }

      return {
        ...tokens,
        user: {
          id: fullUser.id,
          email: fullUser.email,
          firstName: fullUser.firstName || '',
          lastName: fullUser.lastName || '',
          role: fullUser.role || '',
          isVerified: fullUser.isEmailVerified || false,
          isOnboardingComplete: fullUser.isOnboardingComplete || false,
        },
        isEmailVerified: user.isEmailVerified,
        accountStatus: user.accountStatus,
      };
    } catch (error: any) {
      this.logger.error('Google Sign-In error', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        error.message || 'Google authentication failed',
        401
      );
    }
  };
}
