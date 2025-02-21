import { Response } from 'express';
import { prisma } from '../utils/authUtils';
import { AuthRequest } from '@/middleware/authRequest';

const sendMessage = async (req: AuthRequest, res: Response) => {
  const { receiverId, content } = req.body;
  const senderId = req.user!.userId;

  try {
    const newMessage = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
      },
      include: {
        sender: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        receiver: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    // Format the message for the response
    const formattedMessage = {
      content: newMessage.content,
      createdAt: newMessage.createdAt,
      senderId: newMessage.senderId,
      receiverId: newMessage.receiverId,
      senderName: `${newMessage.sender.firstName} ${newMessage.sender.lastName}`,
      receiverName: `${newMessage.receiver.firstName} ${newMessage.receiver.lastName}`,
    };

    res.status(201).json({ message: 'Message sent successfully', newMessage: formattedMessage });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

const fetchMessages = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { otherUserId } = req.params;

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { AND: [{ senderId: userId }, { receiverId: Number(otherUserId) }] },
          { AND: [{ senderId: Number(otherUserId) }, { receiverId: userId }] },
        ],
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
        receiver: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' }, // Ensure newest messages show at bottom
    });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};


const getUsersWithChatHistory = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      include: {
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const userChats = new Map();

    messages.forEach(msg => {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      
      if (!userChats.has(otherUser.id)) {
        userChats.set(otherUser.id, {
          user: otherUser,
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
          },
        });
      }
    });

    const chatList = Array.from(userChats.values());
    res.status(200).json(chatList);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export { sendMessage, fetchMessages, getUsersWithChatHistory }; 