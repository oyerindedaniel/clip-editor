function debounce<F extends (...args: any[]) => void>(func: F, delay: number) {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = function (...args: Parameters<F>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as F & { cancel: () => void };
}

function formatDurationDisplay(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
}

const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(
      seconds % 60
    )
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
};

export { debounce, formatDurationDisplay, formatTime };
