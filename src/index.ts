import * as functions from "@google-cloud/functions-framework";
import { createNotionPageByTweet } from "./createNotionPageByTweet";

type RequestBody = {
  text: string;
  userName: string;
  linkToTweet: string;
  createdAt: string;
  type: "tweet" | "like";
  tweetEmbedCode?: string;
};

const accessToken = process.env.ACCESS_TOKEN;

export const iftttToNotion = functions.http(
  "iftttToNotion",
  async (req: functions.Request, res: functions.Response) => {
    // 認証チェック
    if (req.headers.authorization !== `Bearer ${accessToken}`) {
      const error = { status: 401, message: "Unauthorized" };
      console.error(error);
      res.status(401).json(error);
      return;
    }

    const body: RequestBody = req.body;

    try {
      const response = await createNotionPageByTweet({
        text: body.text,
        createdAt: body.createdAt,
        type: body.type,
        url: body.linkToTweet,
        username: body.userName,
        tweetEmbedCode: body.tweetEmbedCode,
      });
      console.log("New page created:", response);
      res.json(response);
    } catch (error: any) {
      console.error("Error:", error);
      res.status(500).json({ message: "Internal Server Error", error });
    }
  }
);
