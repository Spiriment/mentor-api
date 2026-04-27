import { Router } from 'express';
import { getEmailService } from '@/services/emailHelper';
import { AdminChurchPortalService } from '@/services/adminChurchPortal.service';
import { AdminChurchPortalController } from '@/controllers/adminChurchPortal.controller';

function buildController(): AdminChurchPortalController {
  const service = new AdminChurchPortalService(getEmailService());
  return new AdminChurchPortalController(service);
}

const router = Router();

// Lazily build the controller on first request so the email service is ready
let _controller: AdminChurchPortalController | null = null;
const ctrl = () => {
  if (!_controller) _controller = buildController();
  return _controller;
};

// ── Portals ────────────────────────────────────────────────────────────────
// GET  /api/admin/church-portals           — list all portals
// POST /api/admin/church-portals           — create a portal
// GET  /api/admin/church-portals/:portalId — get portal detail
// PATCH /api/admin/church-portals/:portalId — update portal

router.get('/', (req, res, next) => ctrl().list(req, res, next));
router.post('/', (req, res, next) => ctrl().create(req, res, next));
router.get('/:portalId', (req, res, next) => ctrl().getById(req, res, next));
router.patch('/:portalId', (req, res, next) => ctrl().update(req, res, next));

// ── Portal Users (pastor logins) ───────────────────────────────────────────
// GET    /api/admin/church-portals/:portalId/users              — list pastor logins
// POST   /api/admin/church-portals/:portalId/users              — create pastor login (sends invite)
// PATCH  /api/admin/church-portals/:portalId/users/:userId/deactivate
// PATCH  /api/admin/church-portals/:portalId/users/:userId/reactivate
// POST   /api/admin/church-portals/:portalId/users/:userId/resend-invite

router.get('/:portalId/users', (req, res, next) => ctrl().listUsers(req, res, next));
router.post('/:portalId/users', (req, res, next) => ctrl().createUser(req, res, next));
router.patch('/:portalId/users/:userId/deactivate', (req, res, next) => ctrl().deactivateUser(req, res, next));
router.patch('/:portalId/users/:userId/reactivate', (req, res, next) => ctrl().reactivateUser(req, res, next));
router.post('/:portalId/users/:userId/resend-invite', (req, res, next) => ctrl().resendInvite(req, res, next));

// ── App Members ────────────────────────────────────────────────────────────
// GET /api/admin/church-portals/:portalId/members  — list app users in this church
// GET /api/admin/church-portals/:portalId/report   — activity report

router.get('/:portalId/members', (req, res, next) => ctrl().listMembers(req, res, next));
router.get('/:portalId/report', (req, res, next) => ctrl().getReport(req, res, next));

export default router;
