import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { User } from '../src/models/User.model'
import { UserRole } from '../src/models/User.model'
import { randomUUID } from 'crypto'

// Load environment variables from .env file
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables')
  console.error('💡 Please create a .env file in the backend directory with MONGODB_URI')
  process.exit(1)
}

const SUPER_ADMIN_EMAIL = 'bhanu.kiran@position2.com'
const SUPER_ADMIN_PASSWORD = 'Position2!'
const SUPER_ADMIN_NAME = 'Bhanu Kiran'

async function initSuperAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined in environment variables')
      console.error('💡 Please create a .env file in the backend directory with MONGODB_URI')
      process.exit(1)
    }

    console.log('🔌 Connecting to MongoDB...')
    console.log('📍 URI:', mongoUri.replace(/\/\/.*@/, '//***:***@')) // Hide credentials in log
    
    // Connection options
    const options: any = {}
    
    // For MongoDB Atlas (mongodb+srv://), add SSL options
    if (mongoUri.includes('mongodb+srv://')) {
      options.tls = true
      options.tlsAllowInvalidCertificates = false
    }
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, options)
    console.log('✅ Connected to MongoDB')

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ email: SUPER_ADMIN_EMAIL })
    if (existingAdmin) {
      console.log('Super admin already exists:', SUPER_ADMIN_EMAIL)
      await mongoose.disconnect()
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10)

    // Create super admin user
    const userId = randomUUID()
    const superAdmin = new User({
      _id: userId,
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      role: UserRole.MANAGER,
      password: hashedPassword,
    })

    await superAdmin.save()
    console.log('Super admin created successfully!')
    console.log('Email:', SUPER_ADMIN_EMAIL)
    console.log('Password:', SUPER_ADMIN_PASSWORD)
    console.log('Role: MANAGER (Super Admin)')

    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error initializing super admin:', error)
    process.exit(1)
  }
}

// Run the script
initSuperAdmin()

