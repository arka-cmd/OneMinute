import { useState } from 'react';

interface RoomControlsProps {
  isConnected: boolean;
  currentRoom: string;
  onCreateRoom: (username: string) => void;
  onJoinRoom: (roomId: string, roomKey: string, username: string) => void;
}

function RoomControls({ isConnected, currentRoom, onCreateRoom, onJoinRoom }: RoomControlsProps) {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinRoomKey, setJoinRoomKey] = useState('');
  const [joinUsername, setJoinUsername] = useState('');

  if (currentRoom !== 'global') {
    return null; // Don't show controls when already in a private room
  }

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const username = createUsername.trim() || 'Host';
    onCreateRoom(username);
    setCreateUsername('');
    setShowCreateRoom(false);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const roomId = joinRoomId.trim();
    const roomKey = joinRoomKey.trim();
    const username = joinUsername.trim() || 'Guest';

    if (!roomId || !roomKey) {
      alert('Room ID and Key are required');
      return;
    }

    onJoinRoom(roomId, roomKey, username);
    setJoinRoomId('');
    setJoinRoomKey('');
    setJoinUsername('');
    setShowJoinRoom(false);
  };

  return (
    <div className="border-t border-white/10 bg-black/10 p-3">
      <div className="max-w-4xl mx-auto">
        {/* ✅ NEW: Private Rooms heading */}
        <div className="text-center text-sm text-white/60 mb-2">
          Private Rooms
        </div>

        {/* Action Buttons */}
        {!showCreateRoom && !showJoinRoom && (
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowCreateRoom(true)}
              disabled={!isConnected}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-white rounded-lg transition-colors border border-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Create Private Room
            </button>
            <button
              onClick={() => setShowJoinRoom(true)}
              disabled={!isConnected}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
          </div>
        )}

        {/* Create Room Form */}
        {showCreateRoom && (
          <form onSubmit={handleCreateRoom} className="space-y-3">
            <div className="text-sm text-white/70 text-center">Create a private room</div>
            <input
              type="text"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              placeholder="Your username (optional)"
              maxLength={20}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/50"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-white rounded-lg transition-colors border border-cyan-400/30"
              >
                Create Room
              </button>
              <button
                type="button"
                onClick={() => setShowCreateRoom(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors border border-white/20"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Join Room Form */}
        {showJoinRoom && (
          <form onSubmit={handleJoinRoom} className="space-y-3">
            <div className="text-sm text-white/70 text-center">Join a private room</div>
            <input
              type="text"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="Room ID"
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/50"
            />
            <input
              type="text"
              value={joinRoomKey}
              onChange={(e) => setJoinRoomKey(e.target.value)}
              placeholder="Room Key"
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/50"
            />
            <input
              type="text"
              value={joinUsername}
              onChange={(e) => setJoinUsername(e.target.value)}
              placeholder="Your username (optional)"
              maxLength={20}
              className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/50"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-white rounded-lg transition-colors border border-cyan-400/30"
              >
                Join Room
              </button>
              <button
                type="button"
                onClick={() => setShowJoinRoom(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors border border-white/20"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default RoomControls;
