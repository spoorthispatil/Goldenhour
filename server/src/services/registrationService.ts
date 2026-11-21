import { randomInt } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import type {
  DispatcherRegistrationInput,
  HospitalRegistrationInput,
  PatientRegistrationInput,
} from '../validation/registration';

export class RegistrationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

export interface RegisteredUser {
  userId: string;
  username: string;
  role: UserRole;
  hospitalId: string | null;
  hospitalName: string | null;
  patientId: string | null;
  patientName: string | null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (length: number): string =>
  Array.from(
    { length },
    () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)],
  ).join('');

const isUniqueViolation = (error: unknown, field?: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002' &&
  (!field || String(error.meta?.target ?? '').includes(field));

/**
 * Creates a hospital and its first staff account in one transaction. No sample
 * data is written: beds start at 0 free and the hospital adds its own dataset
 * after signing in. The hospital ID is generated here, never supplied.
 */
export async function registerHospital(
  input: HospitalRegistrationInput,
): Promise<RegisteredUser> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const hospitalId = `HOSP-${code(6)}`;
    const userId = `USR-${code(8)}`;
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { username: input.username },
          select: { userId: true },
        });
        if (existing) {
          throw new RegistrationError(
            'USERNAME_TAKEN',
            409,
            'That username is already in use.',
          );
        }

        const hospital = await tx.hospital.create({
          data: {
            hospitalId,
            name: input.hospitalName,
            lat: input.lat,
            lon: input.lon,
            totalBeds: input.totalBeds,
            freeBeds: 0,
          },
        });
        const user = await tx.user.create({
          data: {
            userId,
            username: input.username,
            passwordHash,
            role: UserRole.HOSPITAL,
            hospitalId: hospital.hospitalId,
          },
        });

        return {
          userId: user.userId,
          username: user.username,
          role: user.role,
          hospitalId: hospital.hospitalId,
          hospitalName: hospital.name,
          patientId: null,
          patientName: null,
        };
      });
    } catch (error) {
      if (error instanceof RegistrationError) throw error;
      if (isUniqueViolation(error, 'username')) {
        throw new RegistrationError(
          'USERNAME_TAKEN',
          409,
          'That username is already in use.',
        );
      }
      // A generated hospital/user ID collision is vanishingly rare; retry.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new RegistrationError(
    'ID_GENERATION_FAILED',
    503,
    'Could not allocate an id. Please try again.',
  );
}

export async function registerPatient(
  input: PatientRegistrationInput,
): Promise<RegisteredUser> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const patientId = `PAT-${code(8)}`;
    const userId = `USR-${code(8)}`;
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { username: input.username },
          select: { userId: true },
        });
        if (existing) {
          throw new RegistrationError(
            'USERNAME_TAKEN',
            409,
            'That username is already in use.',
          );
        }

        const patient = await tx.patient.create({
          data: {
            patientId,
            name: input.name,
            age: input.age,
            contact: input.contact,
          },
        });
        const user = await tx.user.create({
          data: {
            userId,
            username: input.username,
            passwordHash,
            role: UserRole.PATIENT,
            patientId: patient.patientId,
          },
        });

        return {
          userId: user.userId,
          username: user.username,
          role: user.role,
          hospitalId: null,
          hospitalName: null,
          patientId: patient.patientId,
          patientName: patient.name,
        };
      });
    } catch (error) {
      if (error instanceof RegistrationError) throw error;
      if (isUniqueViolation(error, 'username')) {
        throw new RegistrationError(
          'USERNAME_TAKEN',
          409,
          'That username is already in use.',
        );
      }
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new RegistrationError(
    'ID_GENERATION_FAILED',
    503,
    'Could not allocate an id. Please try again.',
  );
}

export async function registerDispatcher(
  input: DispatcherRegistrationInput,
): Promise<RegisteredUser> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userId = `USR-${code(8)}`;
    try {
      const user = await prisma.user.create({
        data: {
          userId,
          username: input.username,
          passwordHash,
          role: UserRole.DISPATCHER,
        },
      });
      return {
        userId: user.userId,
        username: user.username,
        role: user.role,
        hospitalId: null,
        hospitalName: null,
        patientId: null,
        patientName: null,
      };
    } catch (error) {
      if (isUniqueViolation(error, 'username')) {
        throw new RegistrationError(
          'USERNAME_TAKEN',
          409,
          'That username is already in use.',
        );
      }
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw new RegistrationError(
    'ID_GENERATION_FAILED',
    503,
    'Could not allocate an id. Please try again.',
  );
}
