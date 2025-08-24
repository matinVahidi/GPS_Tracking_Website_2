// src/models/wallet.js
import { prisma } from './db/prisma.js'
import { Decimal } from 'decimal.js';
// ... rest of your code

// read wallet with transactions
export function getWallet(userId) {
  return prisma.wallet.findUnique({
    where: { userId },
    include: { transactions: true }
  })
}

export function addRequest({ type, status, date, details, userId, rechargeWalletUserId = null }) {
  return prisma.request.create({ data: { type, status, date, details, userId, rechargeWalletUserId } })
}

// add a transaction (ledger entry)
export function addTransaction({ walletUserId, amount, direction, otherSideEmail, description }) {
  return prisma.walletTransaction.create({
    data: { walletUserId, amount, direction, otherSideEmail, description }
  })
}

// atomic balance deduction (returns updated wallet or throws)
export async function deductBalance(userId, amount) {
  return prisma.$transaction(async (tx) => {
    const w = await tx.wallet.findUnique({ where: { userId }, select: { balance: true } })
    if (!w || w.balance < amount) throw new Error('Insufficient balance')
    const decimalAmount = new Decimal(amount.toString());
    return tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: decimalAmount } }
    })
  })
}


/**
 * Get all requests that belong to this wallet (e.g., recharge requests).
 * Ordered by most recent first. Supports simple pagination.
 */
export function getAllRequests(userId) {
  return prisma.request.findMany({
    where: { rechargeWalletUserId: userId },
    orderBy: { date: 'desc' },
  })
}

/**
 * Get all transactions for a wallet (ledger entries).
 * Ordered by most recent first. Supports pagination and optional direction filter.
 * direction can be 'credit' | 'debit' | 'recharge' (whatever you store).
 */
export function getAllTransactions(userId, { direction, skip = 0, take = 50 } = {}) {
  return prisma.walletTransaction.findMany({
    where: {
      walletUserId: userId,
      ...(direction ? { direction } : {})
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take
  })
}

// Atomically credit a user's wallet balance
export async function creditBalance(userId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number')
  }
  // simple atomic increment; no ledger entry
  return prisma.$transaction(async (tx) => {
    return tx.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    })
  })
}


