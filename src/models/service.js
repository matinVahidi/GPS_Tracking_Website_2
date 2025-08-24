// src/models/subplan.js
import { prisma } from './db/prisma.js'

export function addSubPlan({ name, duration, devicesCount, price, subPrice, discount = 0, popular = false }) {
  return prisma.subPlan.create({
    data: { name, duration, devicesCount, price, subPrice, discount, popular }
  })
}


export function deleteSubPlan(name) {
  return prisma.service.delete({ where: { name } })
}

// SubPlans (seeded once) — read helpers
export function getSubPlanByName(name) {
  return prisma.subPlan.findUnique({ where: { name } })
}

// create a service for a user from a named plan
export function createService({ userId, subPlanName, deviceIds = [], expirationDate = null, status = 'pending' }) {
  return prisma.service.create({
    data: {
      userId,
      subPlanName,
      status,
      expirationDate,
      devices: { connect: deviceIds.map(id => ({ id })) }
    },
    include: { subPlan: true, devices: true }
  })
}

export function getServiceById(id) {
  return prisma.service.findUnique({ where: { id }, include: { subPlan: true, devices: true, accesses: true } })
}

export function deleteService(id) {
  return prisma.service.delete({ where: { id } })
}

// “Given accesses” → rows in ServiceAccess
export function grantAccess({ serviceId, deviceId, granteeEmail, granteeId = null }) {
  return prisma.serviceAccess.create({ data: { serviceId, deviceId, granteeEmail, granteeId } })
}

export function listGivenAccessesForUser(userId) {
  // all accesses on services owned by user
  return prisma.serviceAccess.findMany({
    where: { service: { userId } },
    include: { device: true, service: { select: { id: true } }, grantee: { select: { email: true, id: true } } }
  })
}

// Update a service's status by id
export async function updateServiceStatus(id, status) {
  // status: 'pending' | 'confirmed' | 'rejected'
  return prisma.service.update({
    where: { id },
    data: { status },
  })
}

// Update SubPlan (by unique name)
export async function updateSubPlanByName(name, updates) {
  // Only allow explicit fields
  const {
    name: newName,
    duration,
    devicesCount,
    price,
    subPrice,
    discount,
    popular,
  } = updates ?? {}

  return prisma.subPlan.update({
    where: { name },
    data: {
      ...(newName && newName !== name ? { name: newName } : {}),
      ...(duration !== undefined ? { duration: Number(duration) } : {}),
      ...(devicesCount !== undefined ? { devicesCount: Number(devicesCount) } : {}),
      ...(price !== undefined ? { price: Number(price) } : {}),
      ...(subPrice !== undefined ? { subPrice: Number(subPrice) } : {}),
      ...(discount !== undefined ? { discount: Number(discount) } : {}),
      ...(popular !== undefined ? { popular: Boolean(popular) } : {}),
    },
  })
}

// Delete SubPlan by name
export async function deleteSubPlanByName(name) {
  return prisma.subPlan.delete({ where: { name } })
}


// Get all subplans (new function)
export async function getAllSubPlans() {
  try {
    return await prisma.subPlan.findMany({orderBy: { devicesCount: 'asc' }});
  } catch (error) {
    throw new Error(`Failed to get subplans: ${error.message}`);
  }
}

// Update service expiration date (new function)
export async function updateServiceExpiration(id, expirationDate) {
  try {
    return await prisma.service.update({
      where: { id },
      data: { expirationDate },
      include: { subPlan: true, devices: true }
    });
  } catch (error) {
    throw new Error(`Failed to update service expiration: ${error.message}`);
  }
}


export async function deleteServiceAccess({ serviceId, deviceId, granteeEmail }) {
  try {
    // First verify the service exists and get owner info
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { userId: true }
    });

    if (!service) {
      throw new Error('Service not found');
    }

    // Verify the access record exists and belongs to this service
    const accessRecord = await prisma.serviceAccess.findFirst({
      where: {
        serviceId,
        deviceId,
        granteeEmail
      },
      select: { id: true }
    });

    if (!accessRecord) {
      throw new Error('Access record not found');
    }

    // Delete the access record
    const result = await prisma.serviceAccess.deleteMany({
      where: {
        serviceId,
        deviceId,
        granteeEmail
      }
    });

    if (result.count === 0) {
      throw new Error('No access records were deleted');
    }

    return result;
  } catch (error) {
    console.error('Failed to delete service access:', error);
    throw new Error(`Failed to revoke access: ${error.message}`);
  }
}
