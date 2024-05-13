import { promisify } from 'util';

const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.clientConnected = true;
    this.client.on('error', (err) => {
      console.error(err);
      this.clientConnected = false;
    });
    this.client.on('connect', () => {
      this.clientConnected = true;
    });
  }

  isAlive() {
    return this.clientConnected;
  }

  async get(key) {
    const asyncGet = promisify(this.client.get).bind(this.client);
    try {
      return await asyncGet(key);
    } catch (err) {
      throw new Error(err);
    }
  }

  async set(key, value, expiration) {
    const asyncSet = promisify(this.client.set).bind(this.client);
    const asyncExp = promisify(this.client.expire).bind(this.client);
    try {
      await asyncSet(key, value);
      await asyncExp(key, expiration);
    } catch (err) {
      throw new Error(err);
    }
  }

  async del(key) {
    const asyncDel = promisify(this.client.del).bind(this.client);
    try {
      await asyncDel(key);
    } catch (err) {
      throw new Error(err);
    }
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
