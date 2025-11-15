import { EventConfig } from "motia";

// converts youtube handle to channle id from youtube api
export const config: EventConfig = {
  name: "ResolveChannel",
  type: "event",
  subscribes: ["yt.submit"],
  description: "Resolve YouTube channel handle to channel ID",
  emits: ["yt.channel.resolved", "yt.channel.resolve.error"],
};

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    const channel = data.channel;
    logger.info("Resolving channel", { jobId, channel });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not set in environment variables");
    }

    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "resolving_channel",
    });

    let channelId: string | null = null;
    let channelName: string | null = null;

    if (channel.startsWith("@")) {
      const handle = channel.substring(1);
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
        handle
      )}&key=${YOUTUBE_API_KEY}`;

      const response = await fetch(searchUrl);
      const result = await response.json();

      if (result.items && result.items.length > 0) {
        channelId = result.items[0].snippet.channelId;
        channelName = result.items[0].snippet.channelTitle;
      }
    } else {
      // Try a general search by provided channel string (name or id)
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
        channel
      )}&key=${YOUTUBE_API_KEY}`;
      const response = await fetch(searchUrl);
      const result = await response.json();

      if (result.items && result.items.length > 0) {
        channelId = result.items[0].snippet.channelId;
        channelName = result.items[0].snippet.channelTitle;
      } else {
        throw new Error("Channel not found for the given name or id");
      }
    }

    if (!channelId) {
      logger.error("Failed to resolve channel ID", { channel });

      await state.set(`job:${jobId}`, {
        ...jobData,
        status: "error",
        error: "Channel not found for the given handle or name ",
      });
    }

    await emit({
      topic: "yt.channel.error",
      data: {
        jobId,
        email,
      },
    });

    return;

    // Update job state and emit success
  } catch (error: any) {
    logger.error("Error in Resolving Channel ", { error: error.message });

    if (!jobId || !email) {
      logger.error("Missing jobId or email");
      return;
    }

    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "error",
      error: (error as Error).message || "Unknown error",
    });

    if (!jobData) {
      logger.error("Job data not found in state", { jobId });
      return;
    }

    await emit({
      topic: "yt.channel.resolve.error",
      data: {
        jobId,
        email,
        error:
          (error as Error).message ||
          "Failed to resolve channel, Please try again later.",
      },
    });
  }
};
