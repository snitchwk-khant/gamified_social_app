import { io } from "socket.io-client";
import { WS_URL } from "../config/app_config";

const socket = io(WS_URL, {
  transports: ["websocket"],
  autoConnect: false,
});

export default socket;
