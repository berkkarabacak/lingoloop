export function safePlay(player: { play: () => unknown }) {
  const mounted = (player as any)._mountedVideos as Set<HTMLVideoElement> | undefined;
  if (mounted?.size) {
    mounted.forEach((video) => safePlay(video));
    return;
  }
  try {
    const result = player.play() as Promise<void> | undefined;
    if (result && typeof result.catch === "function") {
      void result.catch((error) => {
        // Navigating or switching cards can intentionally interrupt autoplay.
        if (error?.name !== "AbortError") console.error(error);
      });
    }
  } catch (error) {
    if ((error as Error)?.name !== "AbortError") throw error;
  }
}
