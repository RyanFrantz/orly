import { metrics } from "https://esm.sh/@opentelemetry/api@1.4.1";
import { Resource } from "https://esm.sh/@opentelemetry/resources@1.15.1";
import {
  AggregationTemporality,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "https://esm.sh/@opentelemetry/sdk-metrics@1.15.1";
// Had to fallback to an npm specifier.
import { OTLPMetricExporter } from "npm:@opentelemetry/exporter-metrics-otlp-proto@0.41.1";

const honeycombTeam = Deno.env.get("HONEYCOMB_TEAM");
const honeycombDataset = Deno.env.get("HONEYCOMB_DATASET");

// Initialize our OTLP rig and return a Meter that we can use to register
// instruments.
const initOTLP = () => {
  // Register a service.name so this isn't set as 'unknown_service'.
  const resource = Resource.default().merge(
    new Resource({
      "service.name": "trackjobs",
    }),
  );

  const metricExporter = new OTLPMetricExporter({
    url: "https://api.honeycomb.io/v1/metrics",
    headers: {
      "x-honeycomb-team": honeycombTeam,
      "x-honeycomb-dataset": honeycombDataset, // Where is this reflected?
    },
    temporalityPreference: AggregationTemporality.DELTA,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000,
  });

  const meterProvider = new MeterProvider({ resource: resource });
  meterProvider.addMetricReader(metricReader);
  metrics.setGlobalMeterProvider(meterProvider);

  const meter = metrics.getMeter("webapp");
  return meter;
};

const meter = initOTLP();

// Create an instrument to demo this in action.
const requestCounter = meter.createCounter("requests");

// i.e. "us-east-4"
const denoRegion = Deno.env.get("DENO_REGION") || "local-dev-or-digital-ocean";
const orlySecret = Deno.env.get("ORLY_SECRET") || "sane-fallback-to-prevent-matching-on-empty";

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
    const clientSecret = authzHeader.split(/bearer /i)[1];
    if (clientSecret == orlySecret) {
      const barePath = url.pathname.slice(1); // Strip the leading slash.
      if (isAllowedPath(barePath)) {
        // TODO: Increment counter. Use DENO_REGION as an attribute.
        requestCounter.add(1, { denoRegion: denoRegion });
        responseCode = 200;
      } else {
        responseCode = 418;
      }
    }
  }
  return new Response("", { status: responseCode });
};

// Stand and deliver.
Deno.serve({
  port: 443,
  cert: await Deno.readTextFile("/etc/letsencrypt/live/orly.relaymetrics.pro/fullchain.pem"),
  key: await Deno.readTextFile("/etc/letsencrypt/live/orly.relaymetrics.pro/privkey.pem"),
}, handler);
