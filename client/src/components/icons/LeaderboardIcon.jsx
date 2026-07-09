import { memo } from "react";
import leaderboardSvg from "../../assets/icons/leaderboard.svg?raw";
import GemifySvgIcon from "./GemifySvgIcon";

const LeaderboardIcon = memo(function LeaderboardIcon(props) {
  return <GemifySvgIcon {...props} svg={leaderboardSvg} />;
});

LeaderboardIcon.displayName = "LeaderboardIcon";

export default LeaderboardIcon;
