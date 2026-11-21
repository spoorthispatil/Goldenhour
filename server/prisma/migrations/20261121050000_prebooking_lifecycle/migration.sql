-- Pre-booking lifecycle: one-hour slots, patient cancellation requests, and
-- hospital admission/discharge tracking. Purely additive; existing rows keep
-- their nulls and their current status.
ALTER TYPE "PrebookingStatus" ADD VALUE IF NOT EXISTS 'CANCEL_REQUESTED';
ALTER TYPE "PrebookingStatus" ADD VALUE IF NOT EXISTS 'ADMITTED';
ALTER TYPE "PrebookingStatus" ADD VALUE IF NOT EXISTS 'DISCHARGED';

ALTER TABLE "prebooking" ADD COLUMN "slot_start" TIMESTAMP(3);
ALTER TABLE "prebooking" ADD COLUMN "slot_end" TIMESTAMP(3);
ALTER TABLE "prebooking" ADD COLUMN "admitted_at" TIMESTAMP(3);
ALTER TABLE "prebooking" ADD COLUMN "discharged_at" TIMESTAMP(3);
ALTER TABLE "prebooking" ADD COLUMN "cancellation_reason" VARCHAR(300);

CREATE INDEX "prebooking_hospital_id_slot_start_idx" ON "prebooking"("hospital_id", "slot_start");
