import { memo } from "react";
import profileSvg from "../../assets/icons/profile.svg?raw";
import GemifySvgIcon from "./GemifySvgIcon";

const ProfileIcon = memo(function ProfileIcon(props) {
  return <GemifySvgIcon {...props} svg={profileSvg} />;
});

ProfileIcon.displayName = "ProfileIcon";

export default ProfileIcon;
