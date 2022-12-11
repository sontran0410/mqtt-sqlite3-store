import mqtt from "mqtt";
import SQliteStore from "./store/index.js";

SQliteStore.create("./", { rateLimit: 100 }).then((store) => {
  const client = mqtt.connect({
    host: "172.23.98.26",
    outgoingStore: store.outgoing,
  });
  client.on("connect", () => {
    console.log("connected to mqtt broker");
  });
  client.publish("test", "hello word", { qos: 2 });
});
