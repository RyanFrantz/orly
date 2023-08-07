// i.e. "us-east-4"
const denoRegion = Deno.env.get("DENO_REGION");
const orlySecret = Deno.env.get("ORLY_SECRET");

const allowedPaths = [
  /^loginFailed$/,
  /^loginSuccess$/,
  /^noteAdded$/,
  /^profileViewed$/,
  /^roleAdded$/,
  /^roleUpdated$/,
  /^signoutSuccess$/,
  /^signupFailed$/,
  /^signupSuccess$/,
];

// Return truthy if a match is found.
const isAllowedPath = (path) => {
  return allowedPaths.find((re) => path.match(re));
};

const handler = (req: Request): Response => {
  let responseCode = 401; // Sane default.
  const url = new URL(req.url);
  if (req.headers.has("authorization")) {
    const authzHeader = req.headers.get("authorization");
    const clientSecret = authzHeader.split(/bearer /i)[1]
    if (clientSecret == orlySecret) {
      const barePath = url.pathname.slice(1); // Strip the leading slash.
      if (isAllowedPath(barePath)) {
        // TODO: Increment counter. Use DENO_REGION as an attribute.
        console.log("metric name:", barePath);
        responseCode = 200;
      } else {
        responseCode = 418;
      }
    }
  }
  return new Response("", { status: responseCode });
};

Deno.serve({ port: 8888 }, handler);
