-- Create users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `firstName` varchar(255) DEFAULT NULL,
  `lastName` varchar(255) DEFAULT NULL,
  `gender` enum('male','female','other','prefer_not_to_say') DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `countryCode` varchar(10) DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `role` enum('mentee','mentor') DEFAULT NULL,
  `isVerified` tinyint(1) NOT NULL DEFAULT 0,
  `isOnboardingComplete` tinyint(1) NOT NULL DEFAULT 0,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `accountStatus` enum('pending','active','suspended','deleted') NOT NULL DEFAULT 'pending',
  `currentStreak` int NOT NULL DEFAULT 0,
  `longestStreak` int NOT NULL DEFAULT 0,
  `lastStreakDate` date DEFAULT NULL,
  `weeklyStreakData` json DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_users_email` (`email`),
  KEY `IDX_users_role` (`role`),
  KEY `IDX_users_isVerified` (`isVerified`),
  KEY `IDX_users_isActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_refresh_tokens_token` (`token`),
  KEY `IDX_refresh_tokens_userId` (`userId`),
  KEY `IDX_refresh_tokens_expiresAt` (`expiresAt`),
  CONSTRAINT `FK_refresh_tokens_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create password_resets table
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_password_resets_token` (`token`),
  KEY `IDX_password_resets_userId` (`userId`),
  KEY `IDX_password_resets_expiresAt` (`expiresAt`),
  CONSTRAINT `FK_password_resets_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `resource` varchar(255) DEFAULT NULL,
  `resourceId` varchar(255) DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ipAddress` varchar(45) DEFAULT NULL,
  `userAgent` text DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_audit_logs_userId` (`userId`),
  KEY `IDX_audit_logs_action` (`action`),
  KEY `IDX_audit_logs_createdAt` (`createdAt`),
  CONSTRAINT `FK_audit_logs_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create system_configs table
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` varchar(36) NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `description` text DEFAULT NULL,
  `isEncrypted` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_system_configs_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create user_notifications table
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `type` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `data` json DEFAULT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT 0,
  `readAt` datetime DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_user_notifications_userId` (`userId`),
  KEY `IDX_user_notifications_type` (`type`),
  KEY `IDX_user_notifications_isRead` (`isRead`),
  KEY `IDX_user_notifications_createdAt` (`createdAt`),
  CONSTRAINT `FK_user_notifications_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create mentee_profiles table
CREATE TABLE IF NOT EXISTS `mentee_profiles` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `profileImage` varchar(500) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `goals` json DEFAULT NULL,
  `interests` json DEFAULT NULL,
  `learningStyle` varchar(100) DEFAULT NULL,
  `availability` json DEFAULT NULL,
  `preferredMentorGender` enum('male','female','no_preference') DEFAULT 'no_preference',
  `preferredMentorAgeRange` varchar(50) DEFAULT NULL,
  `preferredMentorExperience` varchar(100) DEFAULT NULL,
  `timezone` varchar(100) DEFAULT NULL,
  `language` varchar(10) DEFAULT 'en',
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_mentee_profiles_userId` (`userId`),
  CONSTRAINT `FK_mentee_profiles_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create mentor_profiles table
CREATE TABLE IF NOT EXISTS `mentor_profiles` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `profileImage` varchar(500) DEFAULT NULL,
  `videoIntroduction` varchar(500) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `specialties` json DEFAULT NULL,
  `experience` text DEFAULT NULL,
  `education` json DEFAULT NULL,
  `certifications` json DEFAULT NULL,
  `availability` json DEFAULT NULL,
  `hourlyRate` decimal(10,2) DEFAULT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `timezone` varchar(100) DEFAULT NULL,
  `language` varchar(10) DEFAULT 'en',
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `isApproved` tinyint(1) NOT NULL DEFAULT 0,
  `approvalNotes` text DEFAULT NULL,
  `approvedAt` datetime DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_mentor_profiles_userId` (`userId`),
  KEY `IDX_mentor_profiles_isApproved` (`isApproved`),
  CONSTRAINT `FK_mentor_profiles_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create sessions table
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` varchar(36) NOT NULL,
  `mentorId` varchar(36) NOT NULL,
  `menteeId` varchar(36) NOT NULL,
  `status` enum('scheduled','confirmed','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  `type` enum('one_on_one','group','video_call','phone_call','in_person') NOT NULL DEFAULT 'one_on_one',
  `duration` enum('30','60','90','120') NOT NULL DEFAULT '60',
  `scheduledAt` datetime NOT NULL,
  `startedAt` datetime DEFAULT NULL,
  `endedAt` datetime DEFAULT NULL,
  `title` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `meetingLink` text DEFAULT NULL,
  `meetingId` text DEFAULT NULL,
  `meetingPassword` text DEFAULT NULL,
  `location` text DEFAULT NULL,
  `mentorNotes` text DEFAULT NULL,
  `menteeNotes` text DEFAULT NULL,
  `sessionNotes` text DEFAULT NULL,
  `feedback` json DEFAULT NULL,
  `reminders` json DEFAULT NULL,
  `isRecurring` tinyint(1) NOT NULL DEFAULT 0,
  `recurringPattern` varchar(255) DEFAULT NULL,
  `parentSessionId` varchar(36) DEFAULT NULL,
  `cancelledAt` datetime DEFAULT NULL,
  `cancellationReason` text DEFAULT NULL,
  `menteeConfirmed` tinyint(1) NOT NULL DEFAULT 0,
  `mentorConfirmed` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_sessions_mentorId` (`mentorId`),
  KEY `IDX_sessions_menteeId` (`menteeId`),
  KEY `IDX_sessions_scheduledAt` (`scheduledAt`),
  KEY `IDX_sessions_status` (`status`),
  CONSTRAINT `FK_sessions_mentor` FOREIGN KEY (`mentorId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_sessions_mentee` FOREIGN KEY (`menteeId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create mentor_availability table
CREATE TABLE IF NOT EXISTS `mentor_availability` (
  `id` varchar(36) NOT NULL,
  `mentorId` varchar(36) NOT NULL,
  `dayOfWeek` enum('0','1','2','3','4','5','6') NOT NULL,
  `startTime` time NOT NULL,
  `endTime` time NOT NULL,
  `status` enum('available','unavailable','booked') NOT NULL DEFAULT 'available',
  `breaks` json DEFAULT NULL,
  `slotDuration` int NOT NULL DEFAULT 30,
  `timezone` text NOT NULL,
  `specificDate` date DEFAULT NULL,
  `isRecurring` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_mentor_availability_mentorId` (`mentorId`),
  KEY `IDX_mentor_availability_dayOfWeek` (`dayOfWeek`),
  KEY `IDX_mentor_availability_specificDate` (`specificDate`),
  CONSTRAINT `FK_mentor_availability_mentor` FOREIGN KEY (`mentorId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
