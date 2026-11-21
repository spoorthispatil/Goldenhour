-- CreateEnum
CREATE TYPE "CampaignAudience" AS ENUM ('ALL', 'CITY', 'BLOOD_GROUP');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "patient"
  ADD COLUMN "email" VARCHAR(160),
  ADD COLUMN "city" VARCHAR(80),
  ADD COLUMN "blood_group" VARCHAR(3),
  ADD COLUMN "notify_email" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_sms" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_push" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "campaign"
  ADD COLUMN "audience" "CampaignAudience" NOT NULL DEFAULT 'ALL',
  ADD COLUMN "audience_value" VARCHAR(80),
  ADD COLUMN "channels" "NotificationChannel"[] NOT NULL DEFAULT ARRAY[]::"NotificationChannel"[];

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "patient_id" VARCHAR(20) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "destination" VARCHAR(160),
    "provider" VARCHAR(40) NOT NULL,
    "detail" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "push_subscription" (
    "subscription_id" TEXT NOT NULL,
    "patient_id" VARCHAR(20) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("subscription_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_campaign_id_patient_id_channel_key" ON "notification"("campaign_id", "patient_id", "channel");

-- CreateIndex
CREATE INDEX "notification_campaign_id_status_idx" ON "notification"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscription_patient_id_idx" ON "push_subscription"("patient_id");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("patient_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("patient_id") ON DELETE CASCADE ON UPDATE CASCADE;
