function debounce<F extends (...args: any[]) => void>(func: F, delay: number) {
  let timeoutId: NodeJS.Timeout;

  return function (...args: Parameters<F>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export { debounce };
