export function getShopPath(shopId) {
  if (!shopId) {
    return "/shops";
  }

  return `/shops/${shopId}`;
}
