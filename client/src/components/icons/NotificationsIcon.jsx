import { memo } from "react";
import notificationsSvg from "../../assets/icons/notifications.svg?raw";
import GemifySvgIcon from "./GemifySvgIcon";

const NotificationsIcon = memo(function NotificationsIcon(props) {
  return <GemifySvgIcon {...props} svg={notificationsSvg} />;
});

NotificationsIcon.displayName = "NotificationsIcon";

export default NotificationsIcon;
