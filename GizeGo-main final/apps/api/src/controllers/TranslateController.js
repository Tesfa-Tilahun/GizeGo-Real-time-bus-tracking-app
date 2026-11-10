import { z } from "zod";
import { googleCloudTranslateTexts } from "../services/googleCloudTranslate.js";
import { env } from "../config/env.js";

const bodySchema = z.object({
  texts: z.array(z.string().max(5000)).min(1).max(50),
  source: z.enum(["en", "am"]).optional(),
  target: z.enum(["en", "am"]),
});

export class TranslateController {
  translateBatch = async (req, res) => {
    const body = bodySchema.parse(req.body);
    const translations = await googleCloudTranslateTexts({
      texts: body.texts,
      source: body.source,
      target: body.target,
      apiKey: env.googleCloudTranslationsApiKey,
    });
    res.status(200).json({ translations });
  };
}
