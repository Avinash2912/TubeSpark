import { create } from "domain";
import { ApiRouteConfig } from "motia";

// step 1: accepting the channel name and email to start workflow
export const config: ApiRouteConfig = {
  name: "Submit Channel",
  type: "api",
  path: "/submit",
  method: "POST",
  description: "Submit a new channel to be monitored",
  emits: ["yt.submit"],
};

interface SubmitRequest {
  channel: string;
  email: string;
}

export const handler = async (req: any, { emit, logger, state }: any) => {
  try {
    logger.info("Received submit request", { body: req.body });
    const { channel, email } = req.body as SubmitRequest;

    if (!channel || !email) {
      return {
        status: 400,
        body: { message: "Channel and email are required." },
      };
    }
    // validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        body: { message: "Invalid email format." },
      };
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await state.set(`job:${jobId}`, {
      jobId,
      channel,
      email,
      status: "queued",
      createdAt: new Date().toISOString(),
    });
    logger.info("Job Created", { jobId, channel, email });
    await emit({
      topic: "yt.submit",
      data: {
        jobId,
        channel,
        email,
      },
    });

    return {
      status: 201,
      body: {
        success: true,
        jobId,
        message: "Your Request has been queued for processing.You will receive an email with improved suggestions once done.",
      },
    };
  } catch (error: any) {
    logger.error("Error in submit step:", { error: error.message });

    return {
      status: 500,
      body: { message: "Internal Server Error" },
    };
  }
};
