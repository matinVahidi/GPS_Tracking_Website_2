import express from 'express';
import bcrypt from 'bcrypt';
import { 
  getUserById,
  updateUserProfile,
  updateUserPassword,
  getUserWithAddresses
} from '../models/user.js';  
import { 
  addAddress,
  listAddresses,
  deleteAddress
} from '../models/address.js';  
import { 
  profileUpdateValidator,
  passwordChangeValidator,
  addressValidator
} from '../middleware/validationMiddleware.js';

const router = express.Router();

// Route to get the user profile
router.get('/userProfile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    const userData = {
      name: user.name,
      lastName: user.lastName,
      nationalCode: user.nationalCode,
      role: user.role,
      email: user.email,
      phoneNumber: user.phoneNumber,
      companyName: user.companyName,
      landline: user.landline,
      faxNumber: user.faxNumber,
    };

    res.status(200).json({ userData });
  } catch (error) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// Route to update the user profile
router.put('/userProfile', profileUpdateValidator, async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;

    const validFields = [
      'name', 'lastName', 'nationalCode', 'role', 
      'email', 'phoneNumber', 'companyName', 'landline', 'faxNumber'
    ];

    const data = {};
    for (const field of validFields) {
      if (updates[field] !== undefined) {
          data[field] = updates[field];
      }
    }

    const updatedUser = await updateUserProfile(userId, data);
    res.status(200).json({ 
      message: 'پروفایل با موفقیت به‌روزرسانی شد',
      user: updatedUser 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to change password
router.put('/changePassword', passwordChangeValidator, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    await updateUserPassword(userId, oldPassword, newPassword);
    res.status(200).json({ message: 'رمز عبور با موفقیت به‌روزرسانی شد' });
  } catch (error) {
    const status = error.message.includes('قدیمی') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Route to add a new address
router.post('/userAddresses', addressValidator, async (req, res) => {
  try {
    const userId = req.user.userId;
    const addressData = req.body;

    const newAddress = await addAddress(userId, addressData);
    res.status(201).json({ 
      message: 'آدرس با موفقیت افزوده شد', 
      address: newAddress 
    });
  } catch (error) {
    res.status(500).json({ error: 'خطا در افزودن آدرس' });
  }
});

// Route to get all addresses
router.get('/userAddresses', async (req, res) => {
  try {
    const userId = req.user.userId;
    const addresses = await listAddresses(userId);
    res.status(200).json({ addresses });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت آدرس‌ها' });
  }
});

// Route to delete an address
router.delete('/userAddresses/:addressId', async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user.userId;

    await deleteAddress(addressId, userId);
    res.status(200).json({ message: 'آدرس با موفقیت حذف شد' });
  } catch (error) {
    const status = error.message.includes('یافت نشد') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

export default router;