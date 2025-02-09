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

const extractId = (url: string) => {
  console.log("Extracting ID from URL:", url);
  const idStr = url.match(/status\/(\d+)/)?.[1];

  if (!idStr) {
    console.error("Error: URL does not contain a valid tweet ID", url);
    throw new Error(`idを取得できませんでした: ${url}`);
  }

  return idStr;
};

// Twitterの埋め込みURLを生成する関数
const convertToEmbedUrl = (url: string) => {
  const tweetId = extractId(url);
  return `https://twitter.com/i/web/status/${tweetId}`;
};

export async function createNotionPageByTweet({
  text,
  createdAt,
  url,
  username,
  type,
}: Args) {
  // x.com → twitter.com に変換
  const normalizedUrl = url.replace(/^https?:\/\/x\.com/, "https://twitter.com");

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
      url: normalizedUrl,
    },
    id: {
      type: "number",
      number: parseInt(extractId(normalizedUrl)),
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

  if (createdAt) {
    properties["tweet_created_at"] = {
      type: "date",
      date: {
        start: convertToISO8601(createdAt),
      },
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });

  console.log("Notion Page Created:", page.id);

  try {
    await notion.blocks.children.append({
      block_id: page.id,
      children: [
        {
          object: "block",
          type: "embed",
          embed: {
            url: convertToEmbedUrl(normalizedUrl),
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
