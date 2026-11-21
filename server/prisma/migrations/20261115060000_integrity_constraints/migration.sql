-- GoldenHour - integrity constraints that Prisma's schema language
-- cannot express. Column names are quoted because Prisma maps them to snake_case.

-- ---------------------------------------------------------------- USERS
-- A dispatcher must not be attached to a hospital; hospital staff must be.
ALTER TABLE "users"
  ADD CONSTRAINT "users_role_hospital_chk" CHECK (
    ("role" = 'DISPATCHER' AND "hospital_id" IS NULL)
    OR ("role" = 'HOSPITAL' AND "hospital_id" IS NOT NULL)
  );

ALTER TABLE "users"
  ADD CONSTRAINT "users_username_chk" CHECK (length(btrim("username")) >= 3);

-- ---------------------------------------------------------------- PATIENT
ALTER TABLE "patient"
  ADD CONSTRAINT "patient_contact_chk" CHECK ("contact" ~ '^[0-9]{10}$');

ALTER TABLE "patient"
  ADD CONSTRAINT "patient_age_chk" CHECK ("age" >= 0 AND "age" <= 120);

ALTER TABLE "patient"
  ADD CONSTRAINT "patient_name_chk" CHECK (length(btrim("name")) >= 2);

-- ---------------------------------------------------------------- HOSPITAL
ALTER TABLE "hospital"
  ADD CONSTRAINT "hospital_beds_chk" CHECK (
    "total_beds" >= 0 AND "free_beds" >= 0 AND "free_beds" <= "total_beds"
  );

ALTER TABLE "hospital"
  ADD CONSTRAINT "hospital_lat_chk" CHECK ("lat" >= -90 AND "lat" <= 90);

ALTER TABLE "hospital"
  ADD CONSTRAINT "hospital_lon_chk" CHECK ("lon" >= -180 AND "lon" <= 180);

-- ---------------------------------------------------------------- BLOOD_STOCK
ALTER TABLE "blood_stock"
  ADD CONSTRAINT "blood_stock_units_chk" CHECK ("units" >= 0);

ALTER TABLE "blood_stock"
  ADD CONSTRAINT "blood_stock_group_chk" CHECK (
    "blood_group" IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  );

-- ---------------------------------------------------------------- MEDICINE_STOCK
ALTER TABLE "medicine_stock"
  ADD CONSTRAINT "medicine_stock_units_chk" CHECK ("units" >= 0);

ALTER TABLE "medicine_stock"
  ADD CONSTRAINT "medicine_stock_name_chk" CHECK (length(btrim("medicine")) >= 3);

-- ---------------------------------------------------------------- AMBULANCE
ALTER TABLE "ambulance"
  ADD CONSTRAINT "ambulance_reg_no_chk" CHECK (
    "reg_no" ~ '^[A-Z]{2}-[0-9]{2}-[A-Z]{1,3}-[0-9]{4}$'
  );

ALTER TABLE "ambulance"
  ADD CONSTRAINT "ambulance_lat_chk" CHECK ("lat" >= -90 AND "lat" <= 90);

ALTER TABLE "ambulance"
  ADD CONSTRAINT "ambulance_lon_chk" CHECK ("lon" >= -180 AND "lon" <= 180);

-- ---------------------------------------------------------------- EMERGENCY_REQUEST
ALTER TABLE "emergency_request"
  ADD CONSTRAINT "emergency_request_lat_chk" CHECK ("lat" >= -90 AND "lat" <= 90);

ALTER TABLE "emergency_request"
  ADD CONSTRAINT "emergency_request_lon_chk" CHECK ("lon" >= -180 AND "lon" <= 180);

ALTER TABLE "emergency_request"
  ADD CONSTRAINT "emergency_request_blood_group_chk" CHECK (
    "blood_group_needed" IS NULL
    OR "blood_group_needed" IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  );

ALTER TABLE "emergency_request"
  ADD CONSTRAINT "emergency_request_medicine_chk" CHECK (
    "medicine_needed" IS NULL OR length(btrim("medicine_needed")) > 0
  );

-- ---------------------------------------------------------------- ASSIGNMENT
ALTER TABLE "assignment"
  ADD CONSTRAINT "assignment_distance_chk" CHECK ("distance_km" >= 0);

ALTER TABLE "assignment"
  ADD CONSTRAINT "assignment_readiness_chk" CHECK (
    "readiness_score" >= 0 AND "readiness_score" <= 100
  );

ALTER TABLE "assignment"
  ADD CONSTRAINT "assignment_closed_chk" CHECK (
    "closed_at" IS NULL OR "closed_at" >= "assigned_at"
  );

-- An ambulance can never hold two open assignments, even if two dispatchers
-- confirm at the same instant. Closed history is still allowed.
CREATE UNIQUE INDEX "assignment_one_open_per_ambulance"
  ON "assignment" ("ambulance_id")
  WHERE "closed_at" IS NULL;

-- Fast access path for the ranked queue.
CREATE INDEX "emergency_request_open_queue_idx"
  ON "emergency_request" ("severity", "created_at")
  WHERE "status" = 'QUEUED';

-- Fast lookup of the incoming patients for one hospital.
CREATE INDEX "assignment_open_by_hospital_idx"
  ON "assignment" ("hospital_id", "assigned_at")
  WHERE "closed_at" IS NULL;
