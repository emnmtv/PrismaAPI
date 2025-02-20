import {  Response } from 'express';
import { prisma } from '../utils/authUtils';
import { AuthRequest } from '@/middleware/authRequest';

const sendMessage = async (req: AuthRequest, res: Response) => {
  const { receiverId, content } = req.body;
  const senderId = req.user!.userId; // Assuming user is authenticated

  try {
    const newMessage = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
      },
    });
    res.status(201).json({ message: 'Message sent successfully', newMessage });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};



const getUsersWithChatHistory = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId; // Assuming user is authenticated

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      select: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        content: true,
        createdAt: true,
      },
    });

    const userIds = new Set<number>();
    const userChatHistory: { user: any; messages: any[] }[] = [];

    messages.forEach(msg => {
      const otherUser = msg.sender.id === userId ? msg.receiver : msg.sender;

      if (otherUser.id !== userId) {
        userIds.add(otherUser.id);
        const existingUserChat = userChatHistory.find(userChat => userChat.user.id === otherUser.id);

        if (existingUserChat) {
          existingUserChat.messages.push({
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.sender.id,
            senderName: `${msg.sender.firstName} ${msg.sender.lastName}`,
            receiverId: msg.receiver.id,
            receiverName: `${msg.receiver.firstName} ${msg.receiver.lastName}`,
          });
        } else {
          userChatHistory.push({
            user: otherUser,
            messages: [{
              content: msg.content,
              createdAt: msg.createdAt,
              senderId: msg.sender.id,
              senderName: `${msg.sender.firstName} ${msg.sender.lastName}`,
              receiverId: msg.receiver.id,
              receiverName: `${msg.receiver.firstName} ${msg.receiver.lastName}`,
            }],
          });
        }
      }
    });

    res.status(200).json(userChatHistory);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export { sendMessage,  getUsersWithChatHistory }; 