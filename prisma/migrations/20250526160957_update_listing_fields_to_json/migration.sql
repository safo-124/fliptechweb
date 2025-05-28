-- CreateTable
CREATE TABLE `ProductListing` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GHS',
    `images` JSON NOT NULL,
    `materials` JSON NOT NULL,
    `stockQuantity` INTEGER NULL,
    `dimensions` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NULL,
    `shippingDetails` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `artisanId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductListing_sku_key`(`sku`),
    INDEX `ProductListing_artisanId_idx`(`artisanId`),
    INDEX `ProductListing_categoryId_idx`(`categoryId`),
    INDEX `ProductListing_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceListing` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `priceType` ENUM('FIXED', 'PER_HOUR', 'PER_DAY', 'CONTACT_FOR_QUOTE', 'PROJECT_BASED') NOT NULL DEFAULT 'CONTACT_FOR_QUOTE',
    `price` DECIMAL(10, 2) NULL,
    `priceUnit` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GHS',
    `images` JSON NOT NULL,
    `locationType` ENUM('ON_SITE', 'ARTISAN_LOCATION', 'REMOTE_ONLINE') NOT NULL DEFAULT 'ARTISAN_LOCATION',
    `serviceArea` VARCHAR(191) NULL,
    `typicalDuration` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `artisanId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceListing_artisanId_idx`(`artisanId`),
    INDEX `ServiceListing_categoryId_idx`(`categoryId`),
    INDEX `ServiceListing_status_idx`(`status`),
    INDEX `ServiceListing_priceType_idx`(`priceType`),
    INDEX `ServiceListing_locationType_idx`(`locationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingOffer` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(10, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'GHS',
    `isFree` BOOLEAN NOT NULL DEFAULT false,
    `images` JSON NOT NULL,
    `duration` VARCHAR(191) NOT NULL,
    `scheduleDetails` TEXT NULL,
    `location` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NULL,
    `prerequisites` TEXT NULL,
    `whatYouWillLearn` JSON NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `artisanId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrainingOffer_artisanId_idx`(`artisanId`),
    INDEX `TrainingOffer_categoryId_idx`(`categoryId`),
    INDEX `TrainingOffer_status_idx`(`status`),
    INDEX `TrainingOffer_isFree_idx`(`isFree`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Category_type_idx` ON `Category`(`type`);

-- AddForeignKey
ALTER TABLE `ProductListing` ADD CONSTRAINT `ProductListing_artisanId_fkey` FOREIGN KEY (`artisanId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductListing` ADD CONSTRAINT `ProductListing_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceListing` ADD CONSTRAINT `ServiceListing_artisanId_fkey` FOREIGN KEY (`artisanId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceListing` ADD CONSTRAINT `ServiceListing_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingOffer` ADD CONSTRAINT `TrainingOffer_artisanId_fkey` FOREIGN KEY (`artisanId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingOffer` ADD CONSTRAINT `TrainingOffer_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `Category` RENAME INDEX `Category_parentId_fkey` TO `Category_parentId_idx`;
