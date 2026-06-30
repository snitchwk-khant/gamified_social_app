export function getProfilePath(profileId, currentUserId = "") {
  if (!profileId) {
    return "/profile";
  }

  return profileId === currentUserId ? "/profile" : `/profile/${profileId}`;
}
