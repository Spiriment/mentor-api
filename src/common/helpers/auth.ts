export const generateOTP = (length: number = 6) => {
  return Math.floor(
    10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)
  );
};

export const generatePassword = (length: number = 8) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};
