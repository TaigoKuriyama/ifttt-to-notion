import { Client } from "@notionhq/client";
import { convertToISO8601 } from "./convertToISO8601";
import { parseTextAndUrl } from "./parseTextAndUrl";

type Args = {
  text: string;
  username: string;
  url: string;
  createdAt?: string;
  type: "tweet" | "like";
};

const apiKey = process.env.NOTION_API_KEY;
const databaseId = process.env.NOTION_DATABASE_ID!;

if (!databaseId) {
  throw new Error("DATABASE_ID が設定されていません");
}

const notion = new Client({ auth: apiKey });

/**
 * URL からツイートIDを抽出する
 */
const extractId = (url: string) => {
  console.log("Extracting ID from URL:", url);
  const idStr = url.match(/status\/(\d+)/)?.[1];

  if (!idStr) {
    console.error("Error: URL does not contain a valid tweet ID", url);
    throw new Error(`ツイートIDを取得できませんでした: ${url}`);
  }

  return idStr;
};

/**
 * x.com → twitter.com に変換する
 */
const normalizeTwitterUrl = (url: string) => {
  return url.replace(/^https?:\/\/x\.com/, "https://twitter.com");
};

/**
 * ユーザー名＋status 形式の埋め込みURLを生成
 */
const buildTweetUrl = (username: string, tweetId: string) => {
  return `https://twitter.com/${username}/status/${tweetId}`;
};

export async function createNotionPageByTweet({
  text,
  createdAt,
  url,
  username,
  type,
}: Args) {
  try {
    // URLを正規化
    const normalizedUrl = normalizeTwitterUrl(url);
    const tweetId = extractId(normalizedUrl);
    const tweetUrl = buildTweetUrl(username, tweetId);

    console.log("Processed Tweet URL:", tweetUrl);

    // Notionに追加するプロパティ
    const properties: Parameters<typeof notion.pages.create>[0]["properties"] = {
      title: {
        title: [
          {
            text: {
              content: text,
            },
          },
        ],
      },
      text: {
        type: "rich_text",
        rich_text: await parseTextAndUrl(text),
      },
      url: {
        url: url,
      },
      id: {
        type: "number",
        number: parseInt(tweetId),
      },
      username: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: username,
              link: {
                url: `https://twitter.com/${username}`,
              },
            },
          },
        ],
      },
      type: {
        type: "select",
        select: { name: type },
      },
    };

    // ツイートの作成日時を追加
    if (createdAt) {
      properties["tweet_created_at"] = {
        type: "date",
        date: {
          start: convertToISO8601(createdAt),
        },
      };
    }

    // Notionページ作成
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });

    console.log("✅ Notion Page Created:", page.id);

    // ツイートの埋め込みを追加
    await notion.blocks.children.append({
      block_id: page.id,
      children: [
        {
          object: "block",
          type: "embed",
          embed: {
            url: tweetUrl,
          },
        },
      ],
    });

    console.log("✅ Tweet Embed Added to Notion Page");

    return page;
  } catch (error) {
    console.error("❌ Error creating Notion page or embedding tweet:", error);
    throw error;
  }
}
