import { Transform } from "./keyframe";

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }

  const protoA = Object.getPrototypeOf(a);
  const protoB = Object.getPrototypeOf(b);
  const bothPlain =
    (protoA === Object.prototype || protoA === null) &&
    (protoB === Object.prototype || protoB === null);

  const ownKeys =
    typeof Reflect !== "undefined" && typeof Reflect.ownKeys === "function"
      ? Reflect.ownKeys
      : (obj: any) => Object.keys(obj);

  const keysA = bothPlain ? Object.keys(a) : ownKeys(a);
  const keysB = bothPlain ? Object.keys(b) : ownKeys(b);

  if (keysA.length !== keysB.length) return false;

  const hasOwn = Object.prototype.hasOwnProperty;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!hasOwn.call(b, key) || !Object.is((a as any)[key], (b as any)[key])) {
      return false;
    }
  }

  return true;
}

function equalTransform(a: Transform, b: Transform): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.scale === b.scale &&
    a.normX === b.normX &&
    a.normY === b.normY
  );
}

export { shallowEqual, equalTransform };
