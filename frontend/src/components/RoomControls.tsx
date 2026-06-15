interface RoomControlsProps {
  roomId: string;
  setRoomId: (value: string) => void;
  joinRoom: () => void;
}

export default function RoomControls({
  roomId,
  setRoomId,
  joinRoom,
}: RoomControlsProps) {
  return (
    <div className="p-4 border-b">
      <input
        className="border p-2 mr-2"
        value={roomId}
        onChange={(e) =>
          setRoomId(e.target.value)
        }
      />

      <button
        className="border px-4 py-2"
        onClick={joinRoom}
      >
        Join Room
      </button>
    </div>
  );
}