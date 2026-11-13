import express from 'express';
import { readJsonFile, USERS_FILE } from '../lib/db.js';
import { getUserFromReq } from '../lib/security.js';

export function createSpotlightRouter({ getSpotlight, setSpotlight, clearSpotlight }) {
  const router = express.Router();

  router.get('/spotlight', (req, res) => {
    res.json({ success: true, spotlight: getSpotlight() });
  });

  const requireUser = (req, res) => {
    const user = getUserFromReq(req, readJsonFile(USERS_FILE, {}));
    if (!user) { res.status(401).json({ error: 'Login diperlukan' }); return false; }
    return true;
  };

  router.post('/spotlight', express.json(), (req, res) => {
    if (!requireUser(req, res)) return;
    setSpotlight(req.body);
    res.json({ success: true, spotlight: getSpotlight() });
  });

  router.delete('/spotlight', (req, res) => {
    if (!requireUser(req, res)) return;
    clearSpotlight();
    res.json({ success: true });
  });

  return router;
}

export default createSpotlightRouter;
