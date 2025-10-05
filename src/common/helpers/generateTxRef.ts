import { customAlphabet } from "nanoid";

/**
 *  Improve our TX ref generator to prevent possible collision
 * ~107 billion years needed in order to have a 1% chance of at least one collision
 */

const generateTxRef: (length: number, type: string) => string = (
  length = 32,
  type = "alpha-num"
) => {
  // "num", "upper", "lower", "upper-num", "lower-num", "alpha-num"
  let characters =
    "ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  if (type === "num") characters = "0123456789";
  if (type === "upper-num") characters = "ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789";
  if (type === "lower-num") characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  if (type === "upper") characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (type === "lower") characters = "abcdefghijklmnopqrstuvwxyz";
  if (type === "alpha")
    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return customAlphabet(`TX-${characters}`, length)();
};

export default generateTxRef;
