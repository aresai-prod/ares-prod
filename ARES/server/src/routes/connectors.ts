import { Router } from "express";
import { testLocalSqlConnection } from "../connectors/localSql.js";
import { testMysqlConnection } from "../connectors/mysql.js";
import { testPostgresConnection } from "../connectors/postgres.js";
import { testFirebaseConnection } from "../connectors/firebase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/local-sql", requireAuth, async (req, res) => {
  const { connectionString } = req.body as { connectionString?: string };
  if (!connectionString) {
    return res.status(400).json({ error: "connectionString is required." });
  }

  try {
    const ok = await testLocalSqlConnection({ connectionString });
    return res.json({ ok });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Connection failed." });
  }
});

router.post("/firebase", requireAuth, async (req, res) => {
  const { projectId, serviceAccountJson } = req.body as {
    projectId?: string;
    serviceAccountJson?: string;
  };
  if (!projectId || !serviceAccountJson) {
    return res.status(400).json({ error: "projectId and serviceAccountJson are required." });
  }

  try {
    const ok = await testFirebaseConnection({ projectId, serviceAccountJson });
    return res.json({ ok });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Connection failed." });
  }
});

router.post("/postgres", requireAuth, async (req, res) => {
  const { connectionString } = req.body as { connectionString?: string };
  if (!connectionString) {
    return res.status(400).json({ error: "connectionString is required." });
  }

  try {
    const ok = await testPostgresConnection(connectionString);
    return res.json({ ok });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Connection failed." });
  }
});

router.post("/mysql", requireAuth, async (req, res) => {
  const { connectionString } = req.body as { connectionString?: string };
  if (!connectionString) {
    return res.status(400).json({ error: "connectionString is required." });
  }

  try {
    const ok = await testMysqlConnection(connectionString);
    return res.json({ ok });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Connection failed." });
  }
});

export default router;
