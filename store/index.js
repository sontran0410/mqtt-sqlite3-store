import { DataTypes, Model, Sequelize } from "sequelize";
import sqlite3 from "sqlite3";
import { Readable } from "readable-stream";
import path from "path";
import os from "os";
import fs from "fs";
import PQueue from "p-queue";

async function delay(ms) {
  return await new Promise((resolve) => setInterval(resolve, ms));
}

async function Sqlite3StoreFactory(sequelize) {
  // create new schema
  class Sqlite3Store extends Model {}

  Sqlite3Store.init(
    {
      messageId: {
        type: DataTypes.NUMBER,
        primaryKey: true,
      },
      cmd: {
        type: DataTypes.STRING,
      },
      topic: {
        type: DataTypes.STRING,
      },
      payload: {
        type: DataTypes.STRING,
      },
      qos: {
        type: DataTypes.INTEGER,
      },
      retain: {
        type: DataTypes.BOOLEAN,
      },
      dup: {
        type: DataTypes.BOOLEAN,
      },
    },
    { sequelize, timestamps: false }
  );
  await sequelize.sync();
  return Sqlite3Store;
}

const noop = () => {};
class Store {
  ready = false;
  constructor(options, store) {
    this._options = options;
    this.store = store;
  }
  static async createStore(options) {
    const sequelize = new Sequelize({
      dialect: "sqlite",
      storage: path.join(options.filename),
      logging: false,
      dialectModule: sqlite3,
    });
    const store = await Sqlite3StoreFactory(sequelize);
    return new Store(options, store);
  }
  put(packet, _cb) {
    const cb = _cb || noop;

    this.store
      .findOne({ where: { messageId: packet.messageId } })
      .then((_packet) => {
        if (_packet) {
          _packet
            .update(packet)
            .then(() => {
              cb(null, packet);
            })
            .catch((err) => {
              cb(err, null);
            });
        } else {
          this.store
            .create(packet)
            .then(() => {
              cb(null, packet);
            })
            .catch((err) => {
              cb(err, null);
            });
        }
      })
      .catch((err) => {
        cb(err, null);
      });
    return this;
  }
  createStream() {
    const stream = new Readable({ objectMode: true });
    const options = this._options;
    let destroyed = false,
      db = this.store;

    stream._read = function () {
      const queue = new PQueue({ concurrency: 1 });
      const that = this;
      db.findAll()
        .then((packets) => {
          if (destroyed || !packets || 0 === packets.length) {
            return that.push(null);
          }
          packets.forEach(function (packet) {
            queue.add(async () => {
              await delay(1000 / (options.rateLimit || 1));
              that.push(packet.toJSON());
            });
          });
          //end of stream
          queue.add(() => that.push(null));
        })
        .catch((err) => {
          if (err) {
            return this.push(err);
          }
        });
    };
    stream.destroy = function () {
      if (destroyed) {
        return;
      }
      var self = this;
      destroyed = true;
      process.nextTick(function () {
        self.emit("close");
      });
    };
    return stream;
  }
  del(packet, _cb) {
    const cb = _cb || noop;
    const that = this;
    this.get(packet, function (err, packetInDb) {
      if (err) {
        return cb(err);
      }
      that.store
        .destroy({ where: { messageId: packet.messageId } })
        .then(() => {
          cb(null, packetInDb);
        })
        .catch((err) => {
          cb(err, packetInDb);
        });
    });
    return this;
  }
  get(packet, _cb) {
    const cb = _cb || noop;
    this.store
      .findOne({ where: { messageId: packet.messageId } })
      .then((packet) => {
        if (packet) {
          cb(null, packet.toJSON());
        } else {
          cb(new Error("missing packet"));
        }
      })
      .catch((err) => {
        cb(err);
      });
  }
  close(cb) {
    cb = cb || noop;
    cb();
    return this;
  }
}

class SQliteStore {
  static async createStores(_path, options) {
    if ("object" === typeof _path) {
      options = _path;
      _path = null;
    }
    if (!_path) {
      _path = path.join(os.homedir(), ".mqtt-sqlite-store");
      try {
        fs.mkdirSync(_path);
      } catch (err) {}
    }
    const incomingOptions = (options && options.incoming) || {};
    incomingOptions.filename = path.join(_path, "incoming");
    this.incoming = new Store(incomingOptions);

    const outgoingOptions = (options && options.outgoing) || {};
    outgoingOptions.filename = path.join(_path, "outgoing");
    this.outgoing = new Store(outgoingOptions);
    return {
      incoming: await Store.createStore(incomingOptions),
      outgoing: await Store.createStore({
        ...outgoingOptions,
        rateLimit: options.rateLimit,
      }),
    };
  }
}

export default SQliteStore;
