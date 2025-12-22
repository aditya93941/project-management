import mongoose from 'mongoose'
import { logger } from '../utils/logger'

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables')
    }

    // Connection options for better compatibility
    const options: any = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    }

    // For MongoDB Atlas (mongodb+srv://), add SSL/TLS options
    if (mongoUri.includes('mongodb+srv://')) {
      options.tls = true
      options.tlsAllowInvalidCertificates = false
      
      // Ensure the URI has proper connection string format
      let uri = mongoUri
      
      // Add default database name if not present
      if (!uri.includes('/?') && !uri.match(/\/\w+/)) {
        uri = uri.replace(/\?/, '/project-management?')
      }
      
      // Add retryWrites if not present
      if (!uri.includes('retryWrites')) {
        uri += (uri.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority'
      }
      
      await mongoose.connect(uri, options)
    } else {
      // For local MongoDB
    await mongoose.connect(mongoUri, options)
    }
    
    logger.log('✅ MongoDB connected successfully')
  } catch (error: any) {
    logger.error('❌ MongoDB connection error:', error.message)
    logger.error('\n💡 Troubleshooting tips:')
    logger.error('1. Check your MONGODB_URI in .env file')
    logger.error('2. For MongoDB Atlas: Ensure your IP is whitelisted (0.0.0.0/0 for all IPs)')
    logger.error('3. For MongoDB Atlas: Verify your username and password are correct')
    logger.error('4. For MongoDB Atlas: Check if your cluster is paused')
    logger.error('5. For local MongoDB: Ensure MongoDB service is running')
    logger.error('6. For local MongoDB: Use: mongodb://localhost:27017/project-management')
    process.exit(1)
  }
}

