import { qfUserApi } from "../_qfOAuth.js";

export default async function handler(req, res) {
  return qfUserApi(
    req,
    res,
    "/auth/v1/streaks?type=QURAN&status=ACTIVE&first=20&orderBy=startDate&sortOrder=desc",
    { softFail: true, fallbackData: [] },
  );
}
