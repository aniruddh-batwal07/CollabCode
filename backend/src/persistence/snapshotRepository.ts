import { pool } from "../db/postgres";
import * as Y from "yjs";

export async function createSnapshot(
  roomId: string,
  mergedUpdate: Uint8Array
) {
  // Apply the merged update to a temporary doc and encode the
  // full document state. This produces a self-contained snapshot
  // that can be applied to ANY doc (even one with prior history)
  // without Yjs treating the ops as already-seen duplicates.
  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, mergedUpdate);
  const fullState = Y.encodeStateAsUpdate(tempDoc);
  tempDoc.destroy();

  await pool.query(
    `
    INSERT INTO snapshots (
      room_id,
      yjs_state
    )
    VALUES ($1, $2)
    `,
    [roomId, Buffer.from(fullState)]
  );
}

export async function getSnapshots(
  roomId: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      created_at
    FROM snapshots
    WHERE room_id = $1
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [roomId]
  );

  return result.rows;
}

export async function getSnapshotById(
  id: number
) {
  const result = await pool.query(
    `
    SELECT yjs_state
    FROM snapshots
    WHERE id = $1
    `,
    [id]
  );

  if (!result.rows.length) {
    return null;
  }

  return new Uint8Array(
    result.rows[0].yjs_state
  );
}