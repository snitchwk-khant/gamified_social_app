import { memo } from "react";
import homeSvg from "../../assets/icons/home.svg?raw";
import GemifySvgIcon from "./GemifySvgIcon";

const HomeIcon = memo(function HomeIcon(props) {
  return <GemifySvgIcon {...props} svg={homeSvg} />;
});

HomeIcon.displayName = "HomeIcon";

export default HomeIcon;
