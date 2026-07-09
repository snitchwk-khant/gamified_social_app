import { forwardRef, memo } from "react";

function getIconSizeValue(size) {
  return typeof size === "number" ? `${size}px` : size;
}

const GemifySvgIcon = memo(
  forwardRef(function GemifySvgIcon(
    { active = false, className = "", height = 26, svg, style, width = 26, ...props },
    ref
  ) {
    const iconWidth = getIconSizeValue(width);
    const iconHeight = getIconSizeValue(height);

    return (
      <span
        {...props}
        ref={ref}
        className={`inline-flex shrink-0 items-center justify-center leading-none transition-transform duration-200 ease-out ${
          active ? "scale-110" : "scale-100"
        } ${className}`}
        style={{ width: iconWidth, height: iconHeight, ...style }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  })
);

GemifySvgIcon.displayName = "GemifySvgIcon";

export default GemifySvgIcon;
