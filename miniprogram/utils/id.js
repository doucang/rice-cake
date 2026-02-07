export function randomId() {
  return Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
}

