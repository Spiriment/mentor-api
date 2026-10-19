import { Request, Response } from 'express';
import { AppDataSource } from '@/config/data-source';
import { ContactMessage, ContactStatus } from '@/database/entities/contactMessage.entity';
import { User } from '@/database/entities/user.entity';
import { AdminAlert } from '@/database/entities/adminAlert.entity';
import { IsNull } from 'typeorm';

export const adminNotificationsController = {
  async getSummary(req: Request, res: Response) {
    try {
      const contactRepo = AppDataSource.getRepository(ContactMessage);
      const userRepo = AppDataSource.getRepository(User);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [unreadContacts, pendingMentors, newUsers] = await Promise.all([
        contactRepo.findAndCount({
          where: { status: ContactStatus.UNREAD },
          order: { createdAt: 'DESC' },
          take: 10,
        }),
        userRepo
          .createQueryBuilder('u')
          .where('u.mentorApprovalStatus = :status', { status: 'pending' })
          .orderBy('u.createdAt', 'DESC')
          .take(10)
          .getMany(),
        userRepo
          .createQueryBuilder('u')
          .where('u.createdAt >= :date', { date: sevenDaysAgo })
          .getCount(),
      ]);

      const contactNotifications = unreadContacts[0].map((c) => ({
        id: c.id,
        type: 'contact' as const,
        title: `New ${c.type === 'PARTNERSHIP' ? 'Partnership' : c.type === 'VOLUNTEER' ? 'Volunteer' : 'Contact'} inquiry`,
        body: `${c.name} — ${c.email}`,
        createdAt: c.createdAt,
        link: '/contacts',
      }));

      const mentorNotifications = pendingMentors.map((u) => ({
        id: `mentor-${u.id}`,
        type: 'mentor_application' as const,
        title: 'New mentor application',
        body: `${[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email} is awaiting review`,
        createdAt: u.createdAt,
        link: `/applications`,
      }));

      // This admin's own alerts (tickets, subscriptions — per their notification preferences)
      const [alerts, unreadAlerts] = await AppDataSource.getRepository(AdminAlert).findAndCount({
        where: { adminUserId: (req as any).admin?.id, readAt: IsNull() },
        order: { createdAt: 'DESC' },
        take: 15,
      });
      const alertNotifications = alerts.map((a) => ({
        id: a.id,
        type: a.type as 'support_ticket' | 'subscription',
        title: a.title,
        body: a.body,
        createdAt: a.createdAt,
        link: a.link ?? '/',
        alert: true as const,
      }));

      const notifications = [...alertNotifications, ...mentorNotifications, ...contactNotifications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15);

      return res.json({
        success: true,
        response: {
          notifications,
          counts: {
            unreadContacts: unreadContacts[1],
            pendingApplications: pendingMentors.length,
            newUsersThisWeek: newUsers,
            unreadAlerts,
            total: unreadContacts[1] + pendingMentors.length + unreadAlerts,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  },

  async markContactRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const contactRepo = AppDataSource.getRepository(ContactMessage);
      await contactRepo.update(id, { status: ContactStatus.READ });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  },

  async markAllContactsRead(req: Request, res: Response) {
    try {
      const contactRepo = AppDataSource.getRepository(ContactMessage);
      await contactRepo.update({ status: ContactStatus.UNREAD }, { status: ContactStatus.READ });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { message: error.message } });
    }
  },
};
