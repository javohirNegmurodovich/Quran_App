// api/qf/chapters.js
import { callContentApi } from "../_qf.js";

export default async function handler(req, res) {
  try {
    const data = await callContentApi("/content/api/v4/chapters");

    const chapters = (data.chapters || []).map((chapter) => ({
      number: chapter.id,
      englishName: chapter.name_simple,
      name: chapter.name_arabic,
      numberOfAyahs: chapter.verses_count,
      revelationPlace: chapter.revelation_place,
    }));

    res.status(200).json({ chapters });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load chapters from Quran Foundation",
      error: error.message,
    });
  }
}
