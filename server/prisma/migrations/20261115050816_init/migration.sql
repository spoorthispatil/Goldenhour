-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DISPATCHER', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('QUEUED', 'ASSIGNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "username" VARCHAR(60) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL,
    "hospital_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "hospital" (
    "hospital_id" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "total_beds" INTEGER NOT NULL,
    "free_beds" INTEGER NOT NULL,

    CONSTRAINT "hospital_pkey" PRIMARY KEY ("hospital_id")
);

-- CreateTable
CREATE TABLE "blood_stock" (
    "hospital_id" VARCHAR(20) NOT NULL,
    "blood_group" VARCHAR(3) NOT NULL,
    "units" INTEGER NOT NULL,

    CONSTRAINT "blood_stock_pkey" PRIMARY KEY ("hospital_id","blood_group")
);

-- CreateTable
CREATE TABLE "medicine_stock" (
    "hospital_id" VARCHAR(20) NOT NULL,
    "medicine" VARCHAR(80) NOT NULL,
    "units" INTEGER NOT NULL,

    CONSTRAINT "medicine_stock_pkey" PRIMARY KEY ("hospital_id","medicine")
);

-- CreateTable
CREATE TABLE "ambulance" (
    "ambulance_id" VARCHAR(20) NOT NULL,
    "reg_no" VARCHAR(20) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "ambulance_pkey" PRIMARY KEY ("ambulance_id")
);

-- CreateTable
CREATE TABLE "patient" (
    "patient_id" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "age" INTEGER NOT NULL,
    "contact" VARCHAR(10) NOT NULL,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("patient_id")
);

-- CreateTable
CREATE TABLE "emergency_request" (
    "request_id" VARCHAR(20) NOT NULL,
    "patient_id" VARCHAR(20) NOT NULL,
    "raised_by" VARCHAR(20) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "severity" "Severity" NOT NULL,
    "blood_group_needed" VARCHAR(3),
    "medicine_needed" VARCHAR(80),
    "status" "RequestStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_request_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "assignment_id" TEXT NOT NULL,
    "request_id" VARCHAR(20) NOT NULL,
    "ambulance_id" VARCHAR(20) NOT NULL,
    "hospital_id" VARCHAR(20) NOT NULL,
    "distance_km" DECIMAL(6,2) NOT NULL,
    "readiness_score" INTEGER NOT NULL,
    "partial_flag" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_hospital_id_idx" ON "users"("hospital_id");

-- CreateIndex
CREATE INDEX "blood_stock_blood_group_idx" ON "blood_stock"("blood_group");

-- CreateIndex
CREATE INDEX "medicine_stock_medicine_idx" ON "medicine_stock"("medicine");

-- CreateIndex
CREATE UNIQUE INDEX "ambulance_reg_no_key" ON "ambulance"("reg_no");

-- CreateIndex
CREATE INDEX "ambulance_status_idx" ON "ambulance"("status");

-- CreateIndex
CREATE INDEX "emergency_request_status_severity_created_at_idx" ON "emergency_request"("status", "severity", "created_at");

-- CreateIndex
CREATE INDEX "emergency_request_patient_id_idx" ON "emergency_request"("patient_id");

-- CreateIndex
CREATE INDEX "emergency_request_raised_by_idx" ON "emergency_request"("raised_by");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_request_id_key" ON "assignment"("request_id");

-- CreateIndex
CREATE INDEX "assignment_hospital_id_closed_at_idx" ON "assignment"("hospital_id", "closed_at");

-- CreateIndex
CREATE INDEX "assignment_ambulance_id_closed_at_idx" ON "assignment"("ambulance_id", "closed_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("hospital_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_stock" ADD CONSTRAINT "blood_stock_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_stock" ADD CONSTRAINT "medicine_stock_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_request" ADD CONSTRAINT "emergency_request_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("patient_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_request" ADD CONSTRAINT "emergency_request_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "emergency_request"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_ambulance_id_fkey" FOREIGN KEY ("ambulance_id") REFERENCES "ambulance"("ambulance_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("hospital_id") ON DELETE RESTRICT ON UPDATE CASCADE;
