import express from 'express';

export function createSpotlightRouter({ getSpotlight, setSpotlight, clearSpotlight }) {
  const router = express.Router();

  router.get('/spotlight', (req, res) => {
    res.json({ success: true, spotlight: getSpotlight() });
  });

  router.post('/spotlight', express.json(), (req, res) => {
    setSpotlight(req.body);
    res.json({ success: true, spotlight: getSpotlight() });
  });

  router.delete('/spotlight', (req, res) => {
    clearSpotlight();
    res.json({ success: true });
  });

  return router;
}

export default createSpotlightRouter;
