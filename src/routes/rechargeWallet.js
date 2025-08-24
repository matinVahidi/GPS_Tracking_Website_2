import multer from 'multer';
import express from 'express';
import bcrypt from 'bcrypt';
import {
  addTransaction,
  getAllRequests as getWalletRequests,
  getAllTransactions,
  creditBalance,
  deductBalance,
  getWallet
} from '../models/wallet.js';
import { getUserById, getUserByEmail } from '../models/user.js';
import { addRequest } from '../models/request.js';


// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

const router = express.Router();

// Get current wallet balance
router.get('/getBalance', async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) return res.status(400).json({ message: 'User ID not found' });

    const user = await getUserById(userId);
    if (!user?.wallet) return res.status(404).json({ message: 'Wallet not found' });

    res.status(200).json({ balance: user.wallet.balance });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching balance', error: error.message });
  }
});

// Create recharge request
router.post('/rechargeWallet', upload.single('receiptImage'), async (req, res) => {
  try {
    const { amount, transactionNumber } = req.body;
    const userId = req.user.userId;
    
    if (!userId) return res.status(400).json({ message: 'User ID not found' });
    if (!amount || !transactionNumber) {
      return res.status(400).json({ message: 'Amount and transaction number are required' });
    }

    const receiptImage = req.file?.filename;
    console.log(receiptImage);

    const newRequest = await addRequest({
      type: 'recharge',
      status: 'pending',
      date: new Date(),
      details: { amount, transactionNumber, image: receiptImage },
      userId,
      rechargeWalletUserId: userId
    });

    res.status(200).json({
      message: 'Recharge request created',
      request: newRequest
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error creating recharge request', error: error.message });
  }
});

// Get user's wallet requests
router.get('/user-requests', async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) return res.status(400).json({ message: 'User ID not found' });

    const requests = await getWalletRequests(userId);
    res.status(200).json({ requests });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
});

// Transfer money to another user
router.post('/transfer', async (req, res) => {
  try {
    const { recipientEmail, amount, password } = req.body;
    const senderId = req.user.userId;

    // Input validation
    if (!senderId) return res.status(400).json({ message: 'User ID not found' });
    if (!recipientEmail || !amount || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ message: 'Invalid amount' });

    // Verify sender
    const sender = await getUserById(senderId);
    if (!sender?.wallet) return res.status(404).json({ message: 'Sender wallet not found' });

    // Verify password
    const passwordMatch = await bcrypt.compare(password, sender.password);
    if (!passwordMatch) return res.status(401).json({ message: 'Incorrect password' });

    // Check balance
    if (sender.wallet.balance < amountNum) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    // Verify recipient
    const recipient = await getUserByEmail(recipientEmail);
    const wallet = await getWallet(recipient.id);
    if (!wallet || recipient.id === senderId) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Perform transfer
    await deductBalance(senderId, amountNum);
    await creditBalance(recipient.id, amountNum);

    // Record transactions
    await addTransaction({
      walletUserId: senderId,
      amount: amountNum,
      direction: 'send',
      otherSideEmail: recipientEmail,
      description: "success"
    });

    await addTransaction({
      walletUserId: recipient.id,
      amount: amountNum,
      direction: 'receive',
      otherSideEmail: sender.email,
      description: "success"
    });

    res.status(200).json({ 
      message: 'Transfer successful',
      newBalance: sender.wallet.balance - amountNum
    });
  } catch (error) {
    res.status(500).json({ message: 'Transfer failed', error: error.message });
  }
});

// Get user's transaction history
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) return res.status(400).json({ message: 'User ID not found' });

    const transactions = await getAllTransactions(userId);
    res.status(200).json({ transactions });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
});

export default router;