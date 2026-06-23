import { pool } from "../db/postgres";
import { saveDocument, getDocument } from "../persistence/documentRepository";

jest.mock("../db/postgres", () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
});

describe("saveDocument", () => {
  it("upserts the document state into the database", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const state = new Uint8Array([1, 2, 3]);
    await saveDocument("room-1", state);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO documents/i);
    expect(params[0]).toBe("room-1");
    expect(Buffer.isBuffer(params[1])).toBe(true);
  });

  it("passes state as a Buffer to pg", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const state = new Uint8Array([10, 20, 30]);
    await saveDocument("room-2", state);

    const params = mockQuery.mock.calls[0][1];
    expect(params[1]).toEqual(Buffer.from(state));
  });
});

describe("getDocument", () => {
  it("returns null when the room has no document", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getDocument("nonexistent-room");
    expect(result).toBeNull();
  });

  it("returns a Uint8Array of the stored state when found", async () => {
    const stored = Buffer.from([5, 6, 7]);
    mockQuery.mockResolvedValueOnce({ rows: [{ yjs_state: stored }] });

    const result = await getDocument("room-1");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array(stored));
  });
});
