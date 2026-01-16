import { Router } from 'express';
import { ChatController } from '@/controllers/chat.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '@/common/middleware/validation';
import {
  createConversationSchema,
  sendMessageSchema,
  addReactionSchema,
  getConversationsQuerySchema,
  getConversationQuerySchema,
  conversationIdSchema,
  messageIdSchema,
} from '@/validation/chat.validation';

const router = Router();

// Apply authentication middleware to all chat routes
router.use(authenticateToken);

// Conversation routes
router.get(
  '/conversations',
  validate(getConversationsQuerySchema),
  ChatController.getConversations
);
router.post(
  '/conversations',
  validate(createConversationSchema),
  ChatController.createConversation
);
router.get(
  '/conversations/:conversationId',
  validate(getConversationQuerySchema.merge(conversationIdSchema)),
  ChatController.getConversation
);
router.get(
  '/conversations/:conversationId/participants',
  validate(conversationIdSchema),
  ChatController.getConversationParticipants
);
router.put(
  '/conversations/:conversationId/read',
  validate(conversationIdSchema),
  ChatController.markConversationRead
);

// Message routes
router.post(
  '/messages',
  validate(sendMessageSchema),
  ChatController.sendMessage
);
router.put(
  '/messages/:messageId/read',
  validate(messageIdSchema),
  ChatController.markMessageRead
);

router.put(
  '/messages/:messageId',
  validate(messageIdSchema),
  ChatController.editMessage
);

// Reaction routes
router.post(
  '/messages/:messageId/reactions',
  validate(messageIdSchema.merge(addReactionSchema)),
  ChatController.addReaction
);
router.delete(
  '/messages/:messageId/reactions',
  validate(messageIdSchema),
  ChatController.removeReaction
);

router.delete(
  '/messages/:messageId',
  validate(messageIdSchema),
  ChatController.deleteMessage
);

router.post(
  '/messages/:messageId/pin',
  validate(messageIdSchema),
  ChatController.pinMessage
);

router.post(
  '/messages/:messageId/unpin',
  validate(messageIdSchema),
  ChatController.unpinMessage
);

router.post(
  '/messages/:messageId/star',
  validate(messageIdSchema),
  ChatController.toggleStarMessage
);

export default router;
