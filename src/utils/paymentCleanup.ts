import { prisma } from './authUtils'; // Adjust the import based on your project structure
import cron from 'node-cron';

// Schedule a job to run every day at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Delete payments that are unpaid and older than one day
    await prisma.payment.deleteMany({
      where: {
        status: 'unpaid', // Assuming 'unpaid' is the status for unpaid payments
        createdAt: {
          lt: oneDayAgo, // Payments older than one day
        },
      },
    });

    console.log('Unpaid payments older than one day have been deleted.');
  } catch (error) {
    console.error('Error deleting unpaid payments:', error);
  }
}); 