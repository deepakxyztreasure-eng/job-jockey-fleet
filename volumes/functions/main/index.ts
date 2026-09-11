import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

console.log("Edge Runtime Main Router initialized");

serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0];

  if (!functionName) {
    return new Response(
      JSON.stringify({ error: "Missing function name in request URL" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const servicePath = `/home/deno/functions/${functionName}/index.ts`;

  try {
    const memoryLimitMb = 150;
    const workerTimeoutMs = 10 * 60 * 1000;
    const noModuleCache = false;
    const importMapPath = null;
    const envVarsObj = Deno.env.toObject();
    const envVars = Object.keys(envVarsObj).map((k) => [k, envVarsObj[k]]);

    // @ts-ignore
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb,
      workerTimeoutMs,
      noModuleCache,
      importMapPath,
      envVars,
    });

    return await worker.fetch(req);
  } catch (err: any) {
    console.error(`Error invoking function ${functionName}:`, err);
    return new Response(
      JSON.stringify({ error: err.message || "Worker creation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
