// src/models/request.js
import { prisma } from './db/prisma.js'

export function addRequest({ type, status, date, details, userId, rechargeWalletUserId = null }) {
  return prisma.request.create({ data: { type, status, date, details, userId, rechargeWalletUserId } })
}

export function getRequestById(id) {
  return prisma.request.findUnique({ where: { id } })
}

export function listPendingRequests() {
  return prisma.request.findMany({ where: { status: 'pending' }, orderBy: { date: 'desc' } })
}

// Update a request's status by id
export async function updateRequestStatus(id, status) {
  // status: 'pending' | 'confirmed' | 'rejected'
  return prisma.request.update({
    where: { id },
    data: { status },
  })
}

