// Optional Manus service values are read at use time; store operation does not require them.
export const ENV = {
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
};
