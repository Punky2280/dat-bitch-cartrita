import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import pool from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

// Rotation scheduling & history (MVP stub)
// Provides CRUD for rotation policies and listing rotation events.
// NOTE: Actual secure rotation execution logic will reside in a future service / job runner.

const router = express.Router();

let rotationMetricsInit = false;
function ensureMetrics(){
  if(rotationMetricsInit) return;
  try {
    global.otelCounters = global.otelCounters || {};
    global.otelCounters.rotationPolicyCrud = OpenTelemetryTracing.createCounter('rotation_policy_crud_total','Rotation policy CRUD ops (labels: action, result)');
    global.otelCounters.rotationEventsTotal = OpenTelemetryTracing.createCounter('rotation_events_total','Credential rotation events recorded (labels: result)');
    rotationMetricsInit = true;
  } catch(e){ /* ignore */ }
}
ensureMetrics();

// GET /api/vault/rotation/policies - list policies (simple join)
router.get('/policies', authenticateToken, async (req,res) => {
  const span = OpenTelemetryTracing.traceOperation('vault.rotation.listPolicies');
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT id, credential_id, interval_days, auto_rotate, grace_period_days, last_rotated_at, next_rotation_at, status, created_at, updated_at
      FROM credential_rotation_policies
      WHERE user_id = $1
      ORDER BY next_rotation_at NULLS LAST, created_at DESC
    `,[userId]);
    res.json({ success:true, policies: result.rows });
  } catch(err){
    console.error('List rotation policies error', err);
    res.status(500).json({ success:false, error:'failed_to_list_policies' });
  } finally { span.end(); }
});

// POST /api/vault/rotation/policies - create/update policy (upsert by credential_id)
router.post('/policies', authenticateToken, async (req,res) => {
  const span = OpenTelemetryTracing.traceOperation('vault.rotation.upsertPolicy');
  const { credential_id, interval_days=90, auto_rotate=true, grace_period_days=5 } = req.body || {};
  if(!credential_id) return res.status(400).json({ success:false, error:'credential_id_required' });
  try {
    const userId = req.user.id;
    const now = new Date();
    const nextRotationAt = new Date(Date.now() + interval_days*24*60*60*1000);
    const result = await pool.query(`
      INSERT INTO credential_rotation_policies
        (user_id, credential_id, interval_days, auto_rotate, grace_period_days, next_rotation_at, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$7)
      ON CONFLICT (credential_id)
      DO UPDATE SET interval_days=EXCLUDED.interval_days, auto_rotate=EXCLUDED.auto_rotate, grace_period_days=EXCLUDED.grace_period_days, next_rotation_at=EXCLUDED.next_rotation_at, updated_at=EXCLUDED.updated_at
      RETURNING *
    `,[userId, credential_id, interval_days, auto_rotate, grace_period_days, nextRotationAt, now]);
    global.otelCounters.rotationPolicyCrud.add(1,{ action:'upsert', result:'success'});
    res.json({ success:true, policy: result.rows[0] });
  } catch(err){
    console.error('Upsert rotation policy error', err);
    global.otelCounters.rotationPolicyCrud.add(1,{ action:'upsert', result:'error'});
    res.status(500).json({ success:false, error:'failed_to_upsert_policy' });
  } finally { span.end(); }
});

// DELETE /api/vault/rotation/policies/:id
router.delete('/policies/:id', authenticateToken, async (req,res) => {
  const span = OpenTelemetryTracing.traceOperation('vault.rotation.deletePolicy');
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM credential_rotation_policies WHERE id=$1 AND user_id=$2 RETURNING id`,[id,userId]);
    if(result.rowCount === 0) return res.status(404).json({ success:false, error:'policy_not_found' });
    global.otelCounters.rotationPolicyCrud.add(1,{ action:'delete', result:'success'});
    res.json({ success:true, id: parseInt(id,10) });
  } catch(err){
    console.error('Delete rotation policy error', err);
    global.otelCounters.rotationPolicyCrud.add(1,{ action:'delete', result:'error'});
    res.status(500).json({ success:false, error:'failed_to_delete_policy' });
  } finally { span.end(); }
});

// GET /api/vault/rotation/events - list recent rotation events (placeholder, table may not exist yet)
router.get('/events', authenticateToken, async (req,res) => {
  const span = OpenTelemetryTracing.traceOperation('vault.rotation.listEvents');
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit,10)||50,200);
    const result = await pool.query(`
      SELECT id, credential_id, status, message, started_at, completed_at
      FROM credential_rotation_events
      WHERE user_id=$1
      ORDER BY started_at DESC
      LIMIT $2
    `,[userId, limit]);
    res.json({ success:true, events: result.rows });
  } catch(err){
    console.warn('Rotation events table may be missing', err.message);
    res.json({ success:true, events: [] });
  } finally { span.end(); }
});

export default router;
