import { Router } from 'express';

const router = Router();

// Placeholder routes
router.get('/', (req, res) => {
    res.json({ message: 'Get trips endpoint - coming soon!' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create trip endpoint - coming soon!' });
});

export default router;