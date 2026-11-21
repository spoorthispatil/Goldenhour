-- CreateEnum
CREATE TYPE "PrebookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('BLOOD_DONATION', 'ORGAN_DONATION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "patient_id" VARCHAR(20);

-- CreateTable
CREATE TABLE "prebooking" (
    "prebooking_id" TEXT NOT NULL,
    "patient_id" VARCHAR(20) NOT NULL,
    "hospital_id" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "status" "PrebookingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "prebooking_pkey" PRIMARY KEY ("prebooking_id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "campaign_id" TEXT NOT NULL,
    "hospital_id" VARCHAR(20),
    "created_by" VARCHAR(20) NOT NULL,
    "type" "CampaignType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "location" VARCHAR(160) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateTable
CREATE TABLE "campaign_read" (
    "campaign_id" TEXT NOT NULL,
    "patient_id" VARCHAR(20) NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_read_pkey" PRIMARY KEY ("campaign_id","patient_id")
);

-- CreateIndex
CREATE INDEX "prebooking_patient_id_created_at_idx" ON "prebooking"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "prebooking_hospital_id_status_idx" ON "prebooking"("hospital_id", "status");

-- CreateIndex
CREATE INDEX "campaign_starts_at_idx" ON "campaign"("starts_at");

-- CreateIndex
CREATE INDEX "campaign_type_starts_at_idx" ON "campaign"("type", "starts_at");

-- CreateIndex
CREATE INDEX "campaign_read_patient_id_idx" ON "campaign_read"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_patient_id_key" ON "users"("patient_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prebooking" ADD CONSTRAINT "prebooking_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prebooking" ADD CONSTRAINT "prebooking_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("hospital_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("hospital_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_read" ADD CONSTRAINT "campaign_read_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_read" ADD CONSTRAINT "campaign_read_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("patient_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The role linkage rule now has three cases. Hospital and dispatcher rules are
-- unchanged; a patient account must be linked to a patient record and no hospital.
ALTER TABLE "users" DROP CONSTRAINT "users_role_hospital_chk";
ALTER TABLE "users" ADD CONSTRAINT "users_role_hospital_chk" CHECK (
  ("role" = 'DISPATCHER' AND "hospital_id" IS NULL AND "patient_id" IS NULL)
  OR ("role" = 'HOSPITAL' AND "hospital_id" IS NOT NULL AND "patient_id" IS NULL)
  OR ("role" = 'PATIENT' AND "hospital_id" IS NULL AND "patient_id" IS NOT NULL)
);
