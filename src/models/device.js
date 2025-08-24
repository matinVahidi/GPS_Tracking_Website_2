// src/models/device.js
import { prisma } from './db/prisma.js'

export function addDevice({ model = 'basic', name, userId, serviceId = null, status = 'inactive' }) {
  return prisma.device.create({
    data: {
      model,
      name: name ?? `device_${crypto.randomUUID()}`,
      userId,
      serviceId,
      status,
      connected: true,
      lastReceived: new Date()
    }
  })
}

export function getDeviceById(id) {
  return prisma.device.findUnique({ where: { id }})
}

export function deleteDevice(id) {
  return prisma.device.delete({ where: { id } })
}

export function listDevicesByUser(userId) {
  return prisma.device.findMany({ where: { userId } })
}

// Insert GPS record (location is computed in DB)
export function addGpsRecord({ deviceId, ts = new Date(), latitude, longitude, accuracy, altitude, speed, heading, battery }) {
  return prisma.gpsRecord.create({
    data: { deviceId, ts, latitude, longitude, accuracy, altitude, speed, heading, battery }
  })
}

export function getLastGpsRecord(deviceId) {
  return prisma.gpsRecord.findFirst({
    where: { deviceId },
    orderBy: { ts: 'desc' }
  })
}

export function getLastNGpsRecords(deviceId, n = 100) {
  return prisma.gpsRecord.findMany({
    where: { deviceId },
    orderBy: { ts: 'desc' },
    take: n
  })
}


export async function updateDeviceStatus(id, updates) {
  try {
    if (!id) {
      throw new Error('Device ID is required');
    }

    const validUpdates = {};
    
    // Only include defined fields in the update
    if (updates.status !== undefined) {
      validUpdates.status = updates.status;
    }
    if (updates.connected !== undefined) {
      validUpdates.connected = Boolean(updates.connected);
    }
    if (updates.lastReceived !== undefined) {
      validUpdates.lastReceived = new Date(updates.lastReceived);
    }

    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields provided for update');
    }

    const updatedDevice = await prisma.device.update({
      where: { id },
      data: validUpdates,
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return updatedDevice;
  } catch (error) {
    if (error.code === 'P2025') { // Prisma not found error code
      throw new Error(`Device with ID ${id} not found`);
    }
    throw new Error(`Failed to update device status: ${error.message}`);
  }
}

export async function getAllDevices() {
  try {
    return await prisma.device.findMany({
      select: {
        id: true,
        connected: true,
        lastReceived: true
      }
    });
  } catch (error) {
    throw new Error(`Failed to get devices: ${error.message}`);
  }
}


export async function updateDeviceConnectionStatus(deviceId, isConnected) {
  try {
    return await prisma.device.update({
      where: { id: deviceId },
      data: { connected: isConnected },
      select: { id: true, connected: true }
    });
  } catch (error) {
    throw new Error(`Failed to update device connection status: ${error.message}`);
  }
}

/**
 * Add deviceId to user's visibleDivices.
 * Throws if already present.
 */
export async function addDeviceToUserVisible(userId, deviceId) {
  // Ensure both the user and device exist
  const [user, device] = await Promise.all([
    prisma.user.findUnique({ 
      where: { id: userId }, 
      select: { id: true, visibleDivices: true } 
    }),
    prisma.device.findUnique({ 
      where: { id: deviceId }, 
      select: { id: true } 
    })
  ])
  
  if (!user) throw new Error(`User ${userId} not found`)
  if (!device) throw new Error(`Device ${deviceId} not found`)

  // Extract just the device IDs from visibleDivices (in case it contains objects)
  const currentDeviceIds = user.visibleDivices.map(item => 
    typeof item === 'string' ? item : item.id
  )

  // Check if the device is already visible for this user
  if (currentDeviceIds.includes(deviceId)) {
    throw new Error(`دستگاه برای کاربر قابل مشاهده است`)
  }

  // Add the deviceId to the user's visibleDivices list
  const updatedUser = await prisma.user.update({
  where: { id: userId },
  data: { 
    visibleDivices: { 
      set: [{ id: deviceId }, ...user.visibleDivices.map(d => ({ id: d.id }))]
    } 
  },
  include: { visibleDivices: { select: { id: true } } }
})

  return updatedUser
}

/**
 * Remove deviceId from user's visibleDivices.
 * Throws if not currently linked.
 *
 * Uses raw SQL against the implicit join table to avoid P2014
 * (required Device.user relation).
 */
export async function removeDeviceFromUserVisible(userId, deviceId) {
  // Existence checks for user and device
  const [user, device] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, visibleDivices: true } }),
    prisma.device.findUnique({ where: { id: deviceId }, select: { id: true } })
  ])

  if (!user) throw new Error(`User ${userId} not found`)
  if (!device) throw new Error(`Device ${deviceId} not found`)

  // Check if the device is already in the user's visibleDivices
  const currentDeviceIds = user.visibleDivices.map(item => 
    typeof item === 'string' ? item : item.id
  )
  if (!currentDeviceIds.includes(deviceId)) {
    throw new Error(`دستگاه برای کاربر قابل مشاهده نیست`) // "Device is not visible for the user"
  }

  // Use Prisma's disconnect to remove the device from the visibleDivices array
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      visibleDivices: {
        disconnect: { id: deviceId } // Remove device from the relation without deleting it
      }
    },
    select: { id: true, visibleDivices: { select: { id: true, name: true } } }
  })

  // Return the updated list of visibleDivices for the user
  return updatedUser
}



/**
 * List a user's visible devices.
 */
export async function listUserVisibleDevices(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {visibleDivices: { select: { id: true, name: true,  status:true} } }
  })
  if (!user) throw new Error(`User ${userId} not found`)
  return user.visibleDivices
}
