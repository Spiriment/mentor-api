import { Request, Response } from 'express';
import { AppDataSource } from '@/config/data-source';
import { ContactMessage, ContactStatus } from '@/database/entities/contactMessage.entity';
import { User } from '@/database/entities/user.entity';

export const adminNotificationsController = {
  /**
   * Returns a summary of actionable items for the admin:
   * - Unread contact/volunteer/partnership submissions
   * - Pending mentor applications
   * - New users in the last 7 days
   */
  async getSummary(req: Request, res: Response) {
    try {
      const contactRepo = AppDataSource.getRepository(ContactMessage);
      const userRepo = AppDataSource.getRepository(User);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        unreadContacts,
        pendingApplications,
        newUsers,
      ] = await Promise.all([
        contactRepo.findAndCount({
          where: { status: ContactStatus.UNREAD },
          order: { createdAt: 'DESC' },
          take: 10,
        }),
        userRepo
          .createQueryBuilder('u')
          .where('u.mentorApprovalStatus = :status', { status: 'pending' })
          .getCount(),
        userRepo
          .createQueryBuilder('u')
          .where('u.createdAt >= :date', { date: sevenDaysAgo })
          .getCount(),
      ]);

      const notifications = unreadContacts[0].map((c) => ({
        id: c.id,
        type: 'contact' as const,
        title: `New ${c.type === 'PARTNERSHIP' ? 'Partnership' : c.type === 'VOLUNTEER' ? 'Volunteer' : 'Contact'} inquiry`,
        body: `${c.name} — ${c.email}`,
        createdAt: c.createdAt,
        link: '/contacts',
      }));

      return res.json({
        success: true,
        response: {
          notifications,
          counts: {
            unreadContacts: unreadContacts[1],
            pendingApplications,
            newUsersThisWeek: newUsers,
            total: unreadContacts[1] + pendingApplications,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  },
};
