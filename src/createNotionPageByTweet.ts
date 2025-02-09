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

// ツイートの ID を URL から抽出する例
const extractId = (url: string) => {
  console.log("Extracting ID from URL:", url);
  const idStr = url.match(/status\/(\d+)/)?.[1];

  if (!idStr) {
    console.error("Error: URL does not contain a valid tweet ID", url);
    throw new Error(`idを取得できませんでした: ${url}`);
  }

  return parseInt(idStr);
};

// x.com → twitter.com に置換する例
const convertXtoTwitter = (url: string) =>
  url.replace(/^https?:\/\/x\.com/, "https://twitter.com");

export async function createNotionPageByTweet({
  text,
  createdAt,
  url,
  username,
  type,
}: Args) {
  // x.com を twitter.com に変換（必要に応じて）
  url = convertXtoTwitter(url);

  // Notion に登録するページのプロパティを設定
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
      url,
    },
    id: {
      type: "number",
      number: extractId(url),
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

  // ツイート日時があれば ISO8601 に変換してセット
  if (createdAt) {
    properties["tweet_created_at"] = {
      type: "date",
      date: {
        start: convertToISO8601(createdAt),
      },
    };
  }

  // Notion のデータベースにページを作成
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });

  console.log("Notion Page Created:", page.id);

  // 作成したページに「embed ブロック」を追加してツイートの URL を埋め込む
  try {
    await notion.blocks.children.append({
      block_id: page.id,
      children: [
        {
          object: "block",
          type: "embed",
          embed: {
            url,
          },
        },
      ],
    });
    console.log("Tweet Embed Added to Notion Page");
  } catch (error) {
    console.error("Error adding embed block:", error);
  }

  return page;
}
