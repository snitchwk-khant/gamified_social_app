import { Server } from "socket.io";

export default function setupSocket(server, origin) {
  const onlineUsers = new Map();
  const io = new Server(server, {
    cors: {
      origin,
      methods: ["GET", "POST", "PATCH", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("user:online", (user) => {
      if (!user?.id) return;
      onlineUsers.set(socket.id, user);
      io.emit("users:online", Array.from(onlineUsers.values()));
    });

    socket.on("chat:join", (roomId = "company") => {
      socket.join(roomId);
    });

    socket.on("chat:message", ({ roomId = "company", message }) => {
      io.to(roomId).emit("chat:message", message);
    });

    socket.on("post_message", (message) => {
      io.emit("feed_update", message);
    });

    socket.on("notification:send", (notification) => {
      io.emit("notification:new", notification);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      io.emit("users:online", Array.from(onlineUsers.values()));
    });
  });

  return io;
}
