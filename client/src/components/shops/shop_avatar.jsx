import { useState } from "react";
import { FiShoppingBag } from "react-icons/fi";

const SIZE_CLASSES = {
  xs: "h-9 w-9 text-xs",
  sm: "h-11 w-11 text-sm",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-2xl",
  hero: "h-28 w-28 text-4xl sm:h-32 sm:w-32",
};

function ShopAvatar({
  shop,
  src,
  name,
  size = "md",
  isDark = false,
  className = "",
  imageClassName = "",
  loading = "lazy",
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = src || shop?.avatar_url || shop?.avatarUrl || "";
  const shopName = name || shop?.name || shop?.shopName || "Shop";
  const shouldShowImage = Boolean(avatarUrl && !imageFailed);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span
      className={`relative flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border font-bold shadow-sm ${
        isDark
          ? "border-slate-800 bg-slate-900 text-slate-300"
          : "border-slate-200 bg-[#f6e8ff] text-[#c446ff]"
      } ${className}`}
      aria-label={`${shopName} avatar`}
    >
      {shouldShowImage ? (
        <>
          {!imageLoaded ? (
            <span className={`absolute inset-0 animate-pulse ${isDark ? "bg-slate-800" : "bg-slate-100"}`} />
          ) : null}
          <img
            src={avatarUrl}
            alt={shopName}
            loading={loading}
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
            className={`h-full w-full object-cover transition-opacity duration-200 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            } ${imageClassName}`}
          />
        </>
      ) : (
        <FiShoppingBag className="h-1/2 w-1/2" aria-hidden="true" />
      )}
    </span>
  );
}

export default ShopAvatar;
