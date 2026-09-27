import type { ReactNode } from "react";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** API sort key; makes the header a sort toggle. */
  sortKey?: string;
  /** Applied to header and cells. */
  className?: string;
  /** Hidden below the md breakpoint (the table also scrolls horizontally). */
  hideOnMobile?: boolean;
  align?: "left" | "right";
}
