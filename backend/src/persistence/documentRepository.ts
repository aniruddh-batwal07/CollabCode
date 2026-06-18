import { pool } from "../db/postgres";

export async function saveDocument(
  roomId: string,
  state: Uint8Array
) {
  await pool.query(
    `
    INSERT INTO documents (
      room_id,
      yjs_state,
      updated_at
    )
    VALUES ($1, $2, NOW())
    ON CONFLICT (room_id)
    DO UPDATE SET
      yjs_state = EXCLUDED.yjs_state,
      updated_at = NOW()
    `,
    [roomId, Buffer.from(state)]
  );
}

export async function getDocument(
  roomId: string
) {
  const result = await pool.query(
    `
    SELECT yjs_state
    FROM documents
    WHERE room_id = $1
    `,
    [roomId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return new Uint8Array(
    result.rows[0].yjs_state
  );
}