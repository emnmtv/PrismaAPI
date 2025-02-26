import { prisma } from './authUtils'; // Adjust the import based on your project structure
import axios from 'axios';
import cron from 'node-cron';

// Function to check payment status
const checkallPaymentStatus = async (referenceNumber: string) => {
  console.log(`Checking payment status for reference number: ${referenceNumber}`);

  const apiKey = 'sk_test_wot9ap8ESEBzf3RUB7m7zPRr'; // Your actual API key
  const encodedCredentials = Buffer.from(`${apiKey}:`).toString('base64'); // Encode credentials

  const options = {
    method: 'GET',
    url: `https://api.paymongo.com/v1/links?reference_number=${referenceNumber}`,
    headers: {
      accept: 'application/json',
      authorization: `Basic ${encodedCredentials}`, // Use the encoded credentials
    },
  };

  try {
    const response = await axios.request(options);
    console.log('API Response:', response.data); // Log the full response
    const paymentData = response.data.data;

    // Check if paymentData is an array and has at least one element
    if (Array.isArray(paymentData) && paymentData.length > 0) {
      // Check the payment status
      const status = paymentData[0].attributes.status; // Access the first element's attributes
      console.log(`Payment status retrieved: ${status}`);

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
    } else {
      console.log(`No payment data found for reference number: ${referenceNumber}`);
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
      await checkallPaymentStatus(payment.referenceNumber);
    }
  } catch (error) {
    console.error('Error checking payment statuses:', error);
  }
}); 