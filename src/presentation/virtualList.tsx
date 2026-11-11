// A shared virtualized list: only the rows inside the scroll window
// (plus an overscan) are mounted in the DOM, whatever the list length.
// Row heights are measured dynamically (measureElement), so wrapping
// rows are sized correctly after mount.

import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export function VirtualList<T>({
  items,
  estimateSize,
  maxHeightClass,
  keyOf,
  renderItem,
}: {
  items: readonly T[];
  estimateSize: number;
  maxHeightClass: string;
  keyOf?: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  });
  return (
    <div ref={parentRef} className={maxHeightClass + " overflow-y-auto"}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (item === undefined) return null;
          return (
            <div
              key={keyOf !== undefined ? keyOf(item, virtualItem.index) : virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: "translateY(" + virtualItem.start + "px)",
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
