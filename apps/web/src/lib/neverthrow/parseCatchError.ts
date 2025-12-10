export const parseCatchError = (error: Error | unknown, message?: string) => {
  if (error instanceof Error) {
    return error.message;
  }

  return message ?? "Unknown error occurred";
};
