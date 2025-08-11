import { Router } from 'express';

const router = Router();

// Placeholder routes
router.get('/', (req, res) => {
    res.json({ message: 'Get spots endpoint - coming soon!' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create spot endpoint - coming soon!' });
});

router.get('/nearby', (req, res) => {
    res.json({ message: 'Nearby spots endpoint - coming soon!' });
});

export default router;