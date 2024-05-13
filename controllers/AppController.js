import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    return res.status(200).json(
      { redis: redisClient.isAlive(), db: dbClient.isAlive() },
    );
  }

  static async getStats(req, res) {
    const nbUsers = await dbClient.nbUsers();
    const nbFiles = await dbClient.nbFiles();
    return res.status(200).json({ users: nbUsers, files: nbFiles });
  }
}

module.exports = AppController;
