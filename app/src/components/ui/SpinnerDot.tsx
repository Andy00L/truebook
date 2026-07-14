/** One orbiting dot; pairs with a short pending label next to it. */
export function SpinnerDot() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block size-4 flex-none animate-spin-dot"
    >
      <span className="absolute left-1/2 top-0 -ml-[3px] size-1.5 rounded-full bg-current" />
    </span>
  );
}
