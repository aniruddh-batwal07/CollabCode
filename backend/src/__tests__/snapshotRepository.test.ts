import { pool } from "../db/postgres";
import {
  createSnapshot,
  getSnapshots,
  getSnapshotById,
} from "../persistence/snapshotRepository";

jest.mock("../db/postgres", () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
});

describe("createSnapshot", () => {
  it("encodes a full Y.Doc state and inserts it into the snapshots table", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const update = new Uint8Array([0, 0, 0]);
    await createSnapshot("room-1", update);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO snapshots/i);
    expect(params[0]).toBe("room-1");
    expect(Buffer.isBuffer(params[1])).toBe(true);
  });
});

describe("getSnapshots", () => {
  it("returns an array of snapshot metadata for a room", async () => {
    const rows = [
      { id: 2, created_at: new Date("2024-01-02") },
      { id: 1, created_at: new Date("2024-01-01") },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await getSnapshots("room-1");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2);
  });

  it("returns an empty array when a room has no snapshots", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getSnapshots("empty-room");
    expect(result).toEqual([]);
  });
});

describe("getSnapshotById", () => {
  it("returns a Uint8Array when the snapshot exists", async () => {
    const stored = Buffer.from([1, 2, 3, 4]);
    mockQuery.mockResolvedValueOnce({ rows: [{ yjs_state: stored }] });

    const result = await getSnapshotById(42);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array(stored));
  });

  it("returns null when the snapshot does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getSnapshotById(999);
    expect(result).toBeNull();
  });
});
