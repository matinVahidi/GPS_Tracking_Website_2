// src/models/user.js
import bcrypt from 'bcrypt'
import { prisma } from './db/prisma.js'

export async function createUser({ email, password, name, lastName, companyName, phoneNumber }) {
  const hashed = await bcrypt.hash(password, 10)
  return prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      lastName,
      companyName: companyName ?? '',
      phoneNumber: phoneNumber ?? '',
      wallet: { create: { balance: 0 } } // 1:1 wallet
    },
    include: { wallet: true }
  })
}

export async function getUserById(id) {
  return prisma.user.findUnique({ where: { id }, include: { wallet: true, addresses: true, services: true , visibleDivices: true} })
}

export async function getUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } })
}

// Update user profile
export async function updateUserProfile(userId, data) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        lastName: true,
        nationalCode: true,
        role: true,
        email: true,
        phoneNumber: true,
        companyName: true,
        landline: true,
        faxNumber: true
      }
    });
  } catch (error) {
    throw new Error('خطا در به‌روزرسانی پروفایل');
  }
}

// Update user password
export async function updateUserPassword(userId, oldPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('کاربر یافت نشد');
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new Error('رمز عبور قدیمی نادرست است');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });
}

// Get user with addresses
export async function getUserWithAddresses(userId) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: true }
  });
}
