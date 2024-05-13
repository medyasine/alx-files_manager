const { MongoClient } = require('mongodb');
const { env } = require('process');

const host = env.DB_HOST ? env.DB_HOST : 'localhost';
const port = env.DB_PORT ? env.DB_PORT : '27017';
const db = env.DB_DATABASE ? env.DB_DATABASE : 'files_manager';
const URL = `mongodb://${host}:${port}/`;

class DBClient {
  constructor() {
    this.client = new MongoClient(URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.isConnected = false;

    this.client
      .connect()
      .then(() => {
        this.isConnected = true;
        this.database = db;
      })
      .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
      });
  }

  isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    const colDb = this.client.db(db).collection('users');
    const numUsers = await colDb.countDocuments();
    return numUsers;
  }

  async nbFiles() {
    const colDb = this.client.db(db).collection('files');
    const numFiles = await colDb.countDocuments();
    return numFiles;
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
