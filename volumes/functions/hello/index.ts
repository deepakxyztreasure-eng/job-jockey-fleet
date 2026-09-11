import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  return new Response("Hello from Edge Functions!", {
    headers: { "Content-Type": "text/plain" },
  });
});
