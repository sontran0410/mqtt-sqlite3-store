# Introduction

Simple MQTT temporary store with ratelimit output for QoS 1, 2 using sqlite3.

Storing message when devices offline is one of the most important feature of IoT Gateway. [MQTT JS](https://www.npmjs.com/package/mqtt) has recommended some library like [MQTT level store](http://npm.im/mqtt-level-store), [MQTT nedb store](https://github.com/behrad/mqtt-nedb-store) and [MQTT localforage](http://npm.im/mqtt-localforage-store). Level store doesn't work well according to the [issue](https://github.com/mqttjs/MQTT.js/issues/1457) which was reported long time ago by me, Local Forage only use for browser (I'm not sure about this :D), Nedb is fine but is doesn't rate limit the output stream. In case IoT Gateway, IoT Device or something else goes offline and keep collecting data for a week, there are a lot of data will be store in the database and if we don't rate limit the stream output, a huge amount of message will be sent to MQTT broker on the server. This may lead to server become overload.

## Feature

- [x] Rate limit number of message when reconnect to mqtt broker
- [x] Store data with sqlite
- [x] Support outgoing message
- [ ] Support incomming message

## Usage

```javascript
import mqtt from "mqtt";
import SQliteStore from "mqtt-sqlite3-store";

SQliteStore.createStores("./", { rateLimit: 100 }).then((store) => {
  const client = mqtt.connect({
    host: "localhost",
    outgoingStore: store.outgoing,
  });
  client.on("connect", () => {
    console.log("connected to mqtt broker");
  });
  client.publish("test", "hello word", { qos: 2 });
});
```

## API

### SQliteStore.createStore(path: string, options: Object): Promise<Store>

Async function which create new sqlite3 file

- `path`: path to sqlite3 file location. Default `"."`

  Note: sqlite3 file will have name `outgoing`.

- `options`:
  - `rateLimit`: Amount of message allow to publish from storage per second. Default `100`.
    Note: this is not the `mqtt client` rate limit.
