-- Add timezone and enhanced streak fields to users table
-- This script checks if columns exist before adding them

-- Add timezone field if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = "users";
SET @columnname = "timezone";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 'Column timezone already exists.' AS result;",
  CONCAT("ALTER TABLE `", @tablename, "` ADD `", @columnname, "` varchar(255) NOT NULL DEFAULT 'UTC';")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add streakFreezeCount field if it doesn't exist
SET @columnname = "streakFreezeCount";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 'Column streakFreezeCount already exists.' AS result;",
  CONCAT("ALTER TABLE `", @tablename, "` ADD `", @columnname, "` int NOT NULL DEFAULT 0;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add monthlyStreakData field if it doesn't exist
SET @columnname = "monthlyStreakData";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 'Column monthlyStreakData already exists.' AS result;",
  CONCAT("ALTER TABLE `", @tablename, "` ADD `", @columnname, "` json NULL;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

