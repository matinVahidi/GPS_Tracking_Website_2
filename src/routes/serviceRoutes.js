import express from 'express';
import {  getUserById,  getUserByEmail} from '../models/user.js';
import {  getDeviceById,  listDevicesByUser, addDeviceToUserVisible, removeDeviceFromUserVisible} from '../models/device.js';
import {  getAllSubPlans,  getServiceById,  getSubPlanByName,  listGivenAccessesForUser,  grantAccess,  deleteServiceAccess,  createService,  updateServiceExpiration} from '../models/service.js';
import {  addRequest} from '../models/request.js';
import { deductBalance, getWallet} from '../models/wallet.js';
import { getAddressById} from '../models/address.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// Helper function to add months to a date
const addMonthsToDate = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

// Buy a new service
router.post('/buy-service', async (req, res) => {
  try {
    const { name, addressId } = req.body;
    const userId = req.user.userId;

    if (!name || !addressId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const subPlan = await getSubPlanByName(name);
    if (!subPlan) {
      return res.status(400).json({ message: `SubPlan '${name}' not found` });
    }

    const wallet = await getWallet(userId);
    if (wallet.balance < subPlan.price) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await deductBalance(userId, subPlan.price);

    const expirationDate = addMonthsToDate(new Date(), subPlan.duration);
    const newService = await createService({
      userId,
      subPlanName: name,
      expirationDate,
      status: 'pending'
    });

    

    const newRequest = await addRequest({
      type: 'purchase-service',
      status: 'pending',
      date: new Date(),
      details: {
        service: newService,
        address: await getAddressById(addressId)
      },
      userId
    });

    res.status(200).json({
      message: 'Service purchased successfully'
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: 'Error purchasing service', error: error.message });
  }
});

// Get user's services
router.get('/services', async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ services: user.services });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching services', error: error.message });
  }
});

const serialize = (data) =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

// Get all subplans
router.get('/subplans', async (req, res) => {
  try {
    const subPlans = await getAllSubPlans();
    // filter(Boolean) as you had, then serialize to handle BigInt
    res.status(200).json({ subPlans: serialize(subPlans.filter(Boolean)) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subplans', error: error.message });
  }
});

router.get('/subplans/:name', async (req, res) => {
    const name = req.params.name
    try {
      // NOTE: service.deleteSubPlan(name) is buggy in models; delete directly.
      const plan = await getSubPlanByName(name)

      const safePlan = Object.fromEntries(
            Object.entries(plan).map(([key, value]) => [
                key,
                typeof value === 'bigint' ? value.toString() : value
            ])
        );

      return res.status(200).json(safePlan);
    } catch (err) {
      if (err?.code === 'P2025') return res.status(404).json({ message: `SubPlan '${name}' not found` })
      console.log(err);
      return res.status(500).json({ message: 'Failed to get SubPlan', error: err?.message })
    }
})

// Renew subscription
router.post('/renew-subscription', async (req, res) => {
  try {
    const { serviceId, months } = req.body;
    const userId = req.user.userId;

    if (!serviceId || !months) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const service = await getServiceById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    if (service.userId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subPlan = await getSubPlanByName(service.subPlanName);
    if (!subPlan) {
      return res.status(404).json({ message: 'SubPlan not found' });
    }

    const renewalMonths = parseInt(months);
    if (isNaN(renewalMonths)) {
      return res.status(400).json({ message: 'Invalid months value' });
    }

    const totalPrice = Number(subPlan.subPrice) * renewalMonths;
    await deductBalance(userId, totalPrice);

    const newExpiration = addMonthsToDate(
      service.expirationDate || new Date(),
      renewalMonths
    );

    const updatedService = await updateServiceExpiration(serviceId, newExpiration);

    res.status(200).json({
      message: 'Subscription renewed',
      newExpirationDate: newExpiration
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error renewing subscription', error: error.message });
  }
});

// Get given accesses
router.get('/given-accesses', async (req, res) => {
  try {
    const userId = req.user.userId;
    const accesses = await listGivenAccessesForUser(userId);
    res.status(200).json({ givenAccesses: accesses });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching accesses', error: error.message });
  }
});

// Give access to device
router.post('/give-access', async (req, res) => {
  try {
    const { password, deviceId, targetEmail } = req.body;
    const ownerUserId = req.user.userId;

    if (!password || !deviceId || !targetEmail) {
      return res.status(400).json({ message: 'پسورد، آیدی دستگاه یا ایمیل کاربر مفصد موجود نیست' });
    }

    const owner = await getUserById(ownerUserId);
    if (!owner) {
      return res.status(404).json({ message: 'کاربر صاحب دستگاه یافت نشد' });
    }

    const passwordMatch = await bcrypt.compare(password, owner.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'پسورد اشتباه است' });
    }

    const device = await getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'دستگاه یافت نشد' });
    }

    const targetUser = await getUserByEmail(targetEmail);
    if (!targetUser || targetUser.id === ownerUserId) {
      return res.status(404).json({ message: 'کاربری با این ایمیل وجود ندارد' });
    }
    const dev = await addDeviceToUserVisible(targetUser.id, deviceId);

    const access = await grantAccess({
      serviceId: device.serviceId,
      deviceId,
      granteeEmail: targetEmail,
      granteeId: targetUser.id
    });

    res.status(200).json({
      message: 'دسترسی اعطا شد',
      access
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message, error: error.message });
  }
});

// Revoke access
router.delete('/given-access', async (req, res) => {
  try {
    const { deviceId, targetEmail } = req.body;
    const ownerUserId = req.user.userId;

    if (!deviceId || !targetEmail) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const device = await getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const service = await getServiceById(device.serviceId);
    if (!service || service.userId !== ownerUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const targetUser = await getUserByEmail(targetEmail);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const dev = await removeDeviceFromUserVisible(targetUser.id, deviceId);

    await deleteServiceAccess({
      serviceId: device.serviceId,
      deviceId,
      granteeEmail: targetEmail
    });

    res.status(200).json({ message: 'دسترسی گرفته شد' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message, error: error.message });
  }
});

// Get user's devices
router.get('/devices', async (req, res) => {
  try {
    const userId = req.user.userId;
    const devices = await listDevicesByUser(userId);
    res.status(200).json(devices );
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching devices', error: error.message });
  }
});

export default router;