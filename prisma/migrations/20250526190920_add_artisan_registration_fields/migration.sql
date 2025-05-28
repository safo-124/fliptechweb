/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nationalId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `nationalId` VARCHAR(191) NULL,
    ADD COLUMN `phoneNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_phoneNumber_key` ON `User`(`phoneNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `User_nationalId_key` ON `User`(`nationalId`);
