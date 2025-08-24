// src/models/address.js
import { prisma } from './db/prisma.js'

export function listAddresses(userId) {
  return prisma.address.findMany({ where: { userId } })
}

// Add address
export async function addAddress(userId, addressData) {
  return await prisma.address.create({
    data: {
      userId,
      province: addressData.province,
      city: addressData.city,
      postalCode: addressData.postalCode,
      address: addressData.address,
      areaCode: addressData.areaCode,
      landline: addressData.landline
    }
  });
}

export async function getAddressById(addressId) {
  const address = await prisma.address.findUnique({
    where: { id: addressId }
  });

  if (!address) {
    throw new Error('آدرس یافت نشد');
  }

  return address;
}


// Delete address
export async function deleteAddress(addressId, userId) {
  const address = await prisma.address.findUnique({
    where: { id: addressId }
  });

  if (!address) {
    throw new Error('آدرس یافت نشد');
  }

  if (address.userId !== userId) {
    throw new Error('شما مجاز به حذف این آدرس نیستید');
  }

  await prisma.address.delete({
    where: { id: addressId }
  });
}