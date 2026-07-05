function SafeAreaLayout({ as: Component = "div", children, className = "", edges = "all", ...props }) {
  return (
    <Component className={`safe-area-layout safe-area-layout--${edges} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}

export default SafeAreaLayout;
