-- CreateTable
CREATE TABLE `ProfileView` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `viewerId` INTEGER NOT NULL,
    `profileOwnerId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProfileView_viewerId_idx`(`viewerId`),
    INDEX `ProfileView_profileOwnerId_idx`(`profileOwnerId`),
    INDEX `ProfileView_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostView` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `viewerId` INTEGER NOT NULL,
    `duration` INTEGER NULL,
    `audioPlaytime` INTEGER NULL,
    `audioStartCount` INTEGER NULL,
    `clickType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostView_postId_idx`(`postId`),
    INDEX `PostView_viewerId_idx`(`viewerId`),
    INDEX `PostView_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EngagementMetrics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `totalProfileViews` INTEGER NOT NULL DEFAULT 0,
    `uniqueProfileViews` INTEGER NOT NULL DEFAULT 0,
    `totalPostViews` INTEGER NOT NULL DEFAULT 0,
    `uniquePostViews` INTEGER NOT NULL DEFAULT 0,
    `avgPlaytime` DOUBLE NOT NULL DEFAULT 0,
    `clickThroughRate` DOUBLE NOT NULL DEFAULT 0,
    `conversionRate` DOUBLE NOT NULL DEFAULT 0,
    `lastUpdated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EngagementMetrics_userId_key`(`userId`),
    INDEX `EngagementMetrics_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProfileView` ADD CONSTRAINT `ProfileView_viewerId_fkey` FOREIGN KEY (`viewerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileView` ADD CONSTRAINT `ProfileView_profileOwnerId_fkey` FOREIGN KEY (`profileOwnerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostView` ADD CONSTRAINT `PostView_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostView` ADD CONSTRAINT `PostView_viewerId_fkey` FOREIGN KEY (`viewerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EngagementMetrics` ADD CONSTRAINT `EngagementMetrics_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
