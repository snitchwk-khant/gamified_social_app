import { memo } from "react";
import messagesSvg from "../../assets/icons/messages.svg?raw";
import GemifySvgIcon from "./GemifySvgIcon";

const MessagesIcon = memo(function MessagesIcon(props) {
  return <GemifySvgIcon {...props} svg={messagesSvg} />;
});

MessagesIcon.displayName = "MessagesIcon";

export default MessagesIcon;
