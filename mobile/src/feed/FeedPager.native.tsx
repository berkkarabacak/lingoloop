import React, { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import type { FeedItem } from "@lingoloop/shared";

export type FeedEntry = { kind: "video"; item: FeedItem } | { kind: "end" };
interface PagerProps {
  items: FeedEntry[];
  height: number;
  onActiveChange: (index: number) => void;
  renderItem: (entry: FeedEntry, state: { isActive: boolean; isNear: boolean }) => React.ReactNode;
  onCommand: (command: "play" | "mute" | "save" | "replay") => void;
}
export function FeedPager({ items, height, onActiveChange, renderItem }: PagerProps) {
  const [active, setActive] = useState(0);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 80 }), []);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const index = viewableItems[0]?.index;
    if (index !== null && index !== undefined) { setActive(index); onActiveChange(index); }
  }, [onActiveChange]);
  return <FlatList
    data={items}
    keyExtractor={(entry) => entry.kind === "video" ? entry.item.videoId : "end"}
    pagingEnabled
    snapToInterval={height}
    snapToAlignment="start"
    decelerationRate="fast"
    disableIntervalMomentum
    showsVerticalScrollIndicator={false}
    getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
    windowSize={3}
    initialNumToRender={2}
    maxToRenderPerBatch={2}
    removeClippedSubviews
    viewabilityConfig={viewabilityConfig}
    onViewableItemsChanged={onViewableItemsChanged}
    renderItem={({ item, index }) => <View style={{ height, width: "100%", overflow: "hidden" }}>
      {renderItem(item, { isActive: index === active, isNear: Math.abs(index - active) <= 1 })}
    </View>}
  />;
}
