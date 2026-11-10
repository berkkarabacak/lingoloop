import base from "./app.json" with { type: "json" };

export default ({ config }) => {
  const plugins = [...(base.expo.plugins || [])];
  if (process.env.LL_LOCAL_HTTP === "1") {
    plugins.push(["expo-build-properties", { android: { usesCleartextTraffic: true } }]);
  }
  return {
    ...config,
    ...base.expo,
    plugins,
  };
};
