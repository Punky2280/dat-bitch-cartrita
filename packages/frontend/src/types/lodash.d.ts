declare module 'lodash' {
  export function debounce<T extends (...args: any[]) => any>(fn: T, wait?: number): T;
}
