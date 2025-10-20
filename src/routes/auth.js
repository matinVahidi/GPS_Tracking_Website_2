import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { getUserByEmail, createUser } from '../models/user.js'
import dotenv from 'dotenv'
import { signupValidator } from '../middleware/validationMiddleware.js'

dotenv.config()

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// Signup route
router.post('/signup', signupValidator, async (req, res) => {
  const { email, password, name, lastName, companyName, phoneNumber } = req.body

  try {
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return res.status(409).json({ message: 'کاربر از قبل وجود دارد' })
    }

    // switched to DB-backed creator (replaces in-memory User.addUser)
    const newUser = await createUser({
      email,
      password,
      name,
      lastName,
      companyName: companyName || '',
      phoneNumber,
    })

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '1h' }
    )

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000,
    })

    return res.status(201).json({ message: 'ثبت‌نام با موفقیت انجام شد' })
  } catch (error) {
    console.error('خطا در ثبت‌نام:', error)
    return res.status(500).json({ message: 'خطایی در هنگام ثبت‌نام رخ داد' })
  }
})

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  const pass = await bcrypt.hash(password, 10);
  console.log(pass);


  // Admin login (uses env creds). Only change: fix compare order + await for bcrypt.
  try {
    const isAdminPasswordCorrect = ADMIN_PASSWORD
      ? await bcrypt.compare(password, ADMIN_PASSWORD)
      : false


    if (email === ADMIN_EMAIL && isAdminPasswordCorrect) {
      const token = jwt.sign({ email: ADMIN_EMAIL, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 3600000,
      })

      return res.json({ message: 'Admin logged in successfully' })
    }
  } catch (e) {
    // fall through to user login if ADMIN_PASSWORD isn't a bcrypt hash or compare fails
  }

  // Regular user login (DB-backed)
  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Email not found' })
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password)
  if (!isPasswordCorrect) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  const token = jwt.sign({ userId: user.id, email: user.email, role: 'user' }, JWT_SECRET, { expiresIn: '1h' })

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 3600000,
  })

  return res.json({ message: 'User logged in successfully' })
})

// Logout route (clear token)
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
  })
  return res.status(200).json({ message: 'Logged out successfully' })
})

export default router
