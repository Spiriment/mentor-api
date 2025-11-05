-- Add streak tracking columns to users table
ALTER TABLE `users` 
ADD COLUMN `currentStreak` int NOT NULL DEFAULT 0,
ADD COLUMN `longestStreak` int NOT NULL DEFAULT 0,
ADD COLUMN `lastStreakDate` date NULL,
ADD COLUMN `weeklyStreakData` json NULL;