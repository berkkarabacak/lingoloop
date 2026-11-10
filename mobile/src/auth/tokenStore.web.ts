const KEY = "lingoloop.token";
export const tokenStore = {
  get: () => Promise.resolve(localStorage.getItem(KEY)),
  set: (value: string) => { localStorage.setItem(KEY, value); return Promise.resolve(); },
  clear: () => { localStorage.removeItem(KEY); return Promise.resolve(); },
};
