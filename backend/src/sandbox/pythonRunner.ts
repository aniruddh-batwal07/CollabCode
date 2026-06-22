import Docker from "dockerode";

const docker = new Docker();

export async function runPythonCode(
  code: string
) {
  const container = (await docker.createContainer({
      Image: "python:3.12-alpine",

      Cmd: [
        "python",
        "-c",
        code,
      ],

      AttachStdout: true,
      AttachStderr: true,

      HostConfig: {
        Memory: 128 * 1024 * 1024,
        NanoCpus: 500000000,
        NetworkDisabled: true,
      } as Docker.HostConfig & { NetworkDisabled: boolean },
    })) as Docker.Container;

  await container.start();

  const stream = await container.logs({
    stdout: true,
    stderr: true,
    follow: true,
  });

  const outputPromise = new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => {
      // Docker multiplexes stdout/stderr with an 8-byte header per frame:
      // [stream_type(1), padding(3), payload_size(4), ...payload]
      const raw = Buffer.concat(chunks);
      let text = "";
      let offset = 0;
      while (offset + 8 <= raw.length) {
        const size = raw.readUInt32BE(offset + 4);
        text += raw.slice(offset + 8, offset + 8 + size).toString("utf8");
        offset += 8 + size;
      }
      resolve(text);
    });
    stream.on("error", reject);
  });

  const TIMEOUT_MS = 10_000;

  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
  );

  let output: string;
  try {
    output = await Promise.race([outputPromise, timeoutPromise]);
  } catch (err: any) {
    await container.remove({ force: true });
    if (err.message === "TIMEOUT") {
      return "Execution timed out (10s limit exceeded).";
    }
    throw err;
  }

  await container.remove({
    force: true,
  });

  return output;
}