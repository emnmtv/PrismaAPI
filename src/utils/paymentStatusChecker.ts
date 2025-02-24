import { prisma } from './authUtils'; // Adjust the import based on your project structure
import axios from 'axios';
import cron from 'node-cron';

// Function to check payment status
export const checkPaymentStatus = async (referenceNumber: string) => {
  const options = {
    method: 'GET',
    url: `https://api.paymongo.com/v1/links?reference_number=${referenceNumber}`,
    headers: {
      accept: 'application/json',
      authorization: 'Basic sk_test_wot9ap8ESEBzf3RUB7m7zPRr', // Replace with your actual API key
    },
  };

  try {
    const response = await axios.request(options);
    console.log('API Response:', response.data); // Log the full response
    const paymentData = response.data.data;

    // Check the payment status
    const status = paymentData.attributes.status;

    // Update the payment record in the database
    const updateResult = await prisma.payment.updateMany({
      where: {
        referenceNumber: referenceNumber,
      },
      data: {
        status: status, // Update the status based on the API response
      },
    });

    console.log(`Update Result:`, updateResult); // Log the update result

    if (updateResult.count > 0) {
      console.log(`Payment status for ${referenceNumber} updated to ${status}.`);
    } else {
      console.log(`No payment found with reference number: ${referenceNumber}`);
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
  }
};

// Schedule a job to run every hour
cron.schedule('0 * * * *', async () => {
  try {
    // Fetch all unpaid payments
    const unpaidPayments = await prisma.payment.findMany({
      where: {
        status: 'unpaid', // Only check unpaid payments
      },
    });

    // Check the status for each unpaid payment
    for (const payment of unpaidPayments) {
      await checkPaymentStatus(payment.referenceNumber);
    }
  } catch (error) {
    console.error('Error checking payment statuses:', error);
  }
}); 