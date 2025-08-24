  // src/routes/admin.js (DB-backed)
  import express from 'express'
  import fs from 'fs'
  import path from 'path'
  import { fileURLToPath } from 'url'

  import { getRequestById, listPendingRequests, updateRequestStatus } from '../models/request.js'
  import { addDevice, addDeviceToUserVisible } from '../models/device.js'
  import { addSubPlan, getSubPlanByName, updateServiceStatus, updateSubPlanByName, deleteSubPlanByName } from '../models/service.js'
  import { creditBalance } from '../models/wallet.js'

  const router = express.Router()

  // helpers
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const getFilePath = (receiptImage) => path.join(process.cwd(), 'uploads', receiptImage)

  // ----------------------------- Requests ------------------------------

  // GET single request by id
  router.get('/request/:id', async (req, res) => {
    try {
      const request = await getRequestById(req.params.id)
      if (!request) return res.status(404).json({ message: 'Request not found' })
      return res.status(200).json({ request })
    } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch request', error: err?.message })
    }
  })

  // GET all pending ("to be managed") requests
  router.get('/toBeManagedRequests', async (_req, res) => {
    try {
      const toBeManagedRequests = await listPendingRequests()
      return res.status(200).json({ toBeManagedRequests })
    } catch (err) {
      return res.status(500).json({ message: 'Failed to list pending requests', error: err?.message })
    }
  })

  // POST confirm a recharge request (admin action)
  router.post('/confirmRechargeRequest', async (req, res) => {
    const { requestId, confirmed } = req.body || {}
    if (!requestId) return res.status(400).json({ message: 'requestId is required' })
    try {
      const request = await getRequestById(requestId)
      if (!request || request.type !== 'recharge' || request.status !== 'pending') {
        return res.status(400).json({ message: 'Invalid or non-recharge request' })
      }

      // Update request status first
      const updatedRequest = await updateRequestStatus(requestId, confirmed ? 'confirmed' : 'rejected')

      // Delete uploaded receipt if any (best-effort)
      const maybeImage = request?.details?.image
      if (maybeImage) {
        const filePath = getFilePath(maybeImage)
        console.log(filePath);
        fs.unlink(filePath, (err) => {console.log(err);})
      }

      let updatedWallet = null
      if (confirmed) {
        const userId = request.details?.userId || request.userId
        if (!userId) return res.status(400).json({ message: 'Recharge request missing userId' })

        const amount = Number(request.details?.amount || 0)
        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({ message: 'Invalid recharge amount' })
        }

        // Credit wallet balance & add ledger entry (transactional)
        updatedWallet = await creditBalance(userId, amount)
      }

      return res.status(200).json({
        message: confirmed ? 'Request confirmed and balance updated' : 'Request rejected',
        updatedRequest,
        updatedBalance: updatedWallet?.balance ?? undefined
      })
    } catch (err) {
      return res.status(500).json({ message: 'Failed to confirm recharge', error: err?.message })
    }
  })

  // POST confirm a service purchase request
  router.post('/confirmBuyServiceRequest', async (req, res) => {
    const { requestId, confirmed } = req.body || {}
    if (!requestId) return res.status(400).json({ message: 'requestId is required' })

    try {
      const request = await getRequestById(requestId)
      if (!request || request.type !== 'purchase-service' || request.status !== "pending") {
        return res.status(400).json({ message: 'Invalid or non-purchase service request' })
      }

      const service = request.details.service;
      if (!service || service.status !== 'pending') return res.status(404).json({ message: 'Service not found' })

      // status update on service
      const newStatus = confirmed ? 'confirmed' : 'rejected'

      // If confirmed: optionally charge the user (if your flow requires)
      // and pre-provision devices according to the plan
      let createdDevices = []

      if (confirmed) {
        // OPTIONAL: deduct wallet based on plan price/subPrice. Uncomment if applicable.
        // const priceToCharge = service.subPlan?.subPrice ?? service.subPlan?.price ?? 0
        // if (priceToCharge > 0) await deductBalance(service.userId, priceToCharge)
        // await addTransaction({ walletUserId: service.userId, amount: priceToCharge, direction: 'debit', description: `Service ${serviceId} purchase` })

        // Provision devices
        const n = service.subPlan?.devicesCount ?? 0
        const serviceId = service.id;

        for (let i = 0; i < n; i++) {
          const d = await addDevice({ model: 'basic', name: `device_${serviceId.substring(0, 3)}_${i}`, userId: service.userId, serviceId, status: 'inactive' })
          const dev = await addDeviceToUserVisible(service.userId, d.id);
          console.log(dev);
          createdDevices.push(d)
        }
      }

      await updateServiceStatus(service.id, "posting")

      // Mark the originating request as managed (confirmed/rejected)
      const updatedRequest = await updateRequestStatus(requestId, confirmed ? 'confirmed' : 'rejected')

      return res.status(200).json({
        message: confirmed ? 'Service purchase confirmed' : 'Service purchase rejected',
        devices: createdDevices.map((d) => ({ id: d.id, name: d.name }))
      })
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: 'Failed to confirm service purchase', error: err?.message })
    }
  })

  // ----------------------------- SubPlans ------------------------------

  // CREATE SubPlan
router.post('/subplans', async (req, res) => {
  const { name, duration, devicesCount, price, subPrice, discount = 0, popular = false } = req.body || {}
  try {
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'name is required' })
    }

    const exists = await getSubPlanByName(name)
    if (exists) {
      return res.status(409).json({ message: `SubPlan '${name}' already exists` })
    }

    const subPlan = await addSubPlan({
      name,
      duration: Number(duration),
      devicesCount: Number(devicesCount),
      price: Number(price),
      subPrice: Number(subPrice),
      discount: Number(discount),
      popular: Boolean(popular)
    })

    return res.status(201).json({
      message: 'SubPlan created',
      subPlan: toJSON(subPlan)
    })
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Failed to create SubPlan', error: err?.message })
  }
})

// UPDATE SubPlan (by unique name)
router.put('/subplans/:name', async (req, res) => {
  const currentName = req.params.name
  const { name: newName, duration, devicesCount, price, subPrice, discount, popular } = req.body || {}
  try {
    const existing = await getSubPlanByName(currentName)
    if (!existing) return res.status(404).json({ message: `SubPlan '${currentName}' not found` })

    const payload = {
      ...(newName && newName !== currentName ? { name: newName } : {}),
      ...(duration !== undefined ? { duration: Number(duration) } : {}),
      ...(devicesCount !== undefined ? { devicesCount: Number(devicesCount) } : {}),
      ...(price !== undefined ? { price: Number(price) } : {}),
      ...(subPrice !== undefined ? { subPrice: Number(subPrice) } : {}),
      ...(discount !== undefined ? { discount: Number(discount) } : {}),
      ...(popular !== undefined ? { popular: Boolean(popular) } : {})
    }

    const subPlan = await updateSubPlanByName(currentName, payload)
    return res.status(200).json({ message: 'SubPlan updated'})
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Failed to update SubPlan', error: err?.message })
  }
})

  // DELETE SubPlan by name
  router.delete('/subplans/:name', async (req, res) => {
    const name = req.params.name
    try {
      // NOTE: service.deleteSubPlan(name) is buggy in models; delete directly.
      await deleteSubPlanByName(name)
      return res.status(200).json({ message: 'SubPlan deleted' })
    } catch (err) {
      if (err?.code === 'P2025') return res.status(404).json({ message: `SubPlan '${name}' not found` })
      return res.status(500).json({ message: 'Failed to delete SubPlan', error: err?.message })
    }
  })

  export default router
