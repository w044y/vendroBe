import { Router } from 'express';

const router = Router();

// Placeholder routes - we'll implement these later
router.post('/magic-link', (req, res) => {
    res.json({ message: 'Magic link endpoint - coming soon!' });
});

router.post('/verify', (req, res) => {
    res.json({ message: 'Verify endpoint - coming soon!' });
});

router.post('/logout', (req, res) => {
    res.json({ message: 'Logout endpoint - coming soon!' });
});

export default router;