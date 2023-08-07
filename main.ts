const handler = (req: Request): Response => {
  console.log(req.headers);
  return new Response("Hello, world!");
};

console.log(Object.fromEntries(Object.entries(Deno.env.toObject()).sort()));
Deno.serve({ port: 8888 }, handler);
