import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
  return qfUserApi(req, res, "/auth/v1/users/profile?qdc=true", {
    softFail: true,
    fallbackData: null,
  });
}
