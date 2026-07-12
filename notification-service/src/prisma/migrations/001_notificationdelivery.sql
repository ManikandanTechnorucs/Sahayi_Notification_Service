-- Migration for the new notificationdelivery table.
-- Run only if this table does not already exist in the Sahayi database.

CREATE TABLE IF NOT EXISTS `notificationdelivery` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `NotificationLogId` INT NOT NULL,
  `UserDeviceTokenId` INT NOT NULL,
  `Status` ENUM('PENDING', 'SENT', 'FAILED', 'INVALID_TOKEN') NOT NULL DEFAULT 'PENDING',
  `RetryCount` INT NOT NULL DEFAULT 0,
  `LastAttemptAt` DATETIME(3) NULL,
  `ErrorMessage` TEXT NULL,
  `CreatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `UpdatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE INDEX `notificationdelivery_NotificationLogId_UserDeviceTokenId_key` (`NotificationLogId`, `UserDeviceTokenId`),
  INDEX `notificationdelivery_Status_idx` (`Status`),
  CONSTRAINT `notificationdelivery_NotificationLogId_fkey`
    FOREIGN KEY (`NotificationLogId`) REFERENCES `notificationlog` (`Id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `notificationdelivery_UserDeviceTokenId_fkey`
    FOREIGN KEY (`UserDeviceTokenId`) REFERENCES `userdevicetoken` (`Id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
