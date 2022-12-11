import mqtt from "mqtt";
import SQliteStore from "./store/index.js";

SQliteStore.createStores("./", { rateLimit: 1 }).then((store) => {
  const client = mqtt.connect({
    host: "172.23.98.26",
    outgoingStore: store.outgoing,
  });
  client.on("connect", () => {
    console.log("connected to mqtt broker");
  });
  let i = 0;
  setInterval(() => {
    client.publish("test", "hello word " + i, { qos: 2 });
    i++;
  }, 100);
});
